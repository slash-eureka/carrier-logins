import { Stagehand } from '@browserbasehq/stagehand';

// Parse command line arguments
const [username, password, loginUrl] = process.argv.slice(2);

if (!username || !password || !loginUrl) {
  console.error(JSON.stringify({
    success: false,
    error: 'Missing required arguments: username, password, loginUrl'
  }));
  process.exit(1);
}

// Get Browserbase credentials from environment
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
  console.error(JSON.stringify({
    success: false,
    error: 'Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID environment variables'
  }));
  process.exit(1);
}

if (!GOOGLE_API_KEY) {
  console.error(JSON.stringify({
    success: false,
    error: 'Missing GOOGLE_API_KEY environment variable (required for Stagehand AI actions with Gemini)'
  }));
  process.exit(1);
}

async function downloadStatement() {
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: BROWSERBASE_API_KEY,
    projectId: BROWSERBASE_PROJECT_ID,
    verbose: 1,
    modelName: 'google/gemini-2.0-flash-exp',
    disablePino: true,
    modelClientOptions: {
      apiKey: GOOGLE_API_KEY
    }
  });

  try {
    await stagehand.init();
    console.log('Stagehand initialized successfully.');

    const page = stagehand.page;

    if (!page) {
      throw new Error('Failed to get page instance from Stagehand');
    }

    // Set up listeners to catch PDF URLs from new tabs/pages
    let pdfUrl = null;

    // Listen for new pages/tabs (for PDF opening in new tab)
    page.context().on('page', async (newPage) => {
      try {
        // Wait for the new page to start loading
        await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const url = newPage.url();
        console.log('[New page/tab URL loaded]:', url);
        if (url.includes('.pdf') || url.includes('documents.abacus.net') || url.includes('/account/statements/')) {
          console.log('[PDF URL captured from new tab]:', url);
          pdfUrl = url;
        }
      } catch (err) {
        // Try to get URL even if page didn't fully load
        const url = newPage.url();
        console.log('[New page/tab detected (partial)]:', url);
        if (url && (url.includes('.pdf') || url.includes('documents.abacus.net') || url.includes('/account/statements/'))) {
          console.log('[PDF URL captured from new tab (partial)]:', url);
          pdfUrl = url;
        }
      }
    });

    // Also listen for responses in current page
    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'] || '';
      const url = response.url();

      if (contentType.includes('pdf') || url.includes('.pdf')) {
        console.log('[PDF URL intercepted]:', url);
        pdfUrl = url;
      }
    });

    // Step 1: Navigate to URL
    console.log(`Navigating to: ${loginUrl}`);
    await page.goto(loginUrl);

    // Step 2: Type username
    console.log(`Performing action: type '${username}' into the Username input`);
    await page.act(`type '${username}' into the Username input`);

    // Step 3: Type password
    console.log(`Performing action: type '${password}' into the Password input`);
    await page.act(`type '${password}' into the Password input`);

    // Step 4: Click Log In button
    console.log(`Performing action: click the Log In button`);
    await page.act(`click the Log In button`);

    // Step 5: Click My Firm menu item
    console.log(`Performing action: click the My Firm menu item`);
    await page.act(`click the My Firm menu item`);

    // Step 6: Click Statements option in dropdown
    console.log(`Performing action: click the Statements option in the dropdown`);
    await page.act(`click the Statements option in the dropdown`);

    await page.waitForTimeout(3000);

    // Step 7: Use proven Playwright selectors to find download link (from working Ruby script)
    console.log('[Finding latest statement using Playwright selectors...]');

    const pdfLinkHandle = await page.evaluateHandle(() => {
      // Try multiple selectors in order (adapted from working Ruby script)
      let link = document.querySelector('[href*=".pdf"]');

      if (!link) {
        // Find link with "Download" text
        const links = Array.from(document.querySelectorAll('a'));
        link = links.find(l => l.textContent.toLowerCase().includes('download'));
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

    const pdfLinkUrl = await page.evaluate(el => el.href, pdfLinkHandle);
    console.log('[Found statement link]:', pdfLinkUrl);

    // Navigate to statement page to intercept the S3 PDF URL
    // Note: This will throw ERR_ABORTED because PDF download aborts navigation,
    // but we catch it - the PDF URL is already intercepted by then
    console.log('[Navigating to statement to intercept PDF URL...]');
    try {
      await page.goto(pdfLinkUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
    } catch (err) {
      console.log('ignore')
    }

    await page.waitForTimeout(2000);

    if (!pdfUrl) {
      throw new Error('Could not intercept PDF URL');
    }

    console.log(JSON.stringify({
      success: true,
      pdf_url: pdfUrl
    }));

  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }));
    process.exit(1);
  } finally {
    await stagehand.close();
  }
}

downloadStatement().catch(error => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }));
  process.exit(1);
});