import { downloadPdf, extractFilename } from '../lib/pdf-downloader.js';
import { uploadPdf } from '../lib/cloudinary-service.js';
import { getErrorMessage } from '../lib/error-utils.js';
import type {
  Statement,
  CloudinaryAttachment,
  CarrierSlug,
} from '../types/index.js';

/**
 * Filter statements by accounting period start date
 * @param statements - Array of statements from workflow
 * @param accountingPeriodStartDate - ISO date string (YYYY-MM-DD)
 * @returns Filtered statements
 */
export function filterStatementsByDate(
  statements: Statement[],
  accountingPeriodStartDate: string,
): Statement[] {
  const cutoffDate = new Date(accountingPeriodStartDate);

  return statements.filter((statement) => {
    const statementDate = new Date(statement.statementDate);
    return statementDate > cutoffDate;
  });
}

/**
 * Validate that a buffer contains a valid PDF
 * @param buffer - Buffer to validate
 * @throws Error if buffer is not a valid PDF
 */
function validatePdfBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF buffer is empty or null');
  }

  // Check PDF header: should start with "%PDF" (bytes: 0x25 0x50 0x44 0x46)
  const header = buffer.slice(0, 4).toString('ascii');
  if (header !== '%PDF') {
    throw new Error(
      `Invalid PDF: expected header "%PDF" but got "${header}" (bytes: ${buffer.slice(0, 4).join(' ')})`,
    );
  }

  console.log(`PDF validation passed: ${buffer.length} bytes, header: ${header}`);
}

/**
 * Process and upload a single statement to Cloudinary
 * @param statement - Statement to process
 * @param carrierSlug - Carrier slug in reverse domain notation
 * @returns Cloudinary attachment metadata
 */
export async function processStatement(
  statement: Statement,
  carrierSlug: CarrierSlug,
): Promise<CloudinaryAttachment> {
  let pdfBuffer: Buffer;
  let filename: string;

  // Handle both URL-based and Buffer-based statements
  if (statement.pdfBuffer) {
    // Statement already has PDF data as Buffer
    pdfBuffer = statement.pdfBuffer;
    filename = statement.pdfFilename || 'statement.pdf';
  } else if (statement.pdfUrl) {
    // Statement has URL - download PDF
    pdfBuffer = await downloadPdf(statement.pdfUrl);
    filename = extractFilename(statement.pdfUrl);
  } else {
    throw new Error('Statement has neither pdfUrl nor pdfBuffer');
  }

  // Validate PDF before uploading
  validatePdfBuffer(pdfBuffer);

  const attachment = await uploadPdf(pdfBuffer, {
    carrierName: carrierSlug,
    filename,
    metadata: {
      statement_date: statement.statementDate,
      carrier: carrierSlug,
    },
  });

  return attachment;
}

/**
 * Process multiple statements
 * @param statements - Array of statements
 * @param carrierSlug - Carrier slug in reverse domain notation
 * @param accountingPeriodStartDate - ISO date string to filter statements
 * @returns Array of Cloudinary attachments
 */
export async function processStatements(
  statements: Statement[],
  carrierSlug: CarrierSlug,
  accountingPeriodStartDate: string,
): Promise<CloudinaryAttachment[]> {
  // Filter statements by date
  const filteredStatements = filterStatementsByDate(
    statements,
    accountingPeriodStartDate,
  );

  if (filteredStatements.length === 0) {
    return [];
  }

  // Process each statement (download and upload)
  const attachments: CloudinaryAttachment[] = [];

  for (const statement of filteredStatements) {
    try {
      const attachment = await processStatement(statement, carrierSlug);
      attachments.push(attachment);
    } catch (error: unknown) {
      console.error(
        `Failed to process statement for ${statement.statementDate}:`,
        getErrorMessage(error),
      );
      // Continue processing other statements
    }
  }

  return attachments;
}
