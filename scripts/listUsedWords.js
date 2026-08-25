const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const words = JSON.parse(fs.readFileSync(path.join(dir, 'bibleWordsLib1.json'), 'utf8'));
const byId = new Map(words.map((w) => [w.id, w]));
const maps = fs.readdirSync(dir).filter((f) => /^crosswordMap\d+\.json$/.test(f)).sort();
const used = new Set();
maps.forEach((f) => {
  JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).cells.forEach((c) => used.add(c.wordId));
});
console.log(`사용 단어 수: ${used.size}\n`);
console.log('word\tinsightEntry\tid');
console.log('----\t----\t----');
[...used].sort().forEach((id) => {
  const w = byId.get(id);
  console.log(`${w.word}\t${w.insightEntry}\t${id}`);
});
