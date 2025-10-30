/**
 * Bitco workflow script
 * Logs into Bitco portal and retrieves commission statement PDFs
 */

/* eslint-disable */

import { z } from 'zod';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult, Statement } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';

/**
 * Run workflow for Bitco supplier statement fetching
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
    // Login
    await page.goto(loginUrl);
    await page.act(`type '${username}' into the User Name input`);
    await page.act(`type '${password}' into the Password input`);
    await page.act(`click the Login button`);
    await page.waitForTimeout(2000);

    // Navigate to statements
    await page.act(`click the AGENCY INFO menu item`);
    await page.act(
      `click the Show dropdown in the Direct Bill Statements section`,
    );
    await page.act(`click the All option in the Show dropdown`);
    await page.waitForTimeout(2000);

    // Parse target date for filtering
    const targetDate = new Date(job.accounting_period_start_date);

    // Extract statement rows with dates and agency numbers
    // (extract can see shadow DOM content even though observe can't get selectors)
    const extractedData = await page.extract({
      instruction: `Extract all Direct Bill Commission Statement rows from the table with:
      - Agency number
      - Statement date in MM/DD/YYYY format
      - Row number (1, 2, 3, etc.) counting from top to bottom`,
      schema: z.object({
        statements: z.array(
          z.object({
            agency: z.string(),
            statementDate: z.string(),
            rowNumber: z.number(),
          }),
        ),
      }),
    });

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

    // Download each PDF using route interception
    const statements: Statement[] = [];

    for (let i = 0; i < filteredStatements.length; i++) {
      const stmt = filteredStatements[i];
      console.log(
        `Downloading statement ${i + 1}/${filteredStatements.length}: Agency ${stmt.agency}, Date ${stmt.statementDate}`,
      );

      // Set up PDF capture via route interception
      let pdfBuffer: Buffer | null = null;

      await page.route('**/*', async (route: any) => {
        try {
          const response = await route.fetch();
          const contentType = response.headers()['content-type'] || '';

          // Check if this is a PDF response
          if (
            contentType.includes('pdf') ||
            response.url().includes('Document=')
          ) {
            const buffer = (await response.body()) as Buffer;

            if (buffer && buffer.length > 0) {
              pdfBuffer = buffer;
              console.log('PDF captured, size:', buffer.length);
            }
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

      try {
        // Click using natural language instruction (works with shadow DOM)
        // Be specific with agency number and date to target the right row
        await page.act(
          `click the Direct Bill Commission Statement link for Agency ${stmt.agency} with statement date ${stmt.statementDate}`,
        );

        // Wait for PDF capture with timeout
        const startTime = Date.now();
        while (!pdfBuffer && Date.now() - startTime < 8000) {
          await page.waitForTimeout(500);
        }

        // Close any blob URL tabs or PDF tabs that opened
        try {
          const pages = page.context().pages();
          for (const p of pages) {
            if (p !== page) {
              await p.close();
            }
          }
        } catch (err) {
          console.log('Error closing popup pages:', err);
        }

        if (!pdfBuffer) {
          console.warn(
            `Failed to capture PDF for Agency ${stmt.agency}, Date ${stmt.statementDate}`,
          );
          await page.unroute('**/*');
          continue;
        }

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
          `First 16 bytes of PDF: ${pdfBuffer!.slice(0, 16).toString('hex')}`,
        );
      } catch (err: any) {
        console.error(
          `Error downloading statement for Agency ${stmt.agency}:`,
          err.message,
        );
        // Continue to next statement
      } finally {
        // Remove route handler
        await page.unroute('**/*');

        // Small delay between downloads
        await page.waitForTimeout(1000);
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
