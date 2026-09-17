// 오늘의 단어 추가 스크립트
// 사용법: node scripts/addDailyWord.js <id> <name> <difficulty> <hint1> <hint2> <hint3>
// 단어를 추가하면 출제 이력이 바뀌므로 CACHE_VERSION을 함께 올려
// 전 기기 캐시와 랭킹을 초기화한다. 이 스크립트로만 추가하면 버전을 따로 챙길 필요가 없다.
const fs = require('fs');
const path = require('path');

const [id, name, difficulty, hint1, hint2, hint3] = process.argv.slice(2);
if (!id || !name || !difficulty || !hint1 || !hint2 || !hint3) {
  console.error('사용법: node scripts/addDailyWord.js <id> <name> <difficulty> <hint1> <hint2> <hint3>');
  process.exit(1);
}

const wordsPath = path.join(__dirname, '../data/words2/dailyWords.json');
const utilsPath = path.join(__dirname, '../utils/dailyWord.js');

const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
if (words.some((w) => w.id === id || w.name === name)) {
  console.error(`중복된 단어입니다: ${id} / ${name}`);
  process.exit(1);
}
words.push({ id, name, difficulty: Number(difficulty), hint1, hint2, hint3 });
fs.writeFileSync(wordsPath, JSON.stringify(words, null, 2) + '\n');

const utils = fs.readFileSync(utilsPath, 'utf8');
const match = utils.match(/const CACHE_VERSION = 'v(\d+)';/);
if (!match) {
  console.error('utils/dailyWord.js에서 CACHE_VERSION을 찾지 못했습니다.');
  process.exit(1);
}
const nextVersion = Number(match[1]) + 1;
fs.writeFileSync(utilsPath, utils.replace(match[0], `const CACHE_VERSION = 'v${nextVersion}';`));

console.log(`추가 완료: ${name} (${id}), CACHE_VERSION v${match[1]} -> v${nextVersion}`);
