# carrier-logins

Browser automation scripts for logging into insurance carrier portals and downloading statements.

## Installation

```bash
npm install
```

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials

## Usage

### Development

Run the API server in development mode (with hot reload):

```bash
npm run dev
```

The server will start on port 3003 (or the PORT specified in .env).

### Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting & Formatting

Check and fix code quality:

```bash
# Run linter
npm run lint

# Fix auto-fixable lint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without making changes
npm run format:check

# Type check without building
npm run typecheck
```

### Production

Build and run the production server:

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Manual Workflow Testing

You can test individual carrier workflows using the workflow command. The carrier is automatically identified from the login URL:

```bash
npm run workflow <loginUrl> <username> <password>
```

**Example:**

```bash
npm run workflow https://abacus.net/login myuser mypass
```

The script will output JSON with the workflow results.

### API Endpoints

**POST /api/v1/jobs** - Start a job to fetch carrier statements
- Headers: `X-API-Key: your-api-key`
- Body:
  ```json
  {
    "job_id": "uuid",
    "credential": {
      "username": "carrier-username",
      "password": "carrier-password",
      "login_url": "https://carrier-portal.com/login"
    },
    "accounting_period_start_date": "2024-01-01"
  }
  ```
- Returns: `202 Accepted` (job processes asynchronously)

**GET /health** - Health check endpoint
- Returns: `200 OK` with timestamp

## Adding New Carrier Workflows

This section provides step-by-step instructions for adding a new carrier workflow to the system.

### Overview

Workflows are modular, pure functions that handle carrier-specific navigation logic. They are **automatically discovered at runtime** - just create a workflow file with the correct naming convention and it works! No manual registration or type updates needed.

The system integrates automatically with existing infrastructure for PDF processing, Cloudinary uploads, and Admin API callbacks.

### Prerequisites

Before creating a new workflow, you should:
- Have access to the carrier portal with test credentials
- Know the carrier's login URL and navigation flow
- Understand how statements are displayed and downloaded (direct URLs vs blob URLs)

### Step-by-Step Guide

#### 1. Determine the Carrier Slug

The carrier slug uses **reverse domain notation** with underscores:
- Domain: `abacus.net` → Slug: `net_abacus`
- Domain: `ufginsurance.com` → Slug: `com_ufginsurance`
- Domain: `advantagepartners.com` → Slug: `com_advantagepartners`

**Formula:** `{TLD}_{DOMAIN}` (using the last 2 parts of the hostname)

#### 2. Create the Workflow Script

**File:** `src/workflows/{carrier_slug}.ts`

Create a new file named with your carrier slug (e.g., `com_yournewcarrier.ts`):

```typescript
import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { z } from 'zod'; // If using extract()

export async function runWorkflow(
  stagehand: Stagehand,
  job: WorkflowJob,
): Promise<WorkflowResult> {
  const { username, password, login_url: loginUrl } = job.credential;
  const page = stagehand.page;

  try {
    // Your carrier-specific navigation logic here
    await page.goto(loginUrl);
    await page.act(`type '${username}' into the Username field`);
    await page.act(`type '${password}' into the Password field`);
    await page.act(`click the Login button`);

    // Navigate to statements page
    // Extract or intercept PDF URLs
    // Return statements

    return {
      success: true,
      statements: [
        {
          pdfUrl: 'https://example.com/statement.pdf', // For direct URLs
          statementDate: job.accounting_period_start_date,
        },
      ],
    };
  } catch (error: unknown) {
    return {
      success: false,
      statements: [],
      error: getErrorMessage(error),
    };
  }
}
```

**Important guidelines:**
- Export **only** the `runWorkflow(stagehand, job)` function
- Keep it pure - no CLI logic, only carrier-specific navigation
- Use try-catch with `getErrorMessage()` for error handling
- Return `WorkflowResult` with success status and statements array

#### 3. Choose PDF Capture Method

Depending on how the carrier serves PDFs, use one of these approaches:

##### Option A: Direct PDF URLs (like net_abacus.ts)

When PDFs open in new tabs with accessible URLs:

```typescript
// Set up listeners to catch PDF URLs
let pdfUrl: string | null = null;

page.context().on('page', async (newPage: any) => {
  await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
  const url = newPage.url();
  if (url.includes('.pdf')) {
    pdfUrl = url;
  }
});

page.on('response', async (response: any) => {
  const contentType = response.headers()['content-type'] || '';
  if (contentType.includes('pdf')) {
    pdfUrl = response.url();
  }
});

// Navigate to trigger PDF
await page.goto(pdfLinkUrl);

return {
  success: true,
  statements: [
    {
      pdfUrl: pdfUrl,
      statementDate: job.accounting_period_start_date,
    },
  ],
};
```

##### Option B: Route Interception for Blob URLs (like com_ufginsurance.ts)

When PDFs are served as blob URLs or need to be captured from network responses:

```typescript
// Set up route interception to capture file data
let fileBuffer: Buffer | null = null;

await page.route('**/*statement*', async (route: any) => {
  const response = await route.fetch();
  const buffer = (await response.body()) as Buffer;

  if (buffer && buffer.length > 0) {
    fileBuffer = buffer;
  }

  await route.fulfill({ response });
});

// Find and click the download button
const buttonAction = await page.observe({
  instruction: `Find the Download Statement button`,
  returnAction: true,
});

await page.locator(buttonAction[0].selector).click();

// Wait for file to be captured via route interception
const startTime = Date.now();
while (!fileBuffer && Date.now() - startTime < 8000) {
  await page.waitForTimeout(500);
}

if (!fileBuffer) {
  throw new Error('Failed to capture file');
}

return {
  success: true,
  statements: [
    {
      fileBuffer,
      filename: `Statement_${job.accounting_period_start_date}.pdf`,
      statementDate: job.accounting_period_start_date,
    },
  ],
};
```

##### Option C: Form POST Submissions (like com_apagents.ts)

When files are downloaded via form submissions (common for Excel files and on-demand generated reports):

```typescript
// Find the download button
const downloadButtons = await page.observe(
  `Find the download button for the target statement`
);

if (!downloadButtons || downloadButtons.length === 0) {
  throw new Error('Could not find download button');
}

const buttonLocator = page.locator(downloadButtons[0].selector);

// Extract form structure and data
const buttonInfo = await buttonLocator.evaluate((el: any) => {
  const form = el.closest('form');
  if (!form) {
    throw new Error('Download button is not inside a form');
  }

  const formData: any = {};
  const inputs = form.querySelectorAll('input, button, select, textarea');
  
  inputs.forEach((input: any) => {
    if (input.name) {
      formData[input.name] = input.value;
    }
  });
  
  return {
    formAction: form.action,      // POST URL
    formData,                      // All form inputs
    buttonName: el.name,           // Button's name attribute
    buttonValue: el.value,         // Button's value
  };
});

// Prepare POST data (include button name/value)
const postData = {
  ...buttonInfo.formData,
  [buttonInfo.buttonName]: buttonInfo.buttonValue,
};

// Submit form via POST and capture file
const response = await page.request.post(buttonInfo.formAction, {
  form: postData,
});

if (!response.ok()) {
  throw new Error(`Failed to fetch file: ${response.status()} ${response.statusText()}`);
}

const fileBytes = await response.body();

if (!fileBytes || fileBytes.length === 0) {
  throw new Error('Downloaded file is empty');
}

return {
  success: true,
  statements: [
    {
      fileBuffer: fileBytes,  // Works for Excel, PDF, or any file type
      filename: `Statement_${job.accounting_period_start_date}.xlsx`,
      statementDate: job.accounting_period_start_date,
    },
  ],
};
```

**Note:** 
- `fileBuffer` accepts any file type (Excel, PDF, CSV, etc.)
- Use `page.request.post()` to submit forms programmatically while preserving session cookies
- This approach captures files directly without dealing with browser downloads

##### Option D: HTML-to-PDF Conversion via Browser Print (like com_acuity.ts)

When statements are displayed as HTML/XHTML web pages rather than downloadable PDFs:

```typescript
// Step 1: Find and extract the statement page URL
const statementLinks = await page.observe(
  `Find the Agency Statement link for the statement with date ${targetDate}`,
);

if (!statementLinks || statementLinks.length === 0) {
  throw new Error(`No statement found for date ${targetDate}`);
}

// Step 2: Extract the statement URL from the link
const linkLocator = page.locator(statementLinks[0].selector);
const statementUrl = await linkLocator.evaluate((el: any) => el.href);

if (!statementUrl) {
  throw new Error('Could not extract statement URL from link');
}

// Step 3: Navigate directly to the statement URL
await page.goto(statementUrl, { waitUntil: 'networkidle', timeout: 30000 });

// Wait for page to fully render
await page.waitForTimeout(2000);

// Step 4: Convert the HTML/XHTML page to PDF using browser print
const pdfBuffer = (await page.pdf({
  format: 'Letter',
  printBackground: true,
  margin: {
    top: '0.5in',
    right: '0.5in',
    bottom: '0.5in',
    left: '0.5in',
  },
})) as Buffer;

if (!pdfBuffer || pdfBuffer.length === 0) {
  throw new Error('Failed to generate PDF from statement page');
}

return {
  success: true,
  statements: [
    {
      fileBuffer: pdfBuffer,
      filename: `Statement_${job.accounting_period_start_date.replace(/\//g, '-')}.pdf`,
      statementDate: job.accounting_period_start_date,
    },
  ],
};
```

**Note:**
- This uses Playwright's `page.pdf()` method to convert rendered HTML to PDF
- Best for carriers that display statements as web pages instead of providing downloadable PDFs
- Ensure `waitUntil: 'networkidle'` to let the page fully load before conversion
- You can customize PDF format, margins, and other print options

**Note:** Workflows are dynamically loaded at runtime - no registration needed! Just create the file with the correct naming convention and it will be automatically discovered.

#### 4. Test the Workflow

##### Via CLI (Recommended for initial testing)

```bash
npm run workflow <loginUrl> <username> <password>
```

**Example:**

```bash
npm run workflow https://portal.yournewcarrier.com/login testuser testpass
```

The CLI will:
- Automatically identify the carrier from the URL
- Execute the workflow
- Output JSON results
- Exit with code 0 (success) or 1 (failure)

##### Via API Endpoint

```bash
curl -X POST http://localhost:3003/api/v1/jobs \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-job-123",
    "credential": {
      "username": "testuser",
      "password": "testpass",
      "login_url": "https://portal.yournewcarrier.com/login"
    },
    "accounting_period_start_date": "2024-01-01"
  }'
```

#### 5. Verify TypeScript Compilation

```bash
npm run build
```

Ensure there are no TypeScript errors.

#### 6. Run Existing Tests

```bash
npm test
```

All tests should pass. Consider adding workflow-specific tests if needed.

### Statement Object Structure

The `Statement` interface supports two types of file delivery:

```typescript
interface Statement {
  // For direct URLs (downloaded by statement-processor)
  pdfUrl?: string;

  // For pre-captured files (PDFs, Excel, CSV, etc.)
  fileBuffer?: Buffer;  // Works for any file type
  filename?: string; // Required when using fileBuffer

  // Required for all statements
  statementDate: string;
}
```

**Notes:**
- `fileBuffer` can contain any file type (PDF, Excel, CSV, etc.)
- `filename` should include the appropriate extension (`.pdf`, `.xlsx`, `.csv`, etc.)

**The statement-processor service will:**
1. Check if `fileBuffer` exists → use it directly
2. Otherwise, check if `pdfUrl` exists → download the file
3. Upload file to Cloudinary
4. Send callback to Admin API

### Stagehand AI Methods

Use these Stagehand methods for navigation:

```typescript
// Perform actions (click, type, select, etc.)
await page.act(`click the Login button`);
await page.act(`type '${username}' into the Email field`);

// Extract structured data with Zod schema
const data = await page.extract({
  instruction: 'extract all statement dates and links',
  schema: z.object({
    statements: z.array(
      z.object({
        date: z.string(),
        linkHref: z.string(),
      })
    ),
  }),
});

// Observe without acting (plan actions)
const buttons = await page.observe('Find the Download button');
await page.act(buttons[0]); // Execute planned action

// Wait for conditions
await page.waitForTimeout(2000);
await page.waitForLoadState('domcontentloaded');
```

### Common Patterns

#### Filtering Statements by Date

The workflow should return all relevant statements - filtering by `accounting_period_start_date` is handled by `statement-processor`:

```typescript
// Return all statements, filtering happens downstream
return {
  success: true,
  statements: extractedStatements.map(stmt => ({
    pdfUrl: stmt.url,
    statementDate: stmt.date,
  })),
};
```

#### Handling Multiple Statement Types

If the carrier has multiple statement types (e.g., "Direct Bill", "Agency Bill"), filter in your workflow:

```typescript
const allStatements = await page.extract({
  instruction: 'extract all statements with type and date',
  schema: z.object({
    statements: z.array(
      z.object({
        type: z.string(),
        date: z.string(),
        url: z.string(),
      })
    ),
  }),
});

// Filter for specific type
const directBillStatements = allStatements.statements.filter(
  stmt => stmt.type.includes('Direct Bill')
);
```

#### Error Handling

Always wrap your workflow logic in try-catch:

```typescript
try {
  // Workflow logic
  return { success: true, statements };
} catch (error: unknown) {
  return {
    success: false,
    statements: [],
    error: getErrorMessage(error),
  };
}
```

### Debugging Tips

1. **Enable Verbose Logging:** Set `verbose: 1` in Stagehand config (already default)
2. **Use waitForTimeout:** Add delays to observe browser state
3. **Check Browser Console:** Look for JavaScript errors in carrier portal
4. **Inspect Network Tab:** Identify PDF request patterns
5. **Test with Real Credentials:** Some portals behave differently with test accounts
6. **Tail Heroku Logs:** `heroku logs --tail --app carrier-logins`
7. **Use Chrome Debugger:** `npx tsx --inspect-brk cli/run-workflow.ts LOGIN_URL USERNAME PASSWORD` and then navigate to `chrome://inspect` in your browser

### Examples

See existing workflow implementations:
- **`src/workflows/net_abacus.ts`** - Direct PDF URL interception
- **`src/workflows/com_ufginsurance.ts`** - Blob URL with PDF buffer capture via route interception
- **`src/workflows/com_apagents.ts`** - Form POST submission for Excel file downloads
- **`src/workflows/com_acuity.ts`** - HTML-to-PDF conversion via browser print

### TODO
- generate new org session token for auth
- figure out how I should ensure that workflows don't fail silently?
- change the folder that statements are uploaded to
