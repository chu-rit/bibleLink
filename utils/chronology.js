// 연대기 데이터 로딩·시간 변환 유틸
// 원본: data/chronologyEvents.json (npm run build:chronology로 생성)
const RAW_EVENTS = require('../data/chronologyEvents.json');

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

// 연도 0이 없는 역사 연대기를 연속 시간 값으로 변환
// year=-1 → 기원전 1년(연속값 0.x), year=1 → 기원후 1년(연속값 1.x)
export const toSerial = (year, month, day) => {
  if (year === null || year === undefined) return null;
  const y = year < 0 ? year + 1 : year;
  if (!month) return y;
  const dayOfYear = DAYS_BEFORE_MONTH[month - 1] + ((day || 1) - 1);
  return y + dayOfYear / 365;
};

export const serialToYear = (t) => {
  const s = Math.floor(t);
  return s <= 0 ? s - 1 : s;
};

export const serialToMonth = (t) => {
  const dayOfYear = Math.floor((t - Math.floor(t)) * 365);
  for (let m = 11; m >= 0; m -= 1) {
    if (dayOfYear >= DAYS_BEFORE_MONTH[m]) return m + 1;
  }
  return 1;
};

export const formatYear = (year) => (year < 0 ? `기원전 ${-year}` : `${year}`);

// 표시 연수(span)에 따라 노출할 최소 level — level이 클수록 주요 사건
export const minLevelForSpan = (spanYears) => {
  if (spanYears >= 3000) return 5;
  if (spanYears >= 1200) return 4;
  if (spanYears >= 400) return 3;
  if (spanYears >= 120) return 2;
  if (spanYears >= 40) return 1;
  return 0;
};

export const CATEGORY_COLORS = {
  사건: '#b3543f',
  인물: '#5b7a99',
  왕: '#8e6fb8',
  기간: '#6b8f5e',
  성경: '#b08d3f',
  '신성한 비밀': '#4a6fa5',
  전쟁: '#9e3b3b',
  '세계 강국': '#556b2f',
  전염병: '#7a5c3a',
  조정: '#888888',
  '연례 대회': '#3f8f8f',
  고고학: '#946b2d',
  기타: '#999999',
};

export const categoryColor = (category) => CATEGORY_COLORS[category] || CATEGORY_COLORS.기타;

// 연속 시간 값을 미리 계산해 정렬한 목록
export const ITEMS = RAW_EVENTS
  .map((entry) => ({
    ...entry,
    t: toSerial(entry.year, entry.month, entry.day),
    endT: entry.endYear !== undefined ? toSerial(entry.endYear, entry.endMonth, entry.endDay) : null,
  }))
  .filter((entry) => entry.t !== null)
  .sort((a, b) => a.t - b.t);

export const MIN_T = ITEMS.length ? ITEMS[0].t : -4026;
export const MAX_T = ITEMS.length ? Math.max(...ITEMS.map((e) => e.endT || e.t)) : 2027;

export const CATEGORIES = Object.keys(
  ITEMS.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {})
);
