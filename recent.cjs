const fs = require('fs');
const path = require('path');

function getRecentFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getRecentFiles(filePath, files);
    } else {
      files.push({ file: filePath, mtime: stat.mtime });
    }
  }
  return files;
}

const files = getRecentFiles('.');
files.sort((a, b) => b.mtime - a.mtime);
console.log(files.slice(0, 10).map(f => `${f.file}: ${f.mtime}`).join('\n'));
