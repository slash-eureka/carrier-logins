/**
 * Creates Stagehand client with Playwright integration
 * This allows using both Stagehand AI methods and Playwright's full API
 *
 * Integration approach:
 * 1. Initialize Stagehand first (creates browser)
 * 2. Connect Playwright to Stagehand's browser via CDP
 * 3. Use both APIs together
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { Stagehand } from '@browserbasehq/stagehand';
import { config } from '../config/index.js';

export interface PlaywrightStagehandClient {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  stagehand: Stagehand;
}

/**
 * Creates and initializes a Stagehand client integrated with Playwright
 * @returns Playwright browser, context, page, and Stagehand instance
 */
export async function createPlaywrightStagehandClient(): Promise<PlaywrightStagehandClient> {
  // 1. Create and initialize Stagehand first
  const stagehand = new Stagehand({
    // env: 'BROWSERBASE',
    env: 'LOCAL',
    verbose: 1,
    localBrowserLaunchOptions: {
      headless: false,
      devtools: true,
      viewport: { width: 1280, height: 720 },
      userDataDir: './chrome',
      preserveUserDataDir: true,
      chromiumSandbox: false,
      locale: 'en-US',
      acceptDownloads: true,
    },
    apiKey: config.browserbase.apiKey,
    projectId: config.browserbase.projectId,
    model: {
      modelName: 'google/gemini-2.0-flash-exp',
      apiKey: config.gemini.apiKey,
    },
  });

  await stagehand.init();

  // 2. Connect Playwright to Stagehand's browser via CDP
  const browser = await chromium.connectOverCDP({
    wsEndpoint: stagehand.connectURL(),
  });

  // 3. Get the browser context and page
  // Wait a moment for context to be fully initialized
  await new Promise(resolve => setTimeout(resolve, 3000));

  const contexts = browser.contexts();
  console.log(`Found ${contexts.length} browser contexts`);

  if (contexts.length === 0) {
    throw new Error('No browser contexts found after connecting to Stagehand');
  }

  const context = contexts[0];
  const pages = context.pages();
  console.log(`Found ${pages.length} pages in context`);

  // If no pages exist, create one
  let page: Page;
  if (pages.length === 0) {
    console.log('Creating new page...');
    page = await context.newPage();
  } else {
    page = pages[0];
  }

  return {
    browser,
    context,
    page,
    stagehand,
  };
}

/**
 * Close all resources
 */
export async function closePlaywrightStagehand(client: PlaywrightStagehandClient): Promise<void> {
  await client.stagehand.close();
  await client.browser.close();
}
