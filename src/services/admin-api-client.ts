import axios from 'axios';
import { config } from '../config/index.js';
import { getErrorMessage } from '../lib/error-utils.js';
import type {
  CloudinaryAttachment,
  CreateInboxStatementsRequest,
  CreateInboxStatementsResponse,
  UpdateJobStatusRequest,
} from '../types/index.js';

/**
 * Create inbox statements via Admin API
 * @param jobId - UUID of SupplierStatementFetchingJob
 * @param attachments - Array of Cloudinary attachments
 * @returns Response from Admin API
 */
export async function createInboxStatements(
  jobId: string,
  attachments: CloudinaryAttachment[],
): Promise<CreateInboxStatementsResponse> {
  const url = `${config.adminApi.baseUrl}/internal/supplier_statement_fetching_jobs_admin/${jobId}/create_inbox_statements`;

  const payload: CreateInboxStatementsRequest = {
    attachments,
  };

  try {
    const response = await axios.post<CreateInboxStatementsResponse>(
      url,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.adminApi.apiKey}`,
        },
        timeout: 30000,
      },
    );

    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Admin API error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`,
      );
    }
    throw new Error(
      `Failed to create inbox statements: ${getErrorMessage(error)}`,
    );
  }
}

/**
 * Update job status via Admin API
 * @param jobId - UUID of SupplierStatementFetchingJob
 * @param statusUpdate - Status update payload
 * @returns void
 */
export async function updateJobStatus(
  jobId: string,
  statusUpdate: UpdateJobStatusRequest,
): Promise<void> {
  const url = `${config.adminApi.baseUrl}/internal/supplier_statement_fetching_jobs_admin/${jobId}`;

  try {
    await axios.patch(url, statusUpdate, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.adminApi.apiKey}`,
      },
      timeout: 30000,
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Admin API error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`,
      );
    }
    throw new Error(`Failed to update job status: ${getErrorMessage(error)}`);
  }
}
