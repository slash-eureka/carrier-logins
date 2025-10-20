import 'dotenv/config';
import { Stagehand } from '@browserbasehq/stagehand';

// Parse command line arguments
const [username, password, loginUrl] = process.argv.slice(2);

if (!username || !password || !loginUrl) {
  console.error(JSON.stringify({
    success: false,
    error: 'Missing required arguments: username, password, loginUrl'
  }));
  process.exit(1);
}

// Get Browserbase credentials from environment
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
  console.error(JSON.stringify({
    success: false,
    error: 'Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID environment variables'
  }));
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error(JSON.stringify({
    success: false,
    error: 'Missing GEMINI_API_KEY environment variable (required for Stagehand AI actions with Gemini)'
  }));
  process.exit(1);
}

async function runWorkflow() {
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: BROWSERBASE_API_KEY,
    projectId: BROWSERBASE_PROJECT_ID,
    verbose: 1,
    modelName: 'google/gemini-2.0-flash-exp',
    disablePino: true,
    modelClientOptions: {
      apiKey: GEMINI_API_KEY
    }
  });

  try {
    await stagehand.init();
    console.log('Stagehand initialized successfully.');

    const page = stagehand.page;

    if (!page) {
      throw new Error('Failed to get page instance from Stagehand');
    }

    // Step 1: Navigate to URL
    console.log(`Navigating to: ${loginUrl}`);
    await page.goto(loginUrl); 
    
    // Step 2: Type username
    console.log(`Performing action: type '${username}' into the Email/Username input`);
    await page.act(`type '${username}' into the Email/Username input`); 
    
    // Step 3: Click Login button
    console.log(`Performing action: click the Login button`);
    await page.act(`click the Login button`); 
    
    // Step 4: Click download button in first row
    console.log(`Performing action: click the download button in the first row`);
    await page.act(`click the download button in the first row`); 

    console.log(JSON.stringify({
      success: true,
      message: 'Workflow completed successfully'
    }));

  } catch (error: any) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }));
    process.exit(1);
  } finally {
    await stagehand.close();
  }
}

runWorkflow().catch(error => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }));
  process.exit(1);
});