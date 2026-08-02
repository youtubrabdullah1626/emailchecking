const fs = require('fs');
const path = require('path');

const REVERT_COMPONENTS = new Set(['Input', 'Textarea', 'PageHeader']);

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

  // Find standard barrel imports from @/components/ui
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']@\/components\/ui["']/g;
  
  content = content.replace(importRegex, (match, importsStr) => {
    const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    const staysInUI = [];
    const goesToLegacy = [];
    
    imports.forEach(imp => {
      if (REVERT_COMPONENTS.has(imp)) {
        goesToLegacy.push(imp);
      } else {
        staysInUI.push(imp);
      }
    });

    if (goesToLegacy.length === 0) return match;

    let newImportStr = '';
    
    // We must merge goesToLegacy into the existing @/components/ui-legacy import if it exists,
    // but a regex might be tricky. Let's just append a new import { ... } from ui-legacy line
    // or we can just append it below.
    newImportStr += `import { ${goesToLegacy.join(', ')} } from "@/components/ui-legacy";\n`;
    
    if (staysInUI.length > 0) {
      newImportStr += `import { ${staysInUI.join(', ')} } from "@/components/ui";`;
    }
    
    return newImportStr;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Reverted in ${filePath}`);
  }
});
