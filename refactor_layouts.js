const fs = require('fs');
const path = require('path');

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

  // Handle sequences/page.tsx which imports directly from ui-legacy/Layouts
  if (content.includes('@/components/ui-legacy/Layouts')) {
    content = content.replace(/@\/components\/ui-legacy\/Layouts/g, '@/components/layout');
  }

  // Find imports from @/components/ui-legacy
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']@\/components\/ui-legacy["']/g;
  
  content = content.replace(importRegex, (match, importsStr) => {
    const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    const layouts = [];
    const others = [];
    
    imports.forEach(imp => {
      if (['Container', 'Grid', 'Flex', 'Stack'].includes(imp)) {
        layouts.push(imp);
      } else {
        others.push(imp);
      }
    });

    if (layouts.length === 0) return match;

    let newImportStr = '';
    if (others.length > 0) {
      newImportStr += `import { ${others.join(', ')} } from "@/components/ui-legacy";\n`;
    }
    newImportStr += `import { ${layouts.join(', ')} } from "@/components/layout";`;
    return newImportStr;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
