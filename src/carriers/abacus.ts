/**
 * Abacus carrier automation script
 * Logs into Abacus portal and retrieves commission statement PDF URLs
 */

import type { CarrierCredentials, CarrierScriptResult } from '../types/index.js';

/**
 * Run carrier automation for Abacus
 * @param page - Stagehand page instance
 * @param credentials - Login credentials
 * @returns Promise with success status and statements
 */
export async function runCarrierAutomation(
  page: any,
  credentials: CarrierCredentials
): Promise<CarrierScriptResult> {
  const { username, password, loginUrl } = credentials;

  try {
    // Set up listeners to catch PDF URLs from new tabs/pages
    let pdfUrl: string | null = null;

    // Listen for new pages/tabs (for PDF opening in new tab)
    page.context().on('page', async (newPage: any) => {
      try {
        // Wait for the new page to start loading
        await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const url = newPage.url();
        if (url.includes('.pdf') || url.includes('documents.abacus.net') || url.includes('/account/statements/')) {
          pdfUrl = url;
        }
      } catch (err) {
        // Try to get URL even if page didn't fully load
        const url = newPage.url();
        if (url && (url.includes('.pdf') || url.includes('documents.abacus.net') || url.includes('/account/statements/'))) {
          pdfUrl = url;
        }
      }
    });

    // Also listen for responses in current page
    page.on('response', async (response: any) => {
      const contentType = response.headers()['content-type'] || '';
      const url = response.url();

      if (contentType.includes('pdf') || url.includes('.pdf')) {
        pdfUrl = url;
      }
    });

    // Step 1: Navigate to URL
    await page.goto(loginUrl);

    // Step 2: Type username
    await page.act(`type '${username}' into the Username input`);

    // Step 3: Type password
    await page.act(`type '${password}' into the Password input`);

    // Step 4: Click Log In button
    await page.act(`click the Log In button`);

    // Step 5: Click My Firm menu item
    await page.act(`click the My Firm menu item`);

    // Step 6: Click Statements option in dropdown
    await page.act(`click the Statements option in the dropdown`);

    await page.waitForTimeout(3000);

    // Step 7: Use proven Playwright selectors to find download link
    const pdfLinkHandle = await page.evaluateHandle(() => {
      // Try multiple selectors in order
      let link = document.querySelector('[href*=".pdf"]');

      if (!link) {
        // Find link with "Download" text
        const links = Array.from(document.querySelectorAll('a'));
        link = links.find(l => l.textContent!.toLowerCase().includes('download'));
      }

      if (!link) {
        // Try first link in table rows
        link = document.querySelector('tr:first-child a, .statement-row:first-child a, table a');
      }

      return link;
    });

    if (!pdfLinkHandle || !(await pdfLinkHandle.asElement())) {
      throw new Error('Could not find PDF link on statements page');
    }

    const pdfLinkUrl = await page.evaluate((el: any) => el.href, pdfLinkHandle);

    // Navigate to statement page to intercept the S3 PDF URL
    // Note: This may throw ERR_ABORTED because PDF download aborts navigation
    try {
      await page.goto(pdfLinkUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
    } catch (err) {
      // Ignore navigation errors - PDF URL should be intercepted by now
    }

    await page.waitForTimeout(2000);

    if (!pdfUrl) {
      throw new Error('Could not intercept PDF URL');
    }

    // Extract statement date from URL or filename if possible
    // For now, we'll use current date as fallback
    const statementDate = new Date().toISOString().split('T')[0];

    return {
      success: true,
      statements: [
        {
          pdfUrl,
          statementDate,
          filename: 'abacus_statement.pdf',
        },
      ],
    };
  } catch (error: any) {
    return {
      success: false,
      statements: [],
      error: error.message,
    };
  }
}
