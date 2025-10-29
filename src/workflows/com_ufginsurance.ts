/**
 * UFG Insurance workflow script
 * Logs into UFG Insurance agents portal and retrieves commission statement PDFs
 */

/* eslint-disable */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { z } from 'zod';

/**
 * Run workflow for UFG Insurance supplier statement fetching
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
    // Step 1: Navigate to login page
    await page.goto(loginUrl);

    // Step 2: Enter username
    await page.act(`type '${username}' into the User ID input`);

    // Step 3: Enter password
    await page.act(`type '${password}' into the Password input`);

    // Step 4: Click Submit button
    await page.act(`click the Submit button`);

    // Wait for page to load after login
    await page.waitForTimeout(2000);

    // Step 5: Click REPORTS menu item
    await page.act(`click the REPORTS menu item`);

    // Step 6: Click Agency Statements button
    await page.act(`click the Agency Statements button`);

    // Wait for statements page to load
    await page.waitForTimeout(2000);

    // Step 7: Extract all statement dates from Direct Bill Monthly Commissions section
    const extractedStatements = await page.extract({
      instruction: `Extract all the dates from the table in the "Direct Bill Monthly Commissions" section. Each row has a date in the first column.`,
      schema: z.object({
        dates: z.array(z.string()),
      }),
    });

    console.log('Extracted dates:', extractedStatements.dates);

    // Simple date normalization: MM/DD/YYYY -> YYYY-MM-DD
    const normalizeDate = (dateStr: string): string => {
      if (dateStr.includes('/')) {
        const [month, day, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return dateStr;
    };

    const targetDateNormalized = normalizeDate(
      job.accounting_period_start_date,
    );
    console.log('Target date:', targetDateNormalized);

    const matchingDate = extractedStatements.dates?.find((dateStr: string) => {
      const normalized = normalizeDate(dateStr);
      console.log(`Comparing: ${normalized} === ${targetDateNormalized}`);
      return normalized === targetDateNormalized;
    });

    if (!matchingDate) {
      throw new Error(
        `No statement found for ${job.accounting_period_start_date}. Available: ${extractedStatements.dates?.join(', ')}`,
      );
    }

    console.log('Found matching date:', matchingDate);

    // Step 8: Set up listener for new page (PDF will open in new tab)
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.act(
        `click the Monthly Statement button in the row with date ${matchingDate}`,
      ),
    ]);
    console.log('Listener set up')

    // Wait for the PDF to load in the new tab
    await newPage.waitForLoadState('load', { timeout: 10000 });
    console.log('PDF page loaded')

    // Capture the blob URL
    const blobUrl = newPage.url();
    console.log('PDF Blob URL:', blobUrl);

    // Extract the PDF data as a buffer
    const pdfBuffer = await newPage.pdf({
      format: 'Letter',
      printBackground: true,
    });

    // Generate filename from accounting period date
    const filename = `UFG_Statement_${job.accounting_period_start_date.replace(/\//g, '-')}.pdf`;

    // Close the new page
    await newPage.close();

    return {
      success: true,
      statements: [
        {
          pdfBuffer: pdfBuffer,
          pdfFilename: filename,
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
