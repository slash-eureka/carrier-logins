/**
 * Amerisafe workflow script
 * Logs into Amerisafe portal and retrieves commission statements
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { WorkflowJob, WorkflowResult } from '../types/index.js';

/**
 * Run workflow for Amerisafe supplier statement fetching
 * @param stagehand - Stagehand client instance
 * @param job - Workflow job with credentials and metadata
 * @returns Promise with success status and statements
 */
export async function runWorkflow(
  stagehand: Stagehand,
  job: WorkflowJob,
): Promise<WorkflowResult> {
  const { username, password, login_url: loginUrl } = job.credential;
  const page = stagehand.page;

  try {
    // Step 1: Navigate to URL
    await page.goto(loginUrl);

    // Step 2: Type username
    await page.act(`type '${username}' into the User Name input field`);

    // Step 3: Click Login button
    await page.act(`click the Login button`);

    // Step 4: Click Commission Statements link
    await page.act(`click the Commission Statements link`);

    // Step 5-8: Click the most recent statement date link
    // Note: The original script had hardcoded dates, now using AI to find most recent
    await page.act(
      `click the statement date link with the most recent date in the table`,
    );

    // TODO: Capture the downloaded PDF URL
    // For now, return empty statements - will be enhanced when download capture is implemented
    const statementDate = new Date().toISOString().split('T')[0];

    return {
      success: true,
      statements: [
        {
          pdfUrl: '', // TODO: Capture PDF URL
          statementDate,
          filename: 'amerisafe_statement.pdf',
        },
      ],
    };
  } catch (error: any) {
    return {
      success: false,
      statements: [],
      error: error.message,
    };
  }
}
