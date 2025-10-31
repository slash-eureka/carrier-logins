#!/usr/bin/env node
/**
 * CLI tool for testing Bitco workflow with Playwright integration
 *
 * Usage:
 *   npm run workflow:playwright <loginUrl> <username> <password>
 *
 * Example:
 *   npm run workflow:playwright https://portal.bitco.com username password
 */

import 'dotenv/config';
import { createPlaywrightStagehandClient, closePlaywrightStagehand } from '../src/lib/stagehand-playwright-client.js';
import { runWorkflow } from '../src/workflows/com_bitco_playwright.js';
import { getErrorMessage } from '../src/lib/error-utils.js';
import type { WorkflowJob } from '../src/types/index.js';

async function main() {
  const [loginUrl, username, password] = process.argv.slice(2);

  // Validate arguments
  if (!loginUrl || !username || !password) {
    console.error(
      JSON.stringify({
        success: false,
        error: 'Missing required arguments',
        usage: 'npm run workflow:playwright <loginUrl> <username> <password>',
        examples: [
          'npm run workflow:playwright https://portal.bitco.com user pass',
        ],
      }),
    );
    process.exit(1);
  }

  let client = null;
  try {
    // Create Playwright + Stagehand client
    console.log('Creating Playwright + Stagehand client...');
    client = await createPlaywrightStagehandClient();
    console.log('Client created successfully');

    const accountingPeriodStartDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    )
      .toISOString()
      .split('T')[0];

    // Create workflow job object
    const job: WorkflowJob = {
      job_id: 'cli-test-' + Date.now(),
      credential: {
        username,
        password,
        login_url: loginUrl,
      },
      accounting_period_start_date: accountingPeriodStartDate,
    };

    // Run workflow
    console.log('Running workflow...');
    const result = await runWorkflow(
      client.stagehand,
      job,
      client.page,
      client.context,
    );

    console.log(JSON.stringify(result, null, 2));

    process.exit(result.success ? 0 : 1);
  } catch (error: unknown) {
    console.error(
      JSON.stringify(
        {
          success: false,
          error: getErrorMessage(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  } finally {
    if (client) {
      await closePlaywrightStagehand(client);
    }
  }
}

void main();
