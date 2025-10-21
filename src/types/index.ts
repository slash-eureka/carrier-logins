// Carrier script types
export interface Statement {
  pdfUrl: string;
  statementDate: string; // ISO date string (YYYY-MM-DD)
  filename?: string;
}

export interface CarrierCredentials {
  username: string;
  password: string;
  loginUrl: string;
}

export interface CarrierScriptResult {
  success: boolean;
  statements: Statement[];
  error?: string;
}

// API request/response types
export interface FetchStatementsRequest {
  job_id: string;
  organization_id: string;
  username: string;
  password: string;
  login_url: string;
  accounting_period_start_date: string; // ISO date (YYYY-MM-DD)
}

export interface FetchStatementsResponse {
  message: string;
  job_id: string;
}

export interface ErrorResponse {
  error: string;
}

// Rails API types
export interface CloudinaryAttachment {
  public_id: string;
  format: string;
  url: string;
  title: string;
  etag: string;
}

export interface CreateInboxStatementsRequest {
  organization_id: string;
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
  failure_reason?: 'invalid_credentials' | 'requires_mfa' | 'carrier_unavailable' | 'missing_instruction' | 'password_change';
  notes?: string;
}

// Cloudinary upload result
export interface CloudinaryUploadResult {
  public_id: string;
  format: string;
  url: string;
  etag: string;
  secure_url: string;
  resource_type: string;
}

// Configuration types
export interface AppConfig {
  port: number;
  apiKey: string;
  railsApiUrl: string;
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

// Carrier identification
export type CarrierName = 'abacus' | 'advantage-partners' | 'amerisafe' | 'unknown';
