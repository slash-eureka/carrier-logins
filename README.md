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

##### Option B: Blob URLs (like com_ufginsurance.ts)

When PDFs use blob URLs or need to be captured as buffers:

```typescript
// Set up listener for new page/tab
const [newPage] = await Promise.all([
  page.context().waitForEvent('page'),
  page.act(`click the Download Statement button`),
]);

// Wait for PDF to load
await newPage.waitForLoadState('load', { timeout: 10000 });

// Capture PDF as buffer
const pdfBuffer = await newPage.pdf({
  format: 'Letter',
  printBackground: true,
});

const filename = `Statement_${job.accounting_period_start_date}.pdf`;

await newPage.close();

return {
  success: true,
  statements: [
    {
      pdfBuffer: pdfBuffer,
      pdfFilename: filename,
      statementDate: job.accounting_period_start_date,
    },
  ],
};
```

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

The `Statement` interface supports two types of PDFs:

```typescript
interface Statement {
  // For direct URLs (downloaded by statement-processor)
  pdfUrl?: string;

  // For blob URLs or pre-captured PDFs
  pdfBuffer?: Buffer;
  pdfFilename?: string; // Required when using pdfBuffer

  // Required for all statements
  statementDate: string;
}
```

**The statement-processor service will:**
1. Check if `pdfBuffer` exists → use it directly
2. Otherwise, check if `pdfUrl` exists → download PDF
3. Upload PDF to Cloudinary
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
- **`src/workflows/com_ufginsurance.ts`** - Blob URL with PDF buffer capture

### TODO
- should I generate new org token?
- figure out how I should ensure that workflows don't fail silently?
- change the folder that statements are uploaded to
