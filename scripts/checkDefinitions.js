const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const words = JSON.parse(fs.readFileSync(path.join(dir, 'bibleWordsLib1.json'), 'utf8'));
const maps = fs.readdirSync(dir).filter((f) => /^crosswordMap\d+\.json$/.test(f));
const used = new Set();
maps.forEach((f) => {
  JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).cells.forEach((c) => used.add(c.wordId));
});
console.log('맵에 사용된 단어 중 정의에 답이 포함된 경우:\n');
[...used].sort().forEach((id) => {
  const w = words.find((x) => x.id === id);
  if (!w) return;
  const word = w.word.replace(/\s/g, '');
  const def = w.definition.replace(/\s/g, '');
  if (def.includes(word)) {
    console.log(`[${w.word}] ${w.definition}`);
  }
});
