/**
 * Advantage Partners workflow script
 * Logs into Advantage Partners portal and retrieves commission statement Excel files
 */

/* eslint-disable */

import { z } from 'zod';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';

/**
 * Run workflow for Advantage Partners supplier statement fetching
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

    // Step 2: Enter credentials and login
    await page.act(`type '${username}' into the Email/Username input`);
    await page.act(`type '${password}' into the Password input`);
    await page.act(`click the Login button`);
    await page.waitForTimeout(2000);

    // Step 3: Extract all statements from the table
    const extractedStatements = await page.extract({
      instruction: `Extract all statements from the table. For each row, get the month and year.`,
      schema: z.object({
        statements: z.array(
          z.object({
            month: z.string(),
            year: z.string(),
          }),
        ),
      }),
    });

    if (
      !extractedStatements.statements ||
      extractedStatements.statements.length === 0
    ) {
      throw new Error('No statements found in the table');
    }

    // Step 4: Parse target date and find matching statement
    // Use UTC to avoid timezone issues
    const [year, month, day] = job.accounting_period_start_date
      .split('-')
      .map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const targetMonth = targetDate.toLocaleString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });
    const targetYear = targetDate.getUTCFullYear().toString();

    console.log(`Looking for statement: ${targetMonth} ${targetYear}`);
    console.log(
      `Available statements: ${extractedStatements.statements.map((s) => `${s.month} ${s.year}`).join(', ')}`,
    );

    // Find the matching statement
    const matchingStatement = extractedStatements.statements.find(
      (stmt) =>
        stmt.month.toLowerCase() === targetMonth.toLowerCase() &&
        stmt.year === targetYear,
    );

    if (!matchingStatement) {
      throw new Error(
        `No statement found for ${targetMonth} ${targetYear}. Available: ${extractedStatements.statements.map((s) => `${s.month} ${s.year}`).join(', ')}`,
      );
    }

    // Step 5: Locate the download button for the matching statement
    const downloadButtons = await page.observe(
      `Find the download button in the row with ${matchingStatement.month} ${matchingStatement.year}`,
    );

    if (!downloadButtons || downloadButtons.length === 0) {
      throw new Error(
        `Could not find download button for ${matchingStatement.month} ${matchingStatement.year}`,
      );
    }

    const buttonLocator = page.locator(downloadButtons[0].selector);

    // Step 6: Extract form data and download the file
    // Extract form data from the button
    const buttonInfo = await buttonLocator.evaluate((el: any) => {
      const form = el.closest('form');
      if (!form) {
        throw new Error('Download button is not inside a form');
      }

      const formData: any = {};
      const inputs = form.querySelectorAll('input, button, select, textarea');

      inputs.forEach((input: any) => {
        if (input.name) {
          formData[input.name] = input.value;
        }
      });

      return {
        formAction: form.action,
        formData,
        buttonName: el.name,
        buttonValue: el.value,
      };
    });

    if (!buttonInfo.formAction || !buttonInfo.buttonName) {
      throw new Error('Download button does not have expected form structure');
    }

    const postData = {
      ...buttonInfo.formData,
      [buttonInfo.buttonName]: buttonInfo.buttonValue,
    };

    const response = await page.request.post(buttonInfo.formAction, {
      form: postData,
    });

    if (!response.ok()) {
      throw new Error(
        `Failed to fetch Excel file: ${response.status()} ${response.statusText()}`,
      );
    }

    const fileBytes = await response.body();

    if (!fileBytes || fileBytes.length === 0) {
      throw new Error('Downloaded file is empty');
    }

    const statementDate = job.accounting_period_start_date;

    console.log(
      `Successfully captured Excel file: ${fileBytes.length} bytes for ${matchingStatement.month} ${matchingStatement.year}`,
    );

    return {
      success: true,
      statements: [
        {
          fileBuffer: fileBytes,
          filename: `AP_Statement_${matchingStatement.month}_${matchingStatement.year}.xlsx`,
          statementDate,
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
