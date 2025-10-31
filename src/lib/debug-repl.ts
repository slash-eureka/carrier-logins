/**
 * Interactive REPL debugger for Stagehand workflows
 *
 * Usage:
 *   import { debugRepl } from '../lib/debug-repl.js';
 *
 *   // In your workflow:
 *   await debugRepl(stagehand);
 *
 * Available in REPL:
 *   - stagehand: Stagehand instance
 *   - page: stagehand.page
 *   - context: stagehand.context
 *   - act(): shorthand for page.act()
 *   - extract(): shorthand for page.extract()
 *   - observe(): shorthand for page.observe()
 *   - z: Zod for schemas
 */

import repl from 'repl';
import { z } from 'zod';
import type { Stagehand } from '@browserbasehq/stagehand';

export async function debugRepl(stagehand: Stagehand): Promise<void> {
  console.log('\n🔍 Entering interactive REPL debugger');
  console.log('Available commands:');
  console.log('  stagehand  - Stagehand instance');
  console.log('  page       - stagehand.page');
  console.log('  context    - stagehand.context');
  console.log('  act()      - shorthand for page.act()');
  console.log('  extract()  - shorthand for page.extract()');
  console.log('  observe()  - shorthand for page.observe()');
  console.log('  z          - Zod for schemas');
  console.log('  .exit      - continue workflow\n');

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
  replServer.context.z = z;

  // Add shorthand helper functions
  replServer.context.act = async (instruction: string | object) => {
    return await stagehand.act(instruction);
  };

  replServer.context.extract = async (instruction: string | object, schema?: any) => {
    if (typeof instruction === 'string' && schema) {
      return await stagehand.extract({ instruction, schema });
    }
    return await stagehand.extract(instruction);
  };

  replServer.context.observe = async (instruction: string | object) => {
    return await stagehand.observe(instruction);
  };

  // Wait for REPL to close
  await new Promise<void>((resolve) => {
    replServer.on('exit', () => {
      console.log('\n✅ Continuing workflow...\n');
      resolve();
    });
  });
}
