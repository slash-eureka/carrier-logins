/**
 * Acuity Insurance workflow script
 * Logs into Acuity agents portal and retrieves commission statement PDFs
 */

/* eslint-disable */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';

/**
 * Convert date from YYYY-MM-DD to "MMM YYYY" format for Acuity
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date in "MMM YYYY" format (e.g., "Sep 2025")
 */
function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const monthAbbr = date.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  const yearStr = date.getUTCFullYear().toString();
  return `${monthAbbr} ${yearStr}`;
}

/**
 * Run workflow for Acuity Insurance supplier statement fetching
 * @param stagehand - Stagehand client instance
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with success status and statements
 */
export async function runWorkflow(
  stagehand: Stagehand,
  job: WorkflowJob,
): Promise<WorkflowResult> {
  const { username, password, login_url: loginUrl } = job.credential;
  const page = stagehand.page;

  try {
    let pdfBuffer: Buffer | null = null;

    // Convert date to Acuity's format (e.g., "Sep 2025")
    const targetDate = formatDate(job.accounting_period_start_date);

    // Step 1: Navigate to login URL
    await page.goto(loginUrl);

    // Step 2: Enter username
    await page.act(`type '${username}' into the Login ID field`);

    // Step 3: Enter password
    await page.act(`type '${password}' into the Password field`);

    // Step 4: Click Log In button
    await page.act(`click the Log In button`);

    await page.waitForTimeout(2000);

    // Step 5: Navigate to Agency Statement
    await page.act(`click the Agency Statement link`);

    await page.waitForTimeout(2000);

    // Step 6: Find the statement link for the specified accounting period
    const statementLinks = await page.observe(
      `Find the Agency Statement - Acuity link for the statement with date ${targetDate}`,
    );

    if (!statementLinks || statementLinks.length === 0) {
      throw new Error(`No agency statement found for date ${targetDate}`);
    }

    // Step 7: Extract the statement URL from the link (avoid clicking which opens new tab)
    const linkLocator = page.locator(statementLinks[0].selector);
    const statementUrl = await linkLocator.evaluate((el: any) => el.href);

    if (!statementUrl) {
      throw new Error('Could not extract statement URL from link');
    }

    console.log('Statement URL:', statementUrl);

    // Step 8: Navigate directly to the statement URL (avoids new tab issues)
    await page.goto(statementUrl, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('Statement page loaded, current URL:', page.url());

    // Wait for page to fully render
    await page.waitForTimeout(2000);

    // Step 9: Convert the HTML/XHTML page to PDF using browser print
    console.log('Converting statement page to PDF...');

    pdfBuffer = (await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
    })) as Buffer;

    console.log('PDF generated, size:', pdfBuffer.length);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Failed to generate PDF from statement page');
    }

    const filename = `Acuity_Statement_${job.accounting_period_start_date.replace(/\//g, '-')}.pdf`;

    return {
      success: true,
      statements: [
        {
          fileBuffer: pdfBuffer,
          filename: filename,
          statementDate: job.accounting_period_start_date,
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
