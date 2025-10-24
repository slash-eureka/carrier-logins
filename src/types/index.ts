export interface Statement {
  pdfUrl: string;
  statementDate: string;
  filename?: string;
}

// TODO: this will likely require polymorphism for different carriers
export interface CarrierCredentials {
  username: string;
  password: string;
  login_url: string;
}

export interface WorkflowResult {
  success: boolean;
  statements: Statement[];
  error?: string;
}

export interface FetchStatementsRequest {
  job_id: string;
  credential: CarrierCredentials;
  accounting_period_start_date: string;
}

export interface FetchStatementsResponse {
  message: string;
  job_id: string;
}

export interface SupplierStatementFetchingJob extends FetchStatementsRequest {
  // Represents a workflow job for fetching supplier statements
}

// Type alias for workflow jobs - can become union type when adding more workflow types
export type WorkflowJob = SupplierStatementFetchingJob;

export interface ErrorResponse {
  error: string;
}

export interface CloudinaryAttachment {
  public_id: string;
  format: string;
  url: string;
  title: string;
  etag: string;
}

export interface CreateInboxStatementsRequest {
  attachments: CloudinaryAttachment[];
}

export interface CreateInboxStatementsResponse {
  inbox_item_ids: string[];
  inbox_item_status: Array<{
    status: 'created' | 'skipped';
    inbox_item_id?: string;
    original_attachment_params: CloudinaryAttachment;
    job_id: string;
    organization_id: string;
  }>;
}

export interface UpdateJobStatusRequest {
  status: 'success' | 'failed';
  failure_reason?:
    | 'invalid_credentials'
    | 'requires_mfa'
    | 'carrier_unavailable'
    | 'missing_instruction'
    | 'password_change';
  notes?: string;
}

export interface AppConfig {
  port: number;
  apiKey: string;
  adminApi: {
    apiKey: string;
    baseUrl: string;
  };
  browserbase: {
    apiKey: string;
    projectId: string;
  };
  gemini: {
    apiKey: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
}

export type CarrierSlug =
  | 'net_abacus'
  | 'com_advantagepartners'
  | 'com_amerisafe'
  | 'unknown';
