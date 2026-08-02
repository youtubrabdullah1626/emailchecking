const fs = require('fs');
const path = require('path');

const DIRECT_SWAP_COMPONENTS = new Set([
  'Card', 'CardHeader', 'CardTitle', 'CardContent',
  'Table', 'TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell',
  'Input', 'Textarea', 'PageHeader', 'Skeleton', 'Spinner'
]);

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(path.join(__dirname, 'src', 'app'), function(filePath) {
  if (!filePath.endsWith('.tsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Handle sequences/page.tsx special case if there are any remaining individual path imports
  const individualImports = ['PageHeader', 'Table', 'Badge', 'Button', 'LoadingState', 'ErrorState', 'EmptyState'];
  individualImports.forEach(comp => {
    const reg = new RegExp(`@/components/ui-legacy/${comp}`, 'g');
    if (DIRECT_SWAP_COMPONENTS.has(comp)) {
      content = content.replace(reg, '@/components/ui');
    }
  });

  // Find standard barrel imports from @/components/ui-legacy
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']@\/components\/ui-legacy["']/g;
  
  content = content.replace(importRegex, (match, importsStr) => {
    const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    const directSwaps = [];
    const remainingLegacy = [];
    
    imports.forEach(imp => {
      if (DIRECT_SWAP_COMPONENTS.has(imp)) {
        directSwaps.push(imp);
      } else {
        remainingLegacy.push(imp);
      }
    });

    if (directSwaps.length === 0) return match;

    let newImportStr = '';
    if (remainingLegacy.length > 0) {
      newImportStr += `import { ${remainingLegacy.join(', ')} } from "@/components/ui-legacy";\n`;
    }
    
    // Check if there is already an import from @/components/ui
    // To be safe, we just add a new import line for @/components/ui
    newImportStr += `import { ${directSwaps.join(', ')} } from "@/components/ui";`;
    
    return newImportStr;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
