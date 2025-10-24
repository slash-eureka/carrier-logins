import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { authenticateApiKey } from './middleware/auth.js';
import { runWorkflow, identifyCarrier } from './services/workflow-manager.js';
import { processStatements } from './services/statement-processor.js';
import {
  createInboxStatements,
  updateJobStatus,
  mapErrorToFailureReason,
} from './services/admin-api-client.js';
import type {
  FetchStatementsRequest,
  FetchStatementsResponse,
  ErrorResponse,
} from './types/index.js';

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

// Create job endpoint
app.post('/api/v1/jobs', authenticateApiKey, async (req, res) => {
  const { job_id, credential, accounting_period_start_date } =
    req.body as FetchStatementsRequest;

  // Validate required fields
  if (!job_id) {
    res.status(400).json({
      error: 'Missing required field: job_id',
    } as ErrorResponse);
    return;
  }

  if (
    !credential ||
    !credential.username ||
    !credential.password ||
    !credential.login_url
  ) {
    res.status(400).json({
      error:
        'Missing required field: credential (must include username, password, and login_url)',
    } as ErrorResponse);
    return;
  }

  if (!accounting_period_start_date) {
    res.status(400).json({
      error: 'Missing required field: accounting_period_start_date',
    } as ErrorResponse);
    return;
  }

  // Respond immediately with 202 Accepted
  const response: FetchStatementsResponse = {
    message: 'Job accepted for processing',
    job_id,
  };
  res.status(202).json(response);

  // Process job asynchronously in background
  processJobAsync(req.body as FetchStatementsRequest);
});

/**
 * Process job asynchronously
 */
async function processJobAsync(job: FetchStatementsRequest): Promise<void> {
  const {
    job_id: jobId,
    credential,
    accounting_period_start_date: accountingPeriodStartDate,
  } = job;

  try {
    console.log(`[Job ${jobId}] Starting processing...`);

    // Identify carrier
    const carrierName = identifyCarrier(credential.login_url);
    console.log(`[Job ${jobId}] Identified carrier: ${carrierName}`);

    // Run workflow
    const result = await runWorkflow(job);

    if (!result.success) {
      console.error(`[Job ${jobId}] Workflow failed:`, result.error);

      // Update job status to failed
      await updateJobStatus(jobId, {
        status: 'failed',
        failure_reason: mapErrorToFailureReason(
          result.error || 'Unknown error',
        ),
        notes: result.error,
      });

      return;
    }

    console.log(
      `[Job ${jobId}] Workflow succeeded. Found ${result.statements.length} statements.`,
    );

    // Process statements (filter by date, download PDFs, upload to Cloudinary)
    const attachments = await processStatements(
      result.statements,
      carrierName,
      accountingPeriodStartDate,
    );

    console.log(
      `[Job ${jobId}] Processed ${attachments.length} statements after date filtering and upload.`,
    );

    if (attachments.length > 0) {
      // Create inbox statements via Admin API
      const adminApiResponse = await createInboxStatements(jobId, attachments);
      console.log(
        `[Job ${jobId}] Created ${adminApiResponse.inbox_item_ids.length} inbox items via Admin API.`,
      );

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
      // Try to update Admin API with failure status
      await updateJobStatus(jobId, {
        status: 'failed',
        failure_reason: mapErrorToFailureReason(error.message),
        notes: error.message,
      });
    } catch (adminApiError: any) {
      console.error(
        `[Job ${jobId}] Failed to update Admin API job status:`,
        adminApiError.message,
      );
    }
  }
}

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
    } as ErrorResponse);
  },
);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Carrier workflow service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
