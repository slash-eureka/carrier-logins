import { Stagehand, type Page } from '@browserbasehq/stagehand';
import { config } from '../config/index.js';

export interface StagehandClient {
  stagehand: Stagehand;
  page: Page;
  close: () => Promise<void>;
}

/**
 * Creates and initializes a Stagehand client with standard configuration
 * @returns Initialized Stagehand client with page instance
 */
export async function createStagehandClient(): Promise<StagehandClient> {
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: config.browserbase.apiKey,
    projectId: config.browserbase.projectId,
    verbose: 1,
    modelName: 'google/gemini-2.0-flash-exp',
    disablePino: true,
    modelClientOptions: {
      apiKey: config.gemini.apiKey,
    },
  });

  await stagehand.init();

  if (!stagehand.page) {
    throw new Error('Failed to initialize Stagehand page');
  }

  return {
    stagehand,
    page: stagehand.page,
    close: async () => {
      await stagehand.close();
    },
  };
}
