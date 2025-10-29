import * as Sentry from '@sentry/node';
import { createStagehandClient } from '../lib/stagehand-client.js';
import { getErrorMessage } from '../lib/error-utils.js';
import type {
  CarrierSlug,
  WorkflowJob,
  WorkflowResult,
} from '../types/index.js';

/**
 * Identify carrier from login URL using reverse domain notation with underscores
 * @param loginUrl - The carrier's login URL
 * @returns Carrier slug in reverse domain notation (e.g., "net_abacus")
 */
export function identify(loginUrl: string): CarrierSlug {
  try {
    const url = new URL(loginUrl);
    const hostname = url.hostname.toLowerCase();
    return extractReverseDomainSlug(hostname);
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
 * Execute workflow for a carrier
 * @param carrierSlug - Carrier slug in reverse domain notation
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with workflow result
 */
export async function executeWorkflow(
  carrierSlug: CarrierSlug,
  job: WorkflowJob,
): Promise<WorkflowResult> {
  if (carrierSlug === 'unknown') {
    return {
      success: false,
      statements: [],
      error: `Unknown carrier for URL: ${job.credential.login_url}`,
    };
  }

  let client;
  try {
    client = await createStagehandClient();

    // Dynamically import workflow module based on carrier slug
    const workflowModule = await import(`../workflows/${carrierSlug}.js`);

    const result = await workflowModule.runWorkflow(client.stagehand, job);
    return result;
  } catch (error: unknown) {
    // Check if it's a module not found error
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return {
        success: false,
        statements: [],
        error: `No workflow implemented for carrier: ${carrierSlug}`,
      };
    }

    Sentry.captureException(error);
    return {
      success: false,
      statements: [],
      error: `Failed to execute workflow: ${getErrorMessage(error)}`,
    };
  } finally {
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
export async function run(job: WorkflowJob): Promise<WorkflowResult> {
  const carrierSlug = identify(job.credential.login_url);
  return executeWorkflow(carrierSlug, job);
}
