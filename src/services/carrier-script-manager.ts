import { createStagehandClient } from '../lib/stagehand-client.js';
import type { CarrierName, CarrierCredentials, CarrierScriptResult } from '../types/index.js';

/**
 * Identify carrier from login URL
 * @param loginUrl - The carrier's login URL
 * @returns Carrier name
 */
export function identifyCarrier(loginUrl: string): CarrierName {
  try {
    const url = new URL(loginUrl);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes('abacus')) {
      return 'abacus';
    }
    if (hostname.includes('advantage') || hostname.includes('advantagepartners')) {
      return 'advantage-partners';
    }
    if (hostname.includes('amerisafe')) {
      return 'amerisafe';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Execute carrier automation script
 * @param carrierName - Name of the carrier
 * @param credentials - Login credentials
 * @returns Promise with carrier script result
 */
export async function executeCarrierScript(
  carrierName: CarrierName,
  credentials: CarrierCredentials
): Promise<CarrierScriptResult> {
  if (carrierName === 'unknown') {
    return {
      success: false,
      statements: [],
      error: `Unknown carrier for URL: ${credentials.loginUrl}`,
    };
  }

  let client;
  try {
    // Create Stagehand client
    client = await createStagehandClient();

    // Import and execute carrier script
    let runCarrierAutomation: (page: any, credentials: CarrierCredentials) => Promise<CarrierScriptResult>;

    switch (carrierName) {
      case 'abacus':
        const abacusModule = await import('../carriers/abacus.js');
        runCarrierAutomation = abacusModule.runCarrierAutomation;
        break;

      case 'advantage-partners':
        const advantageModule = await import('../carriers/advantage-partners.js');
        runCarrierAutomation = advantageModule.runCarrierAutomation;
        break;

      case 'amerisafe':
        const amerisafeModule = await import('../carriers/amerisafe.js');
        runCarrierAutomation = amerisafeModule.runCarrierAutomation;
        break;

      default:
        return {
          success: false,
          statements: [],
          error: `No script implemented for carrier: ${carrierName}`,
        };
    }

    // Execute carrier script
    const result = await runCarrierAutomation(client.page, credentials);
    return result;

  } catch (error: any) {
    return {
      success: false,
      statements: [],
      error: `Failed to execute carrier script: ${error.message}`,
    };
  } finally {
    // Always close the Stagehand client
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error('Failed to close Stagehand client:', error);
      }
    }
  }
}

/**
 * Run carrier automation workflow
 * @param credentials - Login credentials
 * @returns Promise with carrier script result
 */
export async function runCarrierAutomation(
  credentials: CarrierCredentials
): Promise<CarrierScriptResult> {
  const carrierName = identifyCarrier(credentials.loginUrl);
  return executeCarrierScript(carrierName, credentials);
}
