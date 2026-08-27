// Lib2~Lib15을 병합해 Lib1.json을 생성하는 스크립트
// 실행: node scripts/mergeLib1.js
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

const merged = [];
const seenWords = new Set();
const seenIds = new Set();

for (let i = 2; i <= 15; i++) {
  const fp = path.join(dataDir, `bibleWordsLib${i}.json`);
  let lib;
  try {
    lib = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    continue;
  }
  lib.forEach(entry => {
    if (seenWords.has(entry.word)) {
      console.warn(`Duplicate word skipped: ${entry.word} (Lib${i})`);
      return;
    }
    if (seenIds.has(entry.id)) {
      console.warn(`Duplicate id skipped: ${entry.id} (Lib${i})`);
      return;
    }
    seenWords.add(entry.word);
    seenIds.add(entry.id);
    merged.push(entry);
  });
}

// word 기준 정렬
merged.sort((a, b) => a.word.localeCompare(b.word, 'ko'));

const outPath = path.join(dataDir, 'bibleWordsLib1.json');
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

console.log(`\nLib1 merged: ${merged.length} entries from Lib2-Lib15`);
console.log(`Written to: ${outPath}`);
