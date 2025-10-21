#!/usr/bin/env node
/**
 * CLI tool for testing carrier workflow scripts
 *
 * Usage:
 *   npm run test-workflow <carrier-name> <username> <password> <loginUrl>
 *
 * Example:
 *   npm run test-workflow abacus myuser mypass https://abacus.com/login
 *   npm run test-workflow advantage-partners user pass https://advantage.com/login
 *   npm run test-workflow amerisafe user pass https://amerisafe.com/login
 */

import 'dotenv/config';
import { createStagehandClient } from '../src/lib/stagehand-client.js';
import type { WorkflowJob } from '../src/types/index.js';

const VALID_CARRIERS = ['net_abacus', 'com_advantagepartners', 'com_amerisafe'] as const;
type CarrierName = typeof VALID_CARRIERS[number];

async function main() {
  const [carrierName, username, password, loginUrl] = process.argv.slice(2);

  // Validate arguments
  if (!carrierName || !username || !password || !loginUrl) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required arguments',
      usage: 'npm run test-workflow <carrier-name> <username> <password> <loginUrl>',
      validCarriers: VALID_CARRIERS,
    }));
    process.exit(1);
  }

  // Validate carrier name
  if (!VALID_CARRIERS.includes(carrierName as CarrierName)) {
    console.error(JSON.stringify({
      success: false,
      error: `Invalid carrier name: ${carrierName}`,
      validCarriers: VALID_CARRIERS,
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
      organization_id: 'cli-test-org',
      username,
      password,
      login_url: loginUrl,
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
