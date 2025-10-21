import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';
import type { CloudinaryUploadResult } from '../types/index.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export interface UploadOptions {
  carrierName: string;
  filename: string;
  metadata?: Record<string, string>;
}

/**
 * Upload a PDF file to Cloudinary
 * @param buffer PDF file as Buffer
 * @param options Upload configuration
 * @returns Cloudinary upload result with public_id, url, etag, etc.
 */
export async function uploadPdf(
  buffer: Buffer,
  options: UploadOptions
): Promise<CloudinaryUploadResult> {
  const { carrierName, filename, metadata = {} } = options;

  // Generate folder path: supplier_statements/{carrier}/{filename}
  const publicId = `supplier_statements/${carrierName}/${filename.replace(/\.pdf$/i, '')}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // Use 'raw' for PDF files
        public_id: publicId,
        overwrite: true,
        context: metadata,
        tags: ['supplier_statement', carrierName],
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        if (!result) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve(result as CloudinaryUploadResult);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Get Cloudinary URL for a public_id
 * @param publicId Cloudinary public ID
 * @param format File format (e.g., 'pdf')
 * @returns Cloudinary URL
 */
export function getCloudinaryUrl(publicId: string, format: string = 'pdf'): string {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    format,
  });
}
