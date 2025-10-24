#!/usr/bin/env node
/**
 * CLI tool for testing carrier workflow scripts
 *
 * Usage:
 *   npm run workflow <loginUrl> <username> <password>
 *
 * Example:
 *   npm run workflow https://abacus.net/login myuser mypass
 */

import 'dotenv/config';
import { createStagehandClient } from '../src/lib/stagehand-client.js';
import * as workflow from '../src/services/workflow-manager.js';
import type { WorkflowJob } from '../src/types/index.js';

async function main() {
  const [loginUrl, username, password] = process.argv.slice(2);

  // Validate arguments
  if (!loginUrl || !username || !password) {
    console.error(
      JSON.stringify({
        success: false,
        error: 'Missing required arguments',
        usage: 'npm run workflow <loginUrl> <username> <password>',
        examples: [
          'npm run workflow https://abacus.net/login myuser mypass',
          'npm run workflow https://advantagepartners.com/login user pass',
        ],
      }),
    );
    process.exit(1);
  }

  // Identify carrier from login URL
  const carrierSlug = workflow.identify(loginUrl);

  if (carrierSlug === 'unknown') {
    console.error(
      JSON.stringify({
        success: false,
        error: `Could not identify carrier from URL: ${loginUrl}`,
        hint: 'Make sure the URL contains a supported carrier domain',
      }),
    );
    process.exit(1);
  }

  let client;
  try {
    // Import the workflow script dynamically
    const workflowModule = await import(`../src/workflows/${carrierSlug}.js`);

    if (typeof workflowModule.runWorkflow !== 'function') {
      throw new Error(
        `Workflow script ${carrierSlug} does not export runWorkflow function`,
      );
    }

    // Create Stagehand client
    client = await createStagehandClient();

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

    // Run the workflow
    const result = await workflowModule.runWorkflow(client.stagehand, job);

    console.log(JSON.stringify(result, null, 2));

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error(
      JSON.stringify(
        {
          success: false,
          error: error.message,
          stack: error.stack,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

main();
