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

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (/<a\s+[^>]*href=["']\/[^"']*["']/.test(content)) {
        console.log('Found internal <a> tag in:', file);
    }
});
