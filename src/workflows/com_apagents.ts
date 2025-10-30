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

    // Step 2: Type username into Email/Username input
    await page.act(`type '${username}' into the Email/Username input`);

    // Step 3: Type password into Password input
    await page.act(`type '${password}' into the Password input`);

    // Step 4: Click Login button
    await page.act(`click the Login button`);

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Step 5: Find the download button and extract its URL
    const downloadButtons = await page.observe(
      `Find the first download button in row 1`
    );
    
    if (!downloadButtons || downloadButtons.length === 0) {
      throw new Error('Could not find download button');
    }

    const buttonLocator = page.locator(downloadButtons[0].selector);
    
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

    // Download the Excel file by submitting the form via POST
    if (!buttonInfo.formAction || !buttonInfo.buttonName) {
      throw new Error('Download button does not have expected form structure');
    }

    // Add the button's name/value to form data
    const postData = {
      ...buttonInfo.formData,
      [buttonInfo.buttonName]: buttonInfo.buttonValue,
    };
    
    const response = await page.request.post(buttonInfo.formAction, {
      form: postData,
    });
    
    if (!response.ok()) {
      throw new Error(`Failed to fetch Excel file: ${response.status()} ${response.statusText()}`);
    }

    const fileBytes = await response.body();

    if (!fileBytes || fileBytes.length === 0) {
      throw new Error('Downloaded file is empty');
    }

    // Step 6: Extract metadata about the statement
    const extractedData = await page.extract({
      instruction: `Extract the details of the first statement in the table (row 1) including the date, filename, month, year, and parent name`,
      schema: z.object({
        date: z.string().optional(),
        filename: z.string().optional(),
        month: z.string().optional(),
        year: z.string().optional(),
        parentName: z.string().optional(),
      }),
    });

    // Use the extracted date or fall back to accounting period from job
    const statementDate = extractedData?.date || job.accounting_period_start_date;

    console.log(`Successfully captured Excel file: ${fileBytes.length} bytes for statement date ${statementDate}`);

    return {
      success: true,
      statements: [
        {
          pdfBuffer: fileBytes, // Store as pdfBytes for now (can rename field later)
          pdfFilename: `AP_Statement_${statementDate}.xlsx`,
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

