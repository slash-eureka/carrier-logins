/**
 * Advantage Partners workflow script
 * Logs into Advantage Partners portal and downloads commission statements
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';
import { getErrorMessage } from '../lib/error-utils.js';

/**
 * Run workflow for Advantage Partners supplier statement fetching
 * @param stagehand - Stagehand client instance
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with success status and statements
 */
export async function runWorkflow(
  stagehand: Stagehand,
  job: WorkflowJob,
): Promise<WorkflowResult> {
  const { username: _username, password: _password, login_url: loginUrl } =
    job.credential;
  const page = stagehand.page;

  try {
    // Step 1: Navigate to URL
    await page.goto(loginUrl);

    // Step 2: Type username
    await page.act(`type '${username}' into the Email/Username input`);

    // Step 3: Click Login button
    await page.act(`click the Login button`);

    // Step 4: Click download button in first row
    await page.act(`click the download button in the first row`);

    // TODO: Capture the downloaded PDF URL
    // For now, return empty statements - will be enhanced when download capture is implemented
    const statementDate = new Date().toISOString().split('T')[0];

    return {
      success: true,
      statements: [
        {
          pdfUrl: '', // TODO: Capture PDF URL
          statementDate,
          filename: 'advantage_partners_statement.pdf',
        },
      ],
    };
  } catch (error: unknown) {
    return {
      success: false,
      statements: [],
      error: getErrorMessage(error),
    };
  }
}
