/**
 * CMF Group workflow script
 * Logs into CMF Group agents portal and retrieves commission statement PDFs
 */

/* eslint-disable */

import fs from 'fs';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { debug } from '../lib/debug.js';

/**
 * Run workflow for CMF Group supplier statement fetching
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
    await page.act(`type '${username}' into the Email input`);
    await page.act(`type '${password}' into the Password input`);
    await page.act(`click the Log In button`);
    await page.waitForTimeout(2000);

    await page.act(`click the Reports menu item`);

    // Format date as YYYY-MM for report selection
    const formattedDate = new Date(
      job.accounting_period_start_date + 'T00:00:00',
    );
    const dateForReport = `${formattedDate.getFullYear()}-${String(formattedDate.getMonth() + 1).padStart(2, '0')}`;

    // Select dropdown option for accounting period
    const dropdown = page.locator('select[name="reportSelector"]');
    const options = await dropdown.locator('option').all();
    let isOptionFound = false;
    for (const opt of options) {
      const text = await opt.textContent();
      if (text?.includes(dateForReport)) {
        await dropdown.selectOption({ label: text });
        isOptionFound = true;
        break;
      }
    }

    if (!isOptionFound) {
      return {
        success: true,
        statements: [],
      };
    }

    // Download file
    let pdfBuffer: Buffer | null = null;
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("View Report")');
    const download = await downloadPromise;
    let downloadError = await download.failure();
    if (downloadError) {
      throw new Error(downloadError);
    }

    // Wait for download to complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const pdfFilename = await download.suggestedFilename();
    pdfBuffer = fs.readFileSync(`./downloads/${pdfFilename}`);
    fs.unlinkSync(`./downloads/${pdfFilename}`);

    if (!pdfBuffer) {
      throw new Error('Failed to capture PDF');
    }

    return {
      success: true,
      statements: [
        {
          pdfBuffer,
          pdfFilename,
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
