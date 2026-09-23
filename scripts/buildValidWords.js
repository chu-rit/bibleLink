// 오늘의 단어 유효 추측 사전 생성
// 5word.txt(자모5) + 6word.txt(자모6) + bibleWordsLib1.json 단어를 자모 수별로 합친다
// Lib1 병합 후에는 다시 실행: node scripts/buildValidWords.js
const fs = require('fs');
const path = require('path');

const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWELS = ['ㅏ', 'ㅏㅣ', 'ㅑ', 'ㅑㅣ', 'ㅓ', 'ㅓㅣ', 'ㅕ', 'ㅕㅣ', 'ㅗ', 'ㅗㅏ', 'ㅗㅏㅣ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅓㅣ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const FINALS = ['', 'ㄱ', 'ㄱㄱ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅅㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const INITIAL_EXPANSION = { 'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ' };

function jamoLength(word) {
  let n = 0;
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) continue;
    const initial = INITIALS[Math.floor(code / 588)];
    n += (INITIAL_EXPANSION[initial] || initial).length;
    n += VOWELS[Math.floor((code % 588) / 28)].length;
    n += FINALS[code % 28].length;
  }
  return n;
}

const dir = path.join(__dirname, '..', 'data', 'words2');
const sets = { 5: new Set(), 6: new Set() };

for (const n of [5, 6]) {
  fs.readFileSync(path.join(dir, `${n}word.txt`), 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((w) => sets[n].add(w));
}

const lib1 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'words', 'bibleWordsLib1.json'), 'utf8'));
lib1.forEach((w) => {
  const word = (w.word || '').trim();
  const n = jamoLength(word);
  if (n === 5 || n === 6) sets[n].add(word);
});

const out = { 5: [...sets[5]].sort(), 6: [...sets[6]].sort() };
const outPath = path.join(dir, 'validWords.json');
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
console.log(`5자모 ${out[5].length}개, 6자모 ${out[6].length}개 -> ${outPath}`);
