const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const source = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const wordDir = path.join(distDir, 'word');

fs.mkdirSync(wordDir, { recursive: true });
fs.writeFileSync(path.join(wordDir, 'index.html'), source);
console.log('dist/word/index.html 생성');
