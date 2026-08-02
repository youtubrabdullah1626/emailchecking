const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROUTES = [
  '/dashboard',
  '/prospects',
  '/sequences',
  '/scheduler',
  '/replies',
  '/admin/operations',
  '/system-health'
];

async function run() {
  console.log('Starting Puppeteer verification...');
  
  // Try Edge first, then Chrome
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserPath = fs.existsSync(edgePath) ? edgePath : chromePath;
  
  if (!fs.existsSync(browserPath)) {
    console.error('Could not find Edge or Chrome executable for puppeteer-core.');
    process.exit(1);
  }
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    executablePath: browserPath 
  });
  let hasErrors = false;

  for (const route of ROUTES) {
    console.log(`\nVerifying route: ${route}`);
    const page = await browser.newPage();
    let consoleErrors = [];
    let pageErrors = [];
    let failedRequests = [];
    let mimeTypeErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore generic favicon errors if they occur
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      const headers = response.headers();
      const contentType = headers['content-type'] || '';

      if (url.includes('/_next/static/')) {
        if (status === 404) {
          failedRequests.push(`404: ${url}`);
        }
        
        if (url.endsWith('.css') && !contentType.includes('text/css')) {
          mimeTypeErrors.push(`MIME mismatch (CSS): ${url} returned ${contentType}`);
        }
        
        if (url.endsWith('.js') && !contentType.includes('application/javascript') && !contentType.includes('text/javascript') && !contentType.includes('application/x-javascript')) {
          mimeTypeErrors.push(`MIME mismatch (JS): ${url} returned ${contentType}`);
        }
      }
    });

    try {
      await page.goto(`http://localhost:3000${route}`, { waitUntil: 'load', timeout: 60000 });
      
      const title = await page.title();
      console.log(`  ✓ Rendered successfully. Title: "${title}"`);
      
      if (consoleErrors.length > 0) {
        console.error(`  ❌ Console errors:`, consoleErrors);
        hasErrors = true;
      } else {
        console.log(`  ✓ No console errors`);
      }

      if (pageErrors.length > 0) {
        console.error(`  ❌ Page exceptions:`, pageErrors);
        hasErrors = true;
      } else {
        console.log(`  ✓ No runtime exceptions`);
      }

      if (failedRequests.length > 0) {
        console.error(`  ❌ Failed asset requests:`, failedRequests);
        hasErrors = true;
      } else {
        console.log(`  ✓ No missing chunks or assets`);
      }

      if (mimeTypeErrors.length > 0) {
        console.error(`  ❌ MIME type errors:`, mimeTypeErrors);
        hasErrors = true;
      } else {
        console.log(`  ✓ MIME types correct`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to load route: ${err.message}`);
      hasErrors = true;
    }
    
    await page.close();
  }

  // Test hot reload
  console.log('\nTesting hot reload on /dashboard...');
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'load' });
  
  const targetFile = path.join(__dirname, 'src/app/dashboard/page.tsx');
  let originalContent = fs.readFileSync(targetFile, 'utf8');
  let newContent = originalContent.replace('Operations Dashboard', 'Operations Dashboard HOT_RELOADED');
  
  // Start waiting for DOM change
  const waitPromise = page.waitForFunction(
    () => document.body.innerText.includes('Operations Dashboard HOT_RELOADED'),
    { timeout: 60000 }
  );

  // Trigger hot reload
  fs.writeFileSync(targetFile, newContent);
  
  try {
    await waitPromise;
    console.log('  ✓ Hot reload applied DOM changes successfully!');
  } catch (err) {
    console.error('  ❌ Hot reload failed to reflect changes in DOM', err.message);
    hasErrors = true;
  } finally {
    // Revert file
    fs.writeFileSync(targetFile, originalContent);
  }

  await browser.close();
  
  if (hasErrors) {
    console.error('\n❌ Runtime verification failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All runtime verifications passed!');
    process.exit(0);
  }
}

run().catch(console.error);
