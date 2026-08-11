const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, '../src'));
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Convert Next.js Links that do not have prefetch={true} to include it
    // Handle both multiline and single line <Link tags
    content = content.replace(/<Link(?!\s+prefetch|\s*>[^<]*<Link[^>]*prefetch)([\s\S]*?)>/g, (match, p1) => {
        if (match.includes('prefetch')) return match;
        return `<Link prefetch={true}${p1}>`;
    });

    // Also look for simple <a href="..."> and change to <Link prefetch={true} href="..."> 
    // where appropriate, but this is riskier without importing Link. Let's stick to adding prefetch 
    // to existing Links, as most of Next.js navigation should be using Link already.
    
    // We also want to replace <a> tags that have href starting with '/' inside src/app and src/components
    // But we have to make sure "import Link from 'next/link'" is present.
    // Instead of doing it blindly, I'll just apply prefetch={true} to existing Links first.
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedCount++;
        console.log('Updated', file);
    }
});

console.log('Total files updated:', changedCount);
