const fs = require('fs');
const path = require('path');

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function decompose(ch) {
  const code = ch.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return ch;
  return CHO[Math.floor(code / 588)] + JUNG[Math.floor((code % 588) / 28)] + JONG[code % 28];
}

function jamoCount(word) {
  let total = 0;
  for (const ch of word) {
    total += decompose(ch).length;
  }
  return total;
}

const file = fs.readFileSync(path.join(__dirname, '..', 'data', 'words2', 'dailyWordCandidates.txt'), 'utf8');
const lines = file.split(/\r?\n/);
const bad = [];
let count = 0;
for (const line of lines) {
  const m = line.match(/^(\S+)\s*\|/);
  if (!m) continue;
  count++;
  const n = jamoCount(m[1]);
  if (n < 5 || n > 6) bad.push(`${m[1]} = ${n}개`);
}
console.log(`총 ${count}개 단어`);
console.log(bad.length ? `자모수 벗어난 것:\n${bad.join('\n')}` : '모두 자모수 5~6 통과');
