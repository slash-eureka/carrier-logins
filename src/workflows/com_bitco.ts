/**
 * Bitco workflow script
 * Logs into Bitco portal and retrieves commission statement PDF URLs
 */

/* eslint-disable */

import { z } from 'zod';
import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
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
    // Step 1: Navigate to login page
    await page.goto(loginUrl);

    // Step 2: Enter username
    await page.act(`type '${username}' into the User Name input`);

    // Step 3: Enter password
    await page.act(`type '${password}' into the Password input`);

    // Step 4: Click Login button
    await page.act(`click the Login button`);

    // Step 5: Navigate to AGENCY INFO
    await page.act(`click the AGENCY INFO menu item`);

    // Step 6: Show all Direct Bill Statements
    await page.act(
      `click the Show dropdown in the Direct Bill Statements section`,
    );

    // Step 7: Select "All" to show all statements
    await page.act(`click the All option in the dropdown`);

    // Wait for table to update
    await page.waitForTimeout(2000);

    // Extract all statements from the current page
    const allStatements: Array<{
      url: string;
      statementDate: string;
    }> = [];

    // Track which pages we've visited to avoid infinite loops
    const visitedPages = new Set<number>();
    let currentPage = 1;
    visitedPages.add(currentPage);

    // Function to extract statements from current page
    const extractCurrentPageStatements = async () => {
      const extractedData = await page.extract({
        instruction: `Extract the URLs of all Direct Bill Commission Statement links in the table, along with their statement dates in YYYY-MM-DD format`,
        schema: z.object({
          statements: z.array(
            z.object({
              statementDate: z.string(),
              url: z.string(),
            }),
          ),
        }),
      });

      return extractedData.statements || [];
    };

    // Extract statements from first page
    const firstPageStatements = await extractCurrentPageStatements();
    allStatements.push(...firstPageStatements);

    // Check if there are multiple pages by trying to navigate to page 2
    try {
      // Try to find and click page 2
      const page2Observations = await page.observe({
        instruction: `Find the page 2 link in the Direct Bill Statements pagination`,
        returnAction: false,
      });

      if (page2Observations && page2Observations.length > 0) {
        // There's pagination - navigate through all pages
        await page.act(
          `click the page 2 link in the Direct Bill Statements section`,
        );
        await page.waitForTimeout(2000);
        currentPage = 2;
        visitedPages.add(currentPage);

        // Extract from page 2
        const page2Statements = await extractCurrentPageStatements();
        allStatements.push(...page2Statements);

        // Continue checking for more pages (3, 4, etc.)
        let hasMorePages = true;
        while (hasMorePages && currentPage < 20) {
          // Safety limit
          const nextPage = currentPage + 1;

          try {
            const nextPageObservations = await page.observe({
              instruction: `Find the page ${nextPage} link in the Direct Bill Statements pagination`,
              returnAction: false,
            });

            if (nextPageObservations && nextPageObservations.length > 0) {
              await page.act(
                `click the page ${nextPage} link in the Direct Bill Statements section`,
              );
              await page.waitForTimeout(2000);
              currentPage = nextPage;
              visitedPages.add(currentPage);

              const pageStatements = await extractCurrentPageStatements();
              allStatements.push(...pageStatements);
            } else {
              hasMorePages = false;
            }
          } catch {
            hasMorePages = false;
          }
        }
      }
    } catch {
      // No pagination or only one page - that's fine
    }

    // Remove duplicates based on URL
    const uniqueStatements = Array.from(
      new Map(allStatements.map((s) => [s.url, s])).values(),
    );

    // Convert to the expected Statement format
    const statements = uniqueStatements.map((s) => ({
      pdfUrl: s.url,
      statementDate: s.statementDate,
    }));

    if (statements.length === 0) {
      throw new Error('No commission statements found');
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
