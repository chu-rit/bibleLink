const fs = require('fs');
const path = require('path');

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function decompose(char) {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  const offset = code - 0xAC00;
  const jong = offset % 28;
  const jung = Math.floor(offset / 28) % 21;
  const cho = Math.floor(offset / (28 * 21));
  const result = [CHO[cho], JUNG[jung]];
  if (jong > 0) result.push(JONG[jong]);
  return result;
}

function countJamo(word) {
  let count = 0;
  for (const ch of word) {
    const parts = decompose(ch);
    if (parts) count += parts.length;
  }
  return count;
}

const wordsDir = path.join(__dirname, '..', 'data', 'words');
const files = fs.readdirSync(wordsDir).filter(f => /^bibleWordsLib\d+\.json$/.test(f));

// 인명/지명/도시명 키워드
const nameKeywords = [
  '왕', '도시', '지역', '사람', '아버지', '아들', '딸', '어머니', '여자', '남자',
  '선지자', '예언자', '사도', '제자', '군대', '대장', '총독', '황제', '통치자', '추장', '족장',
  '항구', '요새', '언덕', '강', '바다', '호수', '골짜기', '광야', '산',
  '나라', '땅', '고원', '연맹', '출신', '지방', '고향', '섬',
  '여예언자', '수종', '조상', '자손', '여왕', '제사장', '대왕', '칭호',
  '평원', '강 유역', '수도', '도시로', '도시이자', '거처', '장소',
  '레위 도시', '도피 도시', '성읍', '마을', '시리아', '이집트', '바빌론',
  '페르시아', '로마', '그리스', '마케도니아', '소아시아', '갈릴리',
  '유다', '이스라엘', '가나안', '메소포타미아', '아시리아',
  '여자로', '왕으로', '왕에게', '왕이', '왕의', '왕에게',
];

// 제외 키워드 (사물/개념/동식물/축제/직업 등)
const excludeWords = [
  '나무', '식물', '관목', '꽃', '과일', '열매', '동물', '새', '물고기', '곤충',
  '돌', '보석', '광물', '금속', '천', '옷', '신', '그릇', '기구', '도구',
  '축제', '절기', '잔치', '명절', '안식일', '모임', '대회',
  '직업', '직무', '직책', '관직', '반죽', '누룩', '막대기', '너비', '단위',
  '태도', '정성', '개념', '표현', '상태', '역할', '분류', '취급',
  '행동', '의식', '제도', '덕목', '특성', '감정', '마음', '정신',
  '질병', '병', '종창', '출혈',
  '건물', '시설', '장소로', '저장',
  '곡물', '씨앗', '씨', '향유', '향료', '방향',
  '구름', '번개', '천둥', '지진', '바람',
  '흙', '진흙', '물', '피', '뼈', '창자', '힘줄', '내장',
  '손가락', '팔', '다리', '눈', '귀', '입',
];

const seen = new Set();
const results = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(wordsDir, file), 'utf8'));
  for (const item of data) {
    const jamo = countJamo(item.word);
    const diff = item.difficulty;
    if ((jamo === 5 || jamo === 6) && (diff === 1 || diff === 2)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      results.push({
        file,
        id: item.id,
        word: item.word,
        jamo,
        difficulty: diff,
        definition: item.definition,
        references: item.references,
      });
    }
  }
}

// 필터링: 정의에 이름 키워드 포함
const filtered = results.filter(r => {
  const def = r.definition;
  for (const kw of nameKeywords) {
    if (def.includes(kw)) return true;
  }
  return false;
});

filtered.sort((a, b) => a.word.localeCompare(b.word, 'ko'));
console.log(`Total unique: ${results.length}`);
console.log(`Filtered (names): ${filtered.length}`);
console.log('---');
for (const r of filtered) {
  console.log(`${r.word} (자음모음:${r.jamo}, 난이도:${r.difficulty}) [${r.id}]`);
  console.log(`  ${r.definition.substring(0, 100)}`);
  console.log(`  refs: ${JSON.stringify(r.references)}`);
  console.log('');
}
