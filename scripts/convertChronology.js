// 연대기 CSV -> JSON 변환 스크립트
// 사용법: node scripts/convertChronology.js
// 원본: data/DemoData English.csv (기본 텍스트·날짜), data/TalkFile_bible_history_korean.csv (한국어 텍스트 참고)
// 수동 번역: data/chronologyTranslations.json (행 번호 -> 한국어 이벤트 텍스트)
// 출력: data/chronologyEvents.json
// 컬럼: 표시 단계, 시작 연/월/일/시, 불확실성(시간), 사건, 종료 연/월/일/시, 종료 불확실성, (빈 칸), 출처, 키워드
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '../data/DemoData English.csv');
const koreanPath = path.join(__dirname, '../data/TalkFile_bible_history_korean.csv');
const translationsPath = path.join(__dirname, '../data/chronologyTranslations.json');
const outputPath = path.join(__dirname, '../data/chronologyEvents.json');

// 따옴표 안의 쉼표와 "" 이스케이프를 처리하는 CSV 한 줄 파서
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

const CATEGORY_MAP = {
  person: '인물',
  king: '왕',
  'king juda': '왕',
  'king israel': '왕',
  judge: '인물',
  priest: '인물',
  prophet: '인물',
  historical: '사건',
  'bible book': '성경',
  period: '기간',
  'period north': '기간',
  'period south': '기간',
  war: '전쟁',
  pestilence: '전염병',
  archeology: '고고학',
  bible: '성경',
  'sacred secret': '신성한 비밀',
  'heilig geheim': '신성한 비밀',
  'wold power': '세계 강국',
  'annual meeting': '연례 대회',
  update: '조정',
};

// 성경 약어·고유 표기는 기계번역 잔여물로 보지 않는다
const LATIN_WHITELIST = new Set([
  'GEN', 'EX', 'LEV', 'NUM', 'DEUT', 'JOSH', 'JUDG', 'RUTH', 'SAM', 'KI', 'CHRON', 'EZRA', 'NEH',
  'ESTH', 'JOB', 'PS', 'PSALMS', 'PROV', 'ECCL', 'ISA', 'JER', 'LAM', 'EZEK', 'DAN', 'HOS', 'JOEL',
  'AMOS', 'OBAD', 'JON', 'JONAH', 'MIC', 'NAH', 'HAB', 'ZEPH', 'HAG', 'ZECH', 'MAL', 'MATT', 'MARK',
  'LUKE', 'JOHN', 'ACTS', 'ROM', 'COR', 'GAL', 'EPH', 'PHIL', 'COL', 'THESS', 'TIM', 'TITUS',
  'PHILEM', 'HEB', 'JAS', 'PET', 'JUDE', 'REV',
  'COVID', 'LDC', 'WBBR', 'SKE', 'UN', 'NWT', 'JW', 'JWB',
]);

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function needsReview(event) {
  return (event.match(/[A-Za-z]+/g) || [])
    .some((word) => word.length >= 2 && !LATIN_WHITELIST.has(word.toUpperCase()));
}

const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

// 한국어판이 확인된 비-jw.org 링크 치환표
const SOURCE_OVERRIDES = {
  'https://nl.wikipedia.org/wiki/Caligula': 'https://ko.wikipedia.org/wiki/칼리굴라',
  'https://nl.wikipedia.org/wiki/Claudius_I': 'https://ko.wikipedia.org/wiki/클라우디우스',
  'https://nl.wikipedia.org/wiki/Nero_(keizer)': 'https://ko.wikipedia.org/wiki/네로',
  'https://nl.wikipedia.org/wiki/Tweede_Wereldoorlog': 'https://ko.wikipedia.org/wiki/제2차_세계_대전',
  'https://en.wikipedia.org/wiki/2023_Israel–Hamas_war': 'https://ko.wikipedia.org/wiki/이스라엘-하마스_전쟁',
  'https://en.wikipedia.org/wiki/2026_Iran_war': 'https://ko.wikipedia.org/wiki/2026년_이란_전쟁',
};

// jw.org 출처를 한국어 라이브러리 링크로 변환
const localizeSource = (url) => {
  if (!url) return url;
  if (Object.prototype.hasOwnProperty.call(SOURCE_OVERRIDES, url)) return SOURCE_OVERRIDES[url];
  const media = url.match(/mediaitems\/[^/]+\/([^\s/]+)/);
  if (media) return `https://www.jw.org/finder?srcid=share&wtlocale=KO&lank=${media[1]}`;
  return url
    .replace('wtlocale=E', 'wtlocale=KO')
    .replace('pub=nwtsty', 'pub=nwt')
    .replace('wol.jw.org/en/wol/d/r1/lp-e/', 'wol.jw.org/ko/wol/d/r8/lp-ko/')
    .replace('wol.jw.org/nl/wol/d/r18/lp-o/', 'wol.jw.org/ko/wol/d/r8/lp-ko/');
};

const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);
const koreanLines = fs.readFileSync(koreanPath, 'utf8').split(/\r?\n/);
const events = [];
const anomalies = [];
let sourceOrder = 0;

for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  sourceOrder++;
  const fields = parseCsvLine(line);
  const koreanLine = koreanLines[sourceOrder];
  const koreanEvent = koreanLine ? parseCsvLine(koreanLine)[6] : null;
  const [level, year, month, day, hour, uncertainty, event, endYear, endMonth, endDay, endHour, endUncertainty] = fields;
  const tail = fields.slice(12);
  const source = tail.find((field) => /^https?:\/\//.test(field)) || null;
  const keyword = tail.filter((field) => field && field !== source).pop() || '';
  const category = CATEGORY_MAP[keyword.trim().toLowerCase()] || '기타';

  // 이벤트 텍스트: 수동 번역 -> 자연스러운 한국어 원문 -> 영어 원문 순
  const eventText = translations[String(sourceOrder)]
    || (koreanEvent && !needsReview(koreanEvent) ? koreanEvent : event);
  const entry = { id: sourceOrder, level: toNumber(level), year: toNumber(year), event: eventText };
  if (!entry.event || entry.year === null) {
    anomalies.push(`row ${sourceOrder}: ${line.slice(0, 120)}`);
    continue;
  }
  if (toNumber(month) !== null) entry.month = toNumber(month);
  if (toNumber(day) !== null) entry.day = toNumber(day);
  if (toNumber(hour) !== null) entry.hour = toNumber(hour);
  if (toNumber(uncertainty) !== null) entry.uncertaintyHours = toNumber(uncertainty);
  if (toNumber(endYear) !== null) entry.endYear = toNumber(endYear);
  if (toNumber(endMonth) !== null) entry.endMonth = toNumber(endMonth);
  if (toNumber(endDay) !== null) entry.endDay = toNumber(endDay);
  if (toNumber(endHour) !== null) entry.endHour = toNumber(endHour);
  if (toNumber(endUncertainty) !== null) entry.endUncertaintyHours = toNumber(endUncertainty);
  entry.category = category;
  if (source) entry.source = localizeSource(source);
  if (!translations[String(sourceOrder)] && (!koreanEvent || needsReview(koreanEvent))) {
    entry.needsReview = true;
  }
  events.push(entry);
}

events.sort((a, b) =>
  a.year - b.year
  || (a.month || 0) - (b.month || 0)
  || (a.day || 0) - (b.day || 0)
  || (a.hour || 0) - (b.hour || 0));

fs.writeFileSync(outputPath, JSON.stringify(events, null, 2) + '\n');

const categoryCounts = events.reduce((acc, entry) => {
  acc[entry.category] = (acc[entry.category] || 0) + 1;
  return acc;
}, {});
const years = events.map((entry) => entry.year);
console.log(`변환 완료: ${events.length}건 -> ${path.relative(process.cwd(), outputPath)}`);
console.log(`연도 범위: ${Math.min(...years)} ~ ${Math.max(...years)}`);
console.log('분류:', categoryCounts);
console.log(`번역 검토 필요(needsReview): ${events.filter((entry) => entry.needsReview).length}건`);
if (anomalies.length) {
  console.log('건너뛴 행:');
  anomalies.forEach((anomaly) => console.log(' -', anomaly));
}
