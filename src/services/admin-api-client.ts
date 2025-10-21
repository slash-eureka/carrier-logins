import axios from 'axios';
import { config } from '../config/index.js';
import type {
  CloudinaryAttachment,
  CreateInboxStatementsRequest,
  CreateInboxStatementsResponse,
  UpdateJobStatusRequest,
} from '../types/index.js';

/**
 * Create inbox statements via Admin API
 * @param jobId - UUID of SupplierStatementFetchingJob
 * @param organizationId - UUID of Organization
 * @param attachments - Array of Cloudinary attachments
 * @returns Response from Admin API
 */
export async function createInboxStatements(
  jobId: string,
  organizationId: string,
  attachments: CloudinaryAttachment[]
): Promise<CreateInboxStatementsResponse> {
  const url = `${config.adminApi.baseUrl}/admin/supplier_statement_fetching_jobs_admin/${jobId}/create_inbox_statements`;

  const payload: CreateInboxStatementsRequest = {
    organization_id: organizationId,
    attachments,
  };

  try {
    const response = await axios.post<CreateInboxStatementsResponse>(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.adminApi.apiKey,
      },
      timeout: 30000, // 30 second timeout
    });

    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Admin API error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
      );
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Admin API request timeout');
    }
    throw new Error(`Failed to create inbox statements: ${error.message}`);
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
  statusUpdate: UpdateJobStatusRequest
): Promise<void> {
  const url = `${config.adminApi.baseUrl}/admin/supplier_statement_fetching_jobs_admin/${jobId}`;

  try {
    await axios.patch(url, statusUpdate, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.adminApi.apiKey,
      },
      timeout: 30000, // 30 second timeout
    });
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Admin API error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
      );
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Admin API request timeout');
    }
    throw new Error(`Failed to update job status: ${error.message}`);
  }
}

/**
 * Map error message to failure reason enum
 * @param errorMessage - Error message from workflow execution
 * @returns Failure reason for Admin API
 */
export function mapErrorToFailureReason(
  errorMessage: string
): UpdateJobStatusRequest['failure_reason'] {
  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes('invalid credentials') || lowerError.includes('login failed')) {
    return 'invalid_credentials';
  }
  if (lowerError.includes('mfa') || lowerError.includes('two-factor')) {
    return 'requires_mfa';
  }
  if (lowerError.includes('unavailable') || lowerError.includes('timeout') || lowerError.includes('network')) {
    return 'carrier_unavailable';
  }
  if (lowerError.includes('unknown carrier') || lowerError.includes('script not found')) {
    return 'missing_instruction';
  }
  if (lowerError.includes('password expired') || lowerError.includes('must change password')) {
    return 'password_change';
  }

  // Default to carrier_unavailable for unknown errors
  return 'carrier_unavailable';
}
