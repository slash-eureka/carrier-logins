import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiOptions,
} from 'cloudinary';
import { config } from '../config/index.js';
import type { CloudinaryAttachment } from '../types/index.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export interface UploadOptions {
  carrierName: string;
  filename: string;
  metadata?: Record<string, string>;
  overwrite?: boolean;
  uniqueFilename?: boolean;
  invalidate?: boolean;
}

/**
 * Build the public_id for a Cloudinary upload
 * Format: supplier_statements/{carrier}/{filename_without_extension}
 *
 * @param carrierName - Name of the carrier (e.g., 'net_abacus')
 * @param filename - Original filename (e.g., 'statement_2024-01.pdf')
 * @returns Public ID path for Cloudinary
 *
 * @example
 * buildPublicId('net_abacus', 'statement_2024-01.pdf')
 * // Returns: 'supplier_statements/net_abacus/statement_2024-01'
 */
function buildPublicId(carrierName: string, filename: string): string {
  const filenameWithoutExt = filename.replace(/\.pdf$/i, '');
  return `supplier_statements/${carrierName}/${filenameWithoutExt}`;
}

/**
 * Build upload options for Cloudinary API
 *
 * @param publicId - Cloudinary public ID
 * @param options - Upload configuration options
 * @returns Cloudinary API upload options
 */
function buildUploadOptions(
  publicId: string,
  options: UploadOptions,
): UploadApiOptions {
  const {
    carrierName,
    metadata = {},
    overwrite = false,
    uniqueFilename = false,
    invalidate = false,
  } = options;

  return {
    resource_type: 'raw',
    public_id: publicId,
    overwrite,
    unique_filename: uniqueFilename,
    invalidate,
    context: metadata,
    tags: ['supplier_statement', carrierName],
  };
}

/**
 * Upload a PDF file to Cloudinary
 *
 * Uploads a PDF buffer to Cloudinary using the streaming upload API.
 * Files are organized in the folder structure: supplier_statements/{carrier}/{filename}
 *
 * @param buffer - PDF file as Buffer
 * @param options - Upload configuration
 * @returns Cloudinary attachment metadata for Rails API
 *
 * @throws {Error} If upload fails or returns no result
 *
 * @example
 * const fileBuffer = await downloadPdf(url);
 * const attachment = await uploadPdf(fileBuffer, {
 *   carrierName: 'net_abacus',
 *   filename: 'statement_2024-01.pdf',
 *   metadata: { statement_date: '2024-01-01' },
 *   overwrite: true
 * });
 */
export async function uploadPdf(
  buffer: Buffer,
  options: UploadOptions,
): Promise<CloudinaryAttachment> {
  const { carrierName, filename } = options;
  const publicId = buildPublicId(carrierName, filename);
  const uploadOptions = buildUploadOptions(publicId, options);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          const errorMessage = error.message || 'Unknown error';
          const errorCode = error.http_code || 'UNKNOWN';
          reject(
            new Error(
              `Cloudinary upload failed [${errorCode}]: ${errorMessage}`,
            ),
          );
          return;
        }

        if (!result) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }

        resolve(mapToAttachment(result, filename));
      },
    );

    uploadStream.end(buffer);
  });
}

/**
 * Map Cloudinary upload response to Rails-compatible attachment format
 *
 * @param result - Cloudinary upload API response
 * @param filename - Original filename
 * @returns CloudinaryAttachment for Rails API
 */
function mapToAttachment(
  result: UploadApiResponse,
  filename: string,
): CloudinaryAttachment {
  return {
    public_id: result.public_id,
    format: result.format,
    url: result.secure_url || result.url,
    title: filename,
    etag: result.etag,
  };
}

/**
 * Get Cloudinary URL for a public_id
 *
 * @param publicId - Cloudinary public ID
 * @param format - File format (default: 'pdf')
 * @returns Cloudinary URL
 *
 * @example
 * const url = getCloudinaryUrl('supplier_statements/net_abacus/statement_2024-01', 'pdf');
 * // Returns: 'https://res.cloudinary.com/{cloud}/raw/upload/supplier_statements/net_abacus/statement_2024-01.pdf'
 */
export function getCloudinaryUrl(
  publicId: string,
  format: string = 'pdf',
): string {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    format,
  });
}
