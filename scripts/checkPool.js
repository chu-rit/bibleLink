const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const words = JSON.parse(fs.readFileSync(path.join(dir, 'bibleWordsLib1.json'), 'utf8'));
const maps = fs.readdirSync(dir).filter((f) => /^crosswordMap\d+\.json$/.test(f));
const used = new Set();
maps.forEach((f) => {
  JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).cells.forEach((c) => used.add(c.wordId));
});
const avail = words.filter((x) => !used.has(x.id) && x.word.length >= 2 && x.word.length <= 10);
const dist = {};
avail.forEach((x) => { dist[x.difficulty] = (dist[x.difficulty] || 0) + 1; });
console.log('사용 가능 단어 수:', avail.length);
console.log('난이도 분포:', JSON.stringify(dist));
