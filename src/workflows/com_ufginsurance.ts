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

  console.log(job)

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

    // Step 8: Capture PDF using network interception
    // This avoids the new tab/CDP issue by intercepting the PDF data on the network level
    console.log('Setting up route interception for PDF...');

    let pdfBuffer: Buffer | null = null;

    // Use route interception instead of response listener
    // This captures the data BEFORE the response completes and before tabs open
    await page.route('**/*agency-statement*', async (route: any) => {
      try {
        console.log('Route intercepted:', route.request().url());

        // Continue the request and get the response
        const response = await route.fetch();
        const buffer = await response.body();

        if (buffer && buffer.length > 0) {
          pdfBuffer = buffer;
          console.log('PDF captured via route interception, size:', pdfBuffer.length);
        }

        // Fulfill the route with the same response
        await route.fulfill({
          response: response,
        });
      } catch (err: any) {
        console.error('Error in route handler:', err.message);
        // Fallback: just continue the route
        try {
          await route.continue();
        } catch (e) {
          console.error('Failed to continue route:', e);
        }
      }
    });

    // Find and click the button
    const buttonAction = await page.observe({
      instruction: `Find the Monthly Statement button in the row with date ${matchingDate}`,
      returnAction: true,
    });

    if (!buttonAction || buttonAction.length === 0) {
      throw new Error(`Could not find Monthly Statement button for ${matchingDate}`);
    }

    console.log('Clicking button to trigger PDF download...');

    // Click and handle the entire flow defensively
    // The CDP error may occur but we'll have already captured the PDF via network
    const clickAndWait = async () => {
      // Click the button
      await page.locator(buttonAction[0].selector).click();
      console.log('Button clicked');

      // Wait for PDF to be captured via network interception
      console.log('Waiting for PDF to be intercepted...');
      const startTime = Date.now();
      while (!pdfBuffer && Date.now() - startTime < 8000) {
        await page.waitForTimeout(500);
        if (pdfBuffer) {
          console.log('PDF captured during wait!');
          break;
        }
      }

      // Try to close any popup tabs that may have opened
      try {
        const pages = page.context().pages();
        console.log(`Found ${pages.length} pages`);
        for (const p of pages) {
          if (p !== page && p.url().includes('blob:')) {
            console.log('Closing blob URL page:', p.url());
            await p.close();
          }
        }
      } catch (err) {
        console.log('Error closing popup pages (may be expected):', err);
      }
    };

    try {
      await clickAndWait();
    } catch (err: any) {
      // CDP error may occur here, but if we got the PDF, that's OK
      console.log('Error during click/wait (checking if we got PDF anyway):', err.message);

      // Give it a moment to finish capturing
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!pdfBuffer) {
        // We didn't get the PDF and there was an error - this is a real problem
        throw err;
      }
      console.log('Got PDF despite error - continuing...');
    }

    if (!pdfBuffer) {
      throw new Error('Failed to capture PDF via network interception');
    }

    console.log('PDF captured successfully, size:', (pdfBuffer as Buffer).length);

    // Generate filename from accounting period date
    const filename = `UFG_Statement_${job.accounting_period_start_date.replace(/\//g, '-')}.pdf`;

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
