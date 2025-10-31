/**
 * Bitco workflow script with Playwright integration
 * Logs into Bitco portal and retrieves commission statement PDFs
 * Uses Playwright for full browser control + Stagehand for AI-powered actions
 */

/* eslint-disable */

import { z } from 'zod';
import type { Page, BrowserContext } from 'playwright';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult, Statement } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { debugRepl } from '../lib/debug-repl.js';

export interface PlaywrightWorkflowParams {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
  job: WorkflowJob;
}

/**
 * Run workflow for Bitco supplier statement fetching with Playwright integration
 * @param params - Playwright page, context, Stagehand instance, and job
 * @returns Promise with success status and statements
 */
export async function runWorkflow(
  stagehand: Stagehand,
  job: WorkflowJob,
  page?: Page,
  context?: BrowserContext,
): Promise<WorkflowResult> {
  // Use provided Playwright context, or fall back to Stagehand's context
  const workingContext = context || stagehand.context;
  const workingPage = page; // Optional Playwright page for explicit operations

  const { username, password, login_url: loginUrl } = job.credential;

  try {
    // Login - use Stagehand's page internally, or Playwright page if provided
    if (workingPage) {
      await workingPage.goto(loginUrl);
      await stagehand.act(`type '${username}' into the User Name input`, { page: workingPage });
      await stagehand.act(`type '${password}' into the Password input`, { page: workingPage });
      await stagehand.act(`click the Login button`, { page: workingPage });
    } else {
      // Fall back to Stagehand's internal page
      await stagehand.page.goto(loginUrl);
      await stagehand.act(`type '${username}' into the User Name input`);
      await stagehand.act(`type '${password}' into the Password input`);
      await stagehand.act(`click the Login button`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 🔍 Interactive breakpoint - comment out when not debugging
    await debugRepl(stagehand);

    // Navigate to statements
    if (workingPage) {
      await stagehand.act(`click the AGENCY INFO menu item`, { page: workingPage });
      await stagehand.act(
        `click the Show dropdown in the Direct Bill Statements section`,
        { page: workingPage }
      );
      await stagehand.act(`click the All option in the Show dropdown`, { page: workingPage });
    } else {
      await stagehand.act(`click the AGENCY INFO menu item`);
      await stagehand.act(
        `click the Show dropdown in the Direct Bill Statements section`
      );
      await stagehand.act(`click the All option in the Show dropdown`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Parse target date for filtering
    const targetDate = new Date(job.accounting_period_start_date);

    // Extract statement rows with dates and agency numbers
    const extractedData = workingPage
      ? await stagehand.extract(
          `Extract all Direct Bill Commission Statement rows from the table with:
          - Agency number
          - Statement date in MM/DD/YYYY format
          - Row number (1, 2, 3, etc.) counting from top to bottom`,
          z.object({
            statements: z.array(
              z.object({
                agency: z.string(),
                statementDate: z.string(),
                rowNumber: z.number(),
              }),
            ),
          }),
          { page: workingPage }
        )
      : await stagehand.extract(
          `Extract all Direct Bill Commission Statement rows from the table with:
          - Agency number
          - Statement date in MM/DD/YYYY format
          - Row number (1, 2, 3, etc.) counting from top to bottom`,
          z.object({
            statements: z.array(
              z.object({
                agency: z.string(),
                statementDate: z.string(),
                rowNumber: z.number(),
              }),
            ),
          })
        );

    // Filter statements by accounting period date
    const filteredStatements = (extractedData.statements || []).filter(
      (stmt) => {
        try {
          const [month, day, year] = stmt.statementDate.split('/');
          const stmtDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );
          return stmtDate >= targetDate;
        } catch {
          return false;
        }
      },
    );

    if (filteredStatements.length === 0) {
      console.log(
        `No statements found for accounting period >= ${job.accounting_period_start_date}`,
      );
      return {
        success: true,
        statements: [],
      };
    }

    console.log(
      `Found ${filteredStatements.length} statements to download for accounting period`,
    );

    // Download PDFs using Playwright's page event handling
    const statements: Statement[] = [];

    for (let i = 0; i < filteredStatements.length; i++) {
      const stmt = filteredStatements[i];
      console.log(
        `Downloading statement ${i + 1}/${filteredStatements.length}: Agency ${stmt.agency}, Date ${stmt.statementDate}`,
      );

      try {
        // Set up listener for new page/popup
        const popupPromise = workingContext.waitForEvent('page', { timeout: 10000 });

        // Click the statement link
        if (workingPage) {
          await stagehand.act(
            `click the Direct Bill Commission Statement link for Agency ${stmt.agency} with statement date ${stmt.statementDate}`,
            { page: workingPage }
          );
        } else {
          await stagehand.act(
            `click the Direct Bill Commission Statement link for Agency ${stmt.agency} with statement date ${stmt.statementDate}`
          );
        }

        // Wait for popup/new tab
        const pdfPage = await popupPromise;
        await pdfPage.waitForLoadState('load', { timeout: 10000 });

        console.log('PDF page opened:', pdfPage.url());

        // Get the PDF content
        const response = await pdfPage.goto(pdfPage.url());
        if (!response) {
          throw new Error('No response from PDF page');
        }

        const pdfBuffer = await response.body();

        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('PDF buffer is empty');
        }

        console.log(`PDF captured: ${pdfBuffer.length} bytes`);

        // Close the PDF page
        await pdfPage.close();

        // Generate filename from metadata
        const dateForFilename = stmt.statementDate.replace(/\//g, '-');
        const filename = `Bitco_Statement_Agency${stmt.agency}_${dateForFilename}.pdf`;

        // Normalize date to YYYY-MM-DD format
        const [month, day, year] = stmt.statementDate.split('/');
        const normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        statements.push({
          pdfBuffer,
          pdfFilename: filename,
          statementDate: normalizedDate,
        });

        console.log(`Successfully captured: ${filename}`);
        console.log(
          `First 16 bytes of PDF: ${pdfBuffer.slice(0, 16).toString('hex')}`,
        );

        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err: any) {
        console.error(
          `Error downloading statement for Agency ${stmt.agency}:`,
          err.message,
        );
        // Continue to next statement
      }
    }

    return {
      success: true,
      statements,
    };
  } catch (error: unknown) {
    return {
      success: false,
      statements: [],
      error: getErrorMessage(error),
    };
  }
}
