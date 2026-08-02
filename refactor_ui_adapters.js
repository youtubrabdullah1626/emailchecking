const fs = require('fs');
const path = require('path');

const ADAPTER_COMPONENTS = new Set([
  'Button', 'Badge', 'Input', 'Textarea', 'PageHeader', 
  'EmptyState', 'ErrorState', 'LoadingState'
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

  // Handle individual imports like @/components/ui-legacy/Button
  ADAPTER_COMPONENTS.forEach(comp => {
    const reg = new RegExp(`import\\s+\\{\\s*${comp}\\s*\\}\\s+from\\s+["']@/components/ui-legacy/${comp}["']`, 'g');
    if (content.match(reg)) {
       content = content.replace(reg, `import { Legacy${comp} as ${comp} } from "@/components/ui/legacy-adapters"`);
    }
  });

  // Find standard barrel imports from @/components/ui-legacy
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']@\/components\/ui-legacy["']/g;
  
  content = content.replace(importRegex, (match, importsStr) => {
    const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    const adapted = [];
    const remainingLegacy = [];
    
    imports.forEach(imp => {
      // Handle aliased imports if any exist, but normally they don't in our codebase
      if (ADAPTER_COMPONENTS.has(imp)) {
        adapted.push(`Legacy${imp} as ${imp}`);
      } else {
        remainingLegacy.push(imp);
      }
    });

    if (adapted.length === 0) return match;

    let newImportStr = '';
    
    if (remainingLegacy.length > 0) {
      newImportStr += `import { ${remainingLegacy.join(', ')} } from "@/components/ui-legacy";\n`;
    }
    
    newImportStr += `import { ${adapted.join(', ')} } from "@/components/ui/legacy-adapters";`;
    
    return newImportStr;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
