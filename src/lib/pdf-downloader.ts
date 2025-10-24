import axios from 'axios';

/**
 * Download a PDF from a URL and return as Buffer
 * @param url URL of the PDF to download
 * @returns PDF file as Buffer
 */
export async function downloadPdf(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max file size
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download PDF: HTTP ${response.status}`);
    }

    return Buffer.from(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      throw new Error(
        'PDF download timeout - file may be too large or server is slow',
      );
    }
    if (error.response) {
      throw new Error(
        `Failed to download PDF: HTTP ${error.response.status} ${error.response.statusText}`,
      );
    }
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
}

/**
 * Extract filename from URL or generate one
 * @param url PDF URL
 * @param fallbackName Fallback filename if URL doesn't contain one
 * @returns Filename with .pdf extension
 */
export function extractFilename(
  url: string,
  fallbackName: string = 'statement',
): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || fallbackName;

    // Ensure .pdf extension
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return `${filename}.pdf`;
    }

    return filename;
  } catch {
    return `${fallbackName}.pdf`;
  }
}
