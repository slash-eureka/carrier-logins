import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { authenticateApiKey } from './middleware/auth.js';
import { runCarrierAutomation, identifyCarrier } from './services/carrier-script-manager.js';
import { processStatements } from './services/statement-processor.js';
import { createInboxStatements, updateJobStatus, mapErrorToFailureReason } from './services/rails-client.js';
import type { FetchStatementsRequest, FetchStatementsResponse, ErrorResponse } from './types/index.js';

// Validate configuration on startup
validateConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fetch statements endpoint
app.post('/api/v1/fetch-statements', authenticateApiKey, async (req, res) => {
  const {
    job_id,
    organization_id,
    username,
    password,
    login_url,
    accounting_period_start_date,
  } = req.body as FetchStatementsRequest;

  // Validate required fields
  const requiredFields = [
    'job_id',
    'organization_id',
    'username',
    'password',
    'login_url',
    'accounting_period_start_date',
  ];

  for (const field of requiredFields) {
    if (!req.body[field]) {
      res.status(400).json({
        error: `Missing required field: ${field}`,
      } as ErrorResponse);
      return;
    }
  }

  // Respond immediately with 202 Accepted
  const response: FetchStatementsResponse = {
    message: 'Job accepted for processing',
    job_id,
  };
  res.status(202).json(response);

  // Process job asynchronously in background
  processJobAsync(job_id, organization_id, { username, password, loginUrl: login_url }, accounting_period_start_date);
});

/**
 * Process job asynchronously
 */
async function processJobAsync(
  jobId: string,
  organizationId: string,
  credentials: { username: string; password: string; loginUrl: string },
  accountingPeriodStartDate: string
): Promise<void> {
  try {
    console.log(`[Job ${jobId}] Starting processing...`);

    // Identify carrier
    const carrierName = identifyCarrier(credentials.loginUrl);
    console.log(`[Job ${jobId}] Identified carrier: ${carrierName}`);

    // Run carrier automation
    const result = await runCarrierAutomation(credentials);

    if (!result.success) {
      console.error(`[Job ${jobId}] Carrier automation failed:`, result.error);

      // Update job status to failed
      await updateJobStatus(jobId, {
        status: 'failed',
        failure_reason: mapErrorToFailureReason(result.error || 'Unknown error'),
        notes: result.error,
      });

      return;
    }

    console.log(`[Job ${jobId}] Carrier automation succeeded. Found ${result.statements.length} statements.`);

    // Process statements (filter by date, download PDFs, upload to Cloudinary)
    const attachments = await processStatements(
      result.statements,
      carrierName,
      accountingPeriodStartDate
    );

    console.log(`[Job ${jobId}] Processed ${attachments.length} statements after date filtering and upload.`);

    if (attachments.length > 0) {
      // Create inbox statements in Rails
      const railsResponse = await createInboxStatements(jobId, organizationId, attachments);
      console.log(`[Job ${jobId}] Created ${railsResponse.inbox_item_ids.length} inbox items in Rails.`);

      // Update job status to success
      await updateJobStatus(jobId, {
        status: 'success',
      });
    } else {
      // No new statements - still mark as success
      console.log(`[Job ${jobId}] No new statements found after filtering.`);
      await updateJobStatus(jobId, {
        status: 'success',
        notes: 'No new statements found after date filtering',
      });
    }

    console.log(`[Job ${jobId}] Processing completed successfully.`);

  } catch (error: any) {
    console.error(`[Job ${jobId}] Error during processing:`, error);

    try {
      // Try to update Rails with failure status
      await updateJobStatus(jobId, {
        status: 'failed',
        failure_reason: mapErrorToFailureReason(error.message),
        notes: error.message,
      });
    } catch (railsError: any) {
      console.error(`[Job ${jobId}] Failed to update Rails job status:`, railsError.message);
    }
  }
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
  } as ErrorResponse);
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Carrier logins service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
