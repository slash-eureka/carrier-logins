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
    await page.goto(loginUrl);
    await page.act(`type '${username}' into the User ID input`);
    await page.act(`type '${password}' into the Password input`);
    await page.act(`click the Submit button`);
    await page.waitForTimeout(2000);

    await page.act(`click the REPORTS menu item`);
    await page.act(`click the Agency Statements button`);

    await page.waitForSelector('.uikit__loading-indicator', {
      state: 'detached',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);

    const tableIsLoaded = page.getByText(
      'Direct Bill Monthly Commissions (100 Series Policies)',
    );
    if (!tableIsLoaded) {
      throw new Error('Statements table did not load properly.');
    }

    const extractedStatements = await page.extract({
      instruction: `Extract all the dates from the table in the "Direct Bill Monthly Commissions" section. Each row has a date in the first column.`,
      schema: z.object({
        dates: z.array(z.string()),
      }),
    });

    // Normalize date format: MM/DD/YYYY -> YYYY-MM-DD
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

    const matchingDate = extractedStatements.dates?.find((dateStr: string) =>
      normalizeDate(dateStr) === targetDateNormalized
    );

    if (!matchingDate) {
      throw new Error(
        `No statement found for ${job.accounting_period_start_date}. Available: ${extractedStatements.dates?.join(', ')}`,
      );
    }

    // Capture PDF via route interception (avoids CDP errors from new tab)
    let pdfBuffer: Buffer | null = null;

    await page.route('**/*agency-statement*', async (route: any) => {
      try {
        const response = await route.fetch();
        const buffer = await response.body() as Buffer;

        if (buffer && buffer.length > 0) {
          pdfBuffer = buffer;
          console.log('PDF captured, size:', buffer.length);
        }

        await route.fulfill({ response });
      } catch (err: any) {
        console.error('Error in route handler:', err.message);
        try {
          await route.continue();
        } catch (e) {
          console.error('Failed to continue route:', e);
        }
      }
    });

    const buttonAction = await page.observe({
      instruction: `Find the Monthly Statement button in the row with date ${matchingDate}`,
      returnAction: true,
    });

    if (!buttonAction || buttonAction.length === 0) {
      throw new Error(`Could not find Monthly Statement button for ${matchingDate}`);
    }

    // Click button and wait for PDF capture (CDP errors may occur but are caught)
    const clickAndWait = async () => {
      await page.locator(buttonAction[0].selector).click();

      const startTime = Date.now();
      while (!pdfBuffer && Date.now() - startTime < 8000) {
        await page.waitForTimeout(500);
      }

      // Close any blob URL tabs that opened
      try {
        const pages = page.context().pages();
        for (const p of pages) {
          if (p !== page && p.url().includes('blob:')) {
            await p.close();
          }
        }
      } catch (err) {
        console.log('Error closing popup pages:', err);
      }
    };

    try {
      await clickAndWait();
    } catch (err: any) {
      console.log('Error during click/wait, checking if PDF was captured:', err.message);
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!pdfBuffer) {
        throw err;
      }
      console.log('PDF captured despite error, continuing');
    }

    if (!pdfBuffer) {
      throw new Error('Failed to capture PDF via network interception');
    }

    const filename = `UFG_Statement_${job.accounting_period_start_date.replace(/\//g, '-')}.pdf`;

    return {
      success: true,
      statements: [
        {
          pdfBuffer,
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
