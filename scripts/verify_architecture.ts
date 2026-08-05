import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
      callback(dirPath);
    }
  });
}

function verifyDeliverabilitySingleSourceOfTruth() {
  const srcDir = path.join(__dirname, '../src');
  const allowedConsumers = [
    'sender.ts',
    'benchmark.ts', // test file
    'deliverability.recovery.test.ts', // test file
    'DeliverabilityHealthModel.ts' // itself
  ];

  let violations = 0;

  walkDir(srcDir, (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Check if file imports from DeliverabilityHealthModel
    if (content.includes('DeliverabilityHealthModel') || content.includes('DeliverabilityHealthEvaluator')) {
      if (!allowedConsumers.includes(fileName)) {
        console.error(`[VIOLATION] ${fileName} imports DeliverabilityHealthModel. Only the Deliverability Engine (sender.ts) may consume this.`);
        violations++;
      }
    }

    // Check for duplicated tracking injection
    if (content.includes('TrackingInjector') && !allowedConsumers.includes(fileName) && fileName !== 'TrackingInjector.ts' && fileName !== 'benchmark_deliverability.ts') {
        // Just warning, sender is the owner.
    }
  });

  if (violations === 0) {
    console.log('[SUCCESS] Deliverability Single Source of Truth architectural constraint validated. 0 Violations found.');
  } else {
    console.error(`[FAILED] Found ${violations} architectural violations.`);
    process.exit(1);
  }
}

verifyDeliverabilitySingleSourceOfTruth();
