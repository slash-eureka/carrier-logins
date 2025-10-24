#!/usr/bin/env node
/**
 * CLI tool for testing carrier workflow scripts
 *
 * Usage:
 *   npm run workflow <username> <password> <loginUrl>
 *
 * Example:
 *   npm run workflow myuser mypass https://abacus.net/login
 *   npm run workflow user pass https://advantagepartners.com/login
 *   npm run workflow user pass https://amerisafe.com/login
 */

import 'dotenv/config';
import { createStagehandClient } from '../src/lib/stagehand-client.js';
import { identifyCarrier } from '../src/services/workflow-manager.js';
import type { WorkflowJob } from '../src/types/index.js';

async function main() {
  const [username, password, loginUrl] = process.argv.slice(2);

  // Validate arguments
  if (!username || !password || !loginUrl) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required arguments',
      usage: 'npm run workflow <username> <password> <loginUrl>',
      examples: [
        'npm run workflow myuser mypass https://abacus.net/login',
        'npm run workflow user pass https://advantagepartners.com/login',
      ],
    }));
    process.exit(1);
  }

  // Identify carrier from login URL
  const carrierName = identifyCarrier(loginUrl);

  if (carrierName === 'unknown') {
    console.error(JSON.stringify({
      success: false,
      error: `Could not identify carrier from URL: ${loginUrl}`,
      hint: 'Make sure the URL contains a supported carrier domain',
    }));
    process.exit(1);
  }

  let client;
  try {
    // Import the workflow script dynamically
    const workflowModule = await import(`../src/workflows/${carrierName}.js`);

    if (typeof workflowModule.runWorkflow !== 'function') {
      throw new Error(`Workflow script ${carrierName} does not export runWorkflow function`);
    }

    // Create Stagehand client
    client = await createStagehandClient();

    // Create workflow job object
    const job: WorkflowJob = {
      job_id: 'cli-test-' + Date.now(),
      credential: {
        username,
        password,
        login_url: loginUrl,
      },
      accounting_period_start_date: '1970-01-01', // Get all statements for CLI testing
    };

    // Run the workflow
    const result = await workflowModule.runWorkflow(client.stagehand, job);

    // Output result as JSON
    console.log(JSON.stringify(result, null, 2));

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
    }, null, 2));
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

main();
