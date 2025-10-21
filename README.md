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

2. Edit `.env` and add your credentials:
   - `BROWSERBASE_API_KEY` - Your Browserbase API key
   - `BROWSERBASE_PROJECT_ID` - Your Browserbase project ID
   - `GEMINI_API_KEY` - Your Google Gemini API key

## Usage

### Development

Run the API server in development mode (with hot reload):

```bash
npm run dev
```

The server will start on port 3000 (or the PORT specified in .env).

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

### Production

Build and run the production server:

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Manual Workflow Testing

You can test individual carrier workflows using the test-workflow command:

```bash
npm run test-workflow <carrier-name> <username> <password> <loginUrl>
```

**Examples:**

```bash
npm run test-workflow net_abacus myuser mypass https://abacus.net/login
npm run test-workflow com_advantagepartners myuser mypass https://advantagepartners.com/login
npm run test-workflow com_amerisafe myuser mypass https://amerisafe.com/login
```

The script will output JSON with the workflow results.

### API Endpoints

**POST /api/v1/fetch-statements** - Submit a job to fetch carrier statements
- Headers: `X-API-Key: your-api-key`
- Body: `{ job_id, organization_id, username, password, login_url, accounting_period_start_date }`
- Returns: `202 Accepted` (job processes asynchronously)

**GET /health** - Health check endpoint
- Returns: `200 OK` with timestamp
