#!/usr/bin/env node
/**
 * CLI tool for testing carrier automation scripts
 *
 * Usage:
 *   npm run test-carrier <carrier-name> <username> <password> <loginUrl>
 *
 * Example:
 *   npm run test-carrier abacus myuser mypass https://abacus.com/login
 *   npm run test-carrier advantage-partners user pass https://advantage.com/login
 *   npm run test-carrier amerisafe user pass https://amerisafe.com/login
 */

import 'dotenv/config';
import { createStagehandClient } from '../src/lib/stagehand-client.js';

const VALID_CARRIERS = ['abacus', 'advantage-partners', 'amerisafe'] as const;
type CarrierName = typeof VALID_CARRIERS[number];

async function main() {
  const [carrierName, username, password, loginUrl] = process.argv.slice(2);

  // Validate arguments
  if (!carrierName || !username || !password || !loginUrl) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required arguments',
      usage: 'npm run test-carrier <carrier-name> <username> <password> <loginUrl>',
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
    // Import the carrier script dynamically
    const carrierModule = await import(`../src/carriers/${carrierName}.js`);

    if (typeof carrierModule.runCarrierAutomation !== 'function') {
      throw new Error(`Carrier script ${carrierName} does not export runCarrierAutomation function`);
    }

    // Create Stagehand client
    client = await createStagehandClient();

    // Run the carrier automation
    const result = await carrierModule.runCarrierAutomation(client.page, {
      username,
      password,
      loginUrl,
    });

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
