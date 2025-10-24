import { downloadPdf, extractFilename } from '../lib/pdf-downloader.js';
import { uploadPdf } from '../lib/cloudinary-service.js';
import { getErrorMessage } from '../lib/error-utils.js';
import type {
  Statement,
  CloudinaryAttachment,
  CarrierName,
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
 * Process and upload a single statement to Cloudinary
 * @param statement - Statement to process
 * @param carrierName - Name of the carrier
 * @returns Cloudinary attachment metadata
 */
export async function processStatement(
  statement: Statement,
  carrierName: CarrierName,
): Promise<CloudinaryAttachment> {
  if (!statement.pdfUrl) {
    throw new Error('Statement has no PDF URL');
  }

  const pdfBuffer = await downloadPdf(statement.pdfUrl);
  const filename = statement.filename || extractFilename(statement.pdfUrl);

  const attachment = await uploadPdf(pdfBuffer, {
    carrierName,
    filename,
    metadata: {
      statement_date: statement.statementDate,
      carrier: carrierName,
    },
  });

  return attachment;
}

/**
 * Process multiple statements
 * @param statements - Array of statements
 * @param carrierName - Name of the carrier
 * @param accountingPeriodStartDate - ISO date string to filter statements
 * @returns Array of Cloudinary attachments
 */
export async function processStatements(
  statements: Statement[],
  carrierName: CarrierName,
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
      const attachment = await processStatement(statement, carrierName);
      attachments.push(attachment);
    } catch (error: unknown) {
      console.error(
        `Failed to process statement ${statement.filename}:`,
        getErrorMessage(error),
      );
      // Continue processing other statements
    }
  }

  return attachments;
}
