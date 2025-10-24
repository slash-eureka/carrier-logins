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

**Examples:**

```bash
npm run workflow https://abacus.net/login myuser mypass
npm run workflow https://advantagepartners.com/login myuser mypass
npm run workflow https://amerisafe.com/login myuser mypass
```

The script will output JSON with the workflow results.

### API Endpoints

**POST /api/v1/jobs** - Create a job to fetch carrier statements
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


### TODO
- Capture cloudinary etags to avoid duplicate statements
- Include last retrieved statement identifier in the fetch-statements request to avoid fetching duplicate statements
- Set up github tests to run
