/**
 * Interactive REPL debugger for Stagehand workflows
 *
 * Usage:
 *   import { debug } from '../lib/debug.js';
 *
 *   // In your workflow - basic:
 *   await debug(stagehand);
 *
 *   // With local variables (use ES6 shorthand):
 *   const myVar = "test";
 *   const data = { foo: "bar" };
 *   await debug(stagehand, { myVar, data });
 *
 * Available in REPL:
 *   - stagehand: Stagehand instance
 *   - page: stagehand.page
 *   - context: stagehand.context
 *   - All variables passed in locals parameter
 */

import repl from 'repl';
import type { Stagehand } from '@browserbasehq/stagehand';

export async function debug(
  stagehand: Stagehand,
  locals?: Record<string, any>,
): Promise<void> {
  console.log('\n🔍 Entering interactive REPL debugger');
  console.log('Available:');
  console.log('  stagehand  - Stagehand instance');
  console.log('  page       - stagehand.page');
  console.log('  context    - stagehand.context');

  // Show local variables if provided
  if (locals && Object.keys(locals).length > 0) {
    console.log('  --- Local variables ---');
    for (const key of Object.keys(locals)) {
      console.log(`  ${key}      - ${typeof locals[key]}`);
    }
  }

  console.log('\nType .exit to continue workflow\n');

  const replServer = repl.start({
    prompt: 'stagehand> ',
    useColors: true,
    ignoreUndefined: true,
  });

  // Get the page - prefer stagehand.page if available
  const page = stagehand.page || stagehand.context.pages()[0];

  // Make Stagehand objects available in REPL context
  replServer.context.stagehand = stagehand;
  replServer.context.page = page;
  replServer.context.context = stagehand.context;

  // Add local variables to REPL context
  if (locals) {
    for (const [key, value] of Object.entries(locals)) {
      replServer.context[key] = value;
    }
  }

  // Wait for REPL to close
  await new Promise<void>((resolve) => {
    replServer.on('exit', () => {
      console.log('\n✅ Continuing workflow...\n');
      resolve();
    });
  });
}
