import { createStagehandClient } from '../lib/stagehand-client.js';
import type { CarrierName, WorkflowJob, WorkflowResult } from '../types/index.js';

/**
 * Identify carrier from login URL using reverse domain notation with underscores
 * @param loginUrl - The carrier's login URL
 * @returns Carrier name in reverse domain notation (e.g., "net_abacus")
 */
export function identifyCarrier(loginUrl: string): CarrierName {
  try {
    const url = new URL(loginUrl);
    const hostname = url.hostname.toLowerCase();

    // Extract reverse domain slug (TLD + domain name)
    const carrierSlug = extractReverseDomainSlug(hostname);

    // Map reverse domain slugs to canonical carrier names
    // Some carriers may have multiple domains, so we normalize to canonical slug
    const canonicalSlug = getCanonicalCarrierSlug(carrierSlug);

    return canonicalSlug;
  } catch {
    return 'unknown';
  }
}

/**
 * Extract reverse domain notation from hostname with underscores
 * Takes the TLD and domain name (last 2 parts), reverses, and joins with underscores
 * @param hostname - Full hostname (e.g., "portal.abacus.net")
 * @returns Reverse domain slug (e.g., "net_abacus")
 */
function extractReverseDomainSlug(hostname: string): string {
  const parts = hostname.split('.');

  if (parts.length < 2) {
    return hostname.replace(/\./g, '_');
  }

  // Extract the last 2 parts (domain + TLD)
  const tld = parts[parts.length - 1];
  const domain = parts[parts.length - 2];

  // Return reversed with underscores: "abacus.net" -> "net_abacus"
  return `${tld}_${domain}`;
}

/**
 * Map reverse domain slugs to canonical carrier names
 * Handles cases where carriers use multiple domains
 * @param slug - Reverse domain slug (e.g., "net_abacus" or "com_abacus")
 * @returns Canonical carrier name
 */
function getCanonicalCarrierSlug(slug: string): CarrierName {
  switch (slug) {
    case 'net_abacus':
      return 'net_abacus';

    case 'com_advantage':
    case 'com_advantagepartners':
      return 'com_advantagepartners';

    case 'com_amerisafe':
      return 'com_amerisafe';

    default:
      return 'unknown';
  }
}

/**
 * Execute workflow for a carrier
 * @param carrierName - Name of the carrier
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with workflow result
 */
export async function executeWorkflow(
  carrierName: CarrierName,
  job: WorkflowJob
): Promise<WorkflowResult> {
  if (carrierName === 'unknown') {
    return {
      success: false,
      statements: [],
      error: `Unknown carrier for URL: ${job.login_url}`,
    };
  }

  let client;
  try {
    // Create Stagehand client
    client = await createStagehandClient();

    // Import and execute workflow script
    let workflowModule: { runWorkflow: typeof import('../workflows/net_abacus.js').runWorkflow };

    switch (carrierName) {
      case 'net_abacus':
        workflowModule = await import('../workflows/net_abacus.js');
        break;

      case 'com_advantagepartners':
        workflowModule = await import('../workflows/com_advantagepartners.js');
        break;

      case 'com_amerisafe':
        workflowModule = await import('../workflows/com_amerisafe.js');
        break;

      default:
        return {
          success: false,
          statements: [],
          error: `No workflow script implemented for carrier: ${carrierName}`,
        };
    }

    // Execute workflow
    const result = await workflowModule.runWorkflow(client.stagehand, job);
    return result;

  } catch (error: any) {
    return {
      success: false,
      statements: [],
      error: `Failed to execute workflow: ${error.message}`,
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
 * Run workflow for supplier statement fetching
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with workflow result
 */
export async function runWorkflow(
  job: WorkflowJob
): Promise<WorkflowResult> {
  const carrierName = identifyCarrier(job.login_url);
  return executeWorkflow(carrierName, job);
}
