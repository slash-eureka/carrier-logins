/**
 * Abacus workflow script
 * Logs into Abacus portal and retrieves commission statement PDF URLs
 */

/* eslint-disable */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { debugRepl } from '../lib/debug-repl.js';

/**
 * Run workflow for Abacus supplier statement fetching
 * @param stagehand - Stagehand client instance
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with success status and statements
 */
export async function runWorkflow(
  stagehand: Stagehand,
  job: WorkflowJob,
): Promise<WorkflowResult> {
  const { username, password, login_url: loginUrl } = job.credential;
  const page = stagehand.context.pages()[0];

  try {
    // Set up listeners to catch PDF URLs from new tabs/pages
    let pdfUrl: string | null = null;

    // // Listen for new pages/tabs (for PDF opening in new tab)
    // stagehand.context.on('page', async (newPage: any) => {
    //   try {
    //     // Wait for the new page to start loading
    //     await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
    //     const url = newPage.url();
    //     if (
    //       url.includes('.pdf') ||
    //       url.includes('documents.abacus.net') ||
    //       url.includes('/account/statements/')
    //     ) {
    //       pdfUrl = url;
    //     }
    //   } catch {
    //     // Try to get URL even if page didn't fully load
    //     const url = newPage.url();
    //     if (
    //       url &&
    //       (url.includes('.pdf') ||
    //         url.includes('documents.abacus.net') ||
    //         url.includes('/account/statements/'))
    //     ) {
    //       pdfUrl = url;
    //     }
    //   }
    // });
    //
    // // Also listen for responses in current page
    // page.on('response', async (response: any) => {
    //   const contentType = response.headers()['content-type'] || '';
    //   const url = response.url();
    //
    //   if (contentType.includes('pdf') || url.includes('.pdf')) {
    //     pdfUrl = url;
    //   }
    // });

    // Step 1: Navigate to URL
    await page.goto(loginUrl);

    // Step 2: Type username
    await stagehand.act(`type '${username}' into the Username input`);

    // Step 3: Type password
    await stagehand.act(`type '${password}' into the Password input`);

    // Step 4: Click Log In button
    await stagehand.act(`click the Log In button`);

    // Step 5: Click My Firm menu item
    await stagehand.act(`click the My Firm menu item`);

    // Step 6: Click Statements option in dropdown
    await stagehand.act(`click the Statements option in the dropdown`);

    await debugRepl(stagehand);
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 7: Retrieve the statement button for specified accounting period
    const buttons = await stagehand.observe(
      `Find the Download button for the Statement with billing period of ${job.accounting_period_start_date}`,
    );
    const buttonSelector = buttons[0].selector;
    const pdfLinkUrl = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      return element ? (element as HTMLAnchorElement).href : null;
    }, buttonSelector);

    if (!pdfLinkUrl) {
      throw new Error('Could not find PDF download link');
    }

    // Navigate to statement page to intercept the S3 PDF URL
    // Note: This may throw ERR_ABORTED because PDF download aborts navigation
    try {
      await page.goto(pdfLinkUrl, {
        waitUntil: 'domcontentloaded',
        timeoutMs: 5000,
      });
    } catch {
      // Ignore navigation errors - PDF URL should be intercepted by now
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    debugRepl(stagehand);

    if (!pdfUrl) {
      throw new Error('Could not intercept PDF URL');
    }

    return {
      success: true,
      statements: [
        {
          pdfUrl,
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
