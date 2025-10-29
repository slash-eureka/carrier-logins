/**
 * Amerisafe workflow script
 * Logs into Amerisafe portal and retrieves commission statement PDF URLs
 */

/* eslint-disable */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';

/**
 * Run workflow for Amerisafe supplier statement fetching
 * @param stagehand - Stagehand client instance
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with success status and statements
 */
/**
 * Convert date from YYYY-MM-DD to MM/DD/YYYY format
 * @param dateString - Date in YYYY-MM-DD or MM/DD/YYYY format
 * @returns Date in MM/DD/YYYY format
 */
function formatDateForAmerisafe(dateString: string): string {
  // If already in MM/DD/YYYY format, return as-is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }

  // Convert from YYYY-MM-DD to MM/DD/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
  }

  // Return as-is if format is unrecognized
  return dateString;
}

export async function runWorkflow(
  stagehand: Stagehand,
  job: WorkflowJob,
): Promise<WorkflowResult> {
  const { username, password, login_url: loginUrl } = job.credential;
  const page = stagehand.page;

  try {
    // Convert date to Amerisafe's format (MM/DD/YYYY)
    const formattedDate = formatDateForAmerisafe(
      job.accounting_period_start_date,
    );

    // Step 1: Navigate to login page
    await page.goto(loginUrl);

    // Step 2: Type username into User Name input field
    await page.act(`type '${username}' into the User Name input field`);

    // Step 3: Type password into Password input field
    await page.act(`type '${password}' into the Password input field`);

    // Step 4: Click Login button
    await page.act(`click the Login button`);

    // Step 5: Click Commission Statements link
    await page.act(`click the Commission Statements link`);

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Step 6: Find the statement link for the accounting period and get its URL
    const statementLinks = await page.observe(
      `Find the link for the ${formattedDate} statement`,
    );

    if (!statementLinks || statementLinks.length === 0) {
      throw new Error(`Could not find statement link for ${formattedDate}`);
    }

    // Get the statement link
    const linkLocator = page.locator(statementLinks[0].selector);

    // Set up promise to wait for the PDF response
    let pdfUrl: string | null = null;
    let pdfBytes: Buffer | null = null as Buffer | null;
    let resolvePdfUrl: ((url: string) => void) | null = null;

    const pdfUrlPromise = new Promise<string>((resolve, reject) => {
      resolvePdfUrl = resolve;

      // Set a timeout in case the PDF never loads
      setTimeout(() => {
        if (!pdfUrl) {
          reject(new Error('Timeout waiting for PDF response'));
        }
      }, 10000); // 10 second max timeout
    });

    // Listen for PDF response (link uses JavaScript postback that returns PDF directly)
    page.on('response', async (response: any) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (contentType.includes('pdf') || url.includes('.pdf')) {
        pdfUrl = url;
        resolvePdfUrl?.(url);
      }
    });

    await linkLocator.click();

    try {
      pdfUrl = await pdfUrlPromise;
    } catch (error) {
      throw new Error(
        'Failed to detect PDF response after clicking statement link',
      );
    }

    if (pdfUrl) {
      const response = await page.request.get(pdfUrl);

      if (!response.ok()) {
        throw new Error(
          `Failed to fetch PDF: ${response.status()} ${response.statusText()}`,
        );
      }

      pdfBytes = await response.body();
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error('Failed to capture PDF content');
    }

    console.log(
      `Successfully captured PDF: ${pdfBytes.length} bytes for statement date ${formattedDate}`,
    );

    return {
      success: true,
      statements: [
        {
          pdfBytes,
          statementDate: formattedDate,
        },
      ],
    };
  } catch (error: unknown) {
    return {
      success: false,
      statements: [],
      error: getErrorMessage(error),
    };
  }
}
