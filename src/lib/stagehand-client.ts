import { Stagehand } from '@browserbasehq/stagehand';
import { config } from '../config/index.js';

/**
 * Creates and initializes a Stagehand client with standard configuration
 * @returns Initialized Stagehand client with page instance
 */
export async function createStagehandClient(): Promise<Stagehand> {
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    // env: 'LOCAL',
    localBrowserLaunchOptions: {
      headless: false, // Show browser window
      devtools: true, // Open developer tools
      viewport: { width: 1280, height: 720 },
      // executablePath: '/opt/google/chrome/chrome', // Custom Chrome path
      // args: [
      //   '--no-sandbox',
      //   '--disable-setuid-sandbox',
      //   '--disable-web-security',
      //   '--allow-running-insecure-content',
      // ],
      userDataDir: './chrome', // Persist browser data
      preserveUserDataDir: true, // Keep data after closing
      chromiumSandbox: false, // Disable sandbox (adds --no-sandbox)
      ignoreHTTPSErrors: false, // Ignore certificate errors
      locale: 'en-US', // Set browser language
      deviceScaleFactor: 1.0, // Display scaling
      // proxy: {
      //   server: 'http://proxy.example.com:8080',
      //   username: 'user',
      //   password: 'pass',
      // },
      downloadsPath: './downloads', // Download directory
      acceptDownloads: true, // Allow downloads
      connectTimeoutMs: 30000, // Connection timeout
    },
    apiKey: config.browserbase.apiKey,
    projectId: config.browserbase.projectId,
    verbose: 1,
    model: {
      modelName: 'google/gemini-2.0-flash-exp',
      apiKey: config.gemini.apiKey,
    },
    cacheDir: 'stagehand_cache',
  });

  await stagehand.init();

  return stagehand;
}
