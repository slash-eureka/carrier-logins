import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { authenticateApiKey } from './middleware/auth.js';
import { processStatements } from './services/statement-processor.js';
import * as adminApi from './services/admin-api-client.js';
import * as workflow from './services/workflow-manager.js';
import type {
  FetchStatementsRequest,
  FetchStatementsResponse,
  ErrorResponse,
} from './types/index.js';

validateConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start job workflow
app.post('/api/v1/jobs', authenticateApiKey, async (req, res) => {
  const { job_id, credential, accounting_period_start_date } =
    req.body as FetchStatementsRequest;

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

  const response: FetchStatementsResponse = {
    message: 'Job accepted for processing',
    job_id,
  };
  res.status(202).json(response);

  processJobAsync(req.body as FetchStatementsRequest);
});

async function processJobAsync(job: FetchStatementsRequest): Promise<void> {
  const {
    job_id: jobId,
    credential,
    accounting_period_start_date: accountingPeriodStartDate,
  } = job;

  try {
    console.log(`[Job ${jobId}] Starting processing...`);

    const carrierSlug = workflow.identify(credential.login_url);
    console.log(`[Job ${jobId}] Identified carrier: ${carrierSlug}`);

    const result = await workflow.run(job);

    if (!result.success) {
      console.error(`[Job ${jobId}] Workflow failed:`, result.error);

      await adminApi.updateJobStatus(jobId, {
        status: 'failed',
        failure_reason: 'carrier_unavailable',
        notes: result.error,
      });

      return;
    }

    console.log(
      `[Job ${jobId}] Workflow succeeded. Found ${result.statements.length} statements.`,
    );

    const attachments = await processStatements(
      result.statements,
      carrierSlug,
      accountingPeriodStartDate,
    );

    console.log(
      `[Job ${jobId}] Processed ${attachments.length} statements after date filtering and upload.`,
    );

    if (attachments.length > 0) {
      const adminApiResponse = await adminApi.createInboxStatements(
        jobId,
        attachments,
      );
      console.log(
        `[Job ${jobId}] Created ${adminApiResponse.inbox_item_ids.length} inbox items via Admin API.`,
      );

      await adminApi.updateJobStatus(jobId, {
        status: 'success',
      });
    } else {
      console.log(`[Job ${jobId}] No new statements found after filtering.`);
      await adminApi.updateJobStatus(jobId, {
        status: 'success',
        notes: 'No new statements found after date filtering',
      });
    }

    console.log(`[Job ${jobId}] Processing completed successfully.`);
  } catch (error: any) {
    console.error(`[Job ${jobId}] Error during processing:`, error);

    try {
      await adminApi.updateJobStatus(jobId, {
        status: 'failed',
        failure_reason: 'carrier_unavailable',
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

// Error middleware
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

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Browser workflow service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
