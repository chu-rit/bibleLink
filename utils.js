import bibleWords from './data/words/bibleWordsLib1.json';

export const normalize = (value) => value.replace(/\s/g, '').trim();

export const formatReferenceByChapter = (reference) => reference.split(';').map((segment) => {
  const trimmed = segment.trim();
  if (!trimmed.includes(':')) return trimmed;
  const match = trimmed.match(/^([^\d]*?)\s*(\d.*)$/);
  if (!match) return trimmed;
  const book = match[1].trim();
  const suffix = book.startsWith('시편') ? '편' : '장';
  const chapters = [...new Set([...match[2].matchAll(/(\d+)\s*:/g)].map((chapterMatch) => chapterMatch[1]))];
  if (!chapters.length) return trimmed;
  return [book, chapters.map((chapter) => `${chapter}${suffix}`).join(', ')].filter(Boolean).join(' ');
}).join('; ');

export const PAGE_ASPECT_RATIO = 20 / 9;

// 좁은 화면(모바일)에서는 창 폭을 그대로 쓰고, 넓은 화면에서는 9:20 비율을 유지하는 최대 폭
export const MOBILE_MAX_WIDTH = 480;

// 홈 화면에 설치된 PWA(standalone) 여부 — 이 모드에서는 하단 safe-area까지 화면이 확장된다
export const isStandalonePWA = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

// 웹에서 하단 safe-area-inset-bottom 실제 픽셀 값 (iOS 홈 인디케이터 등)
export const getBottomSafeArea = () => {
  if (typeof document === 'undefined') return 0;
  const el = document.createElement('div');
  el.style.paddingBottom = 'env(safe-area-inset-bottom)';
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  const value = parseFloat(window.getComputedStyle(el).paddingBottom) || 0;
  el.remove();
  return value;
};

export const getPageWidth = (windowWidth, windowHeight) => {
  const width = windowWidth || 375;
  const height = windowHeight || Math.round(width * PAGE_ASPECT_RATIO);
  if (width <= MOBILE_MAX_WIDTH) return width;
  return Math.min(width, Math.round(height / PAGE_ASPECT_RATIO));
};

export let wordDataById = Object.fromEntries(bibleWords.map((item) => [item.id, item]));

export function setWordData(words) {
  wordDataById = Object.fromEntries(words.map((item) => [item.id, item]));
}

export const averageDifficulty = (map) => {
  const values = map.cells.map((cell) => wordDataById[cell.wordId]?.difficulty).filter(Boolean);
  if (!values.length) return map.difficulty;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const formatMapTitle = (title) => {
  if (!title) return '';
  const match = title.match(/^([ENH])-(\d+)$/);
  if (!match) return title;
  const [, grade, num] = match;
  const fullName = grade === 'E' ? 'EASY' : grade === 'N' ? 'NORMAL' : 'HARD';
  return `${fullName} - ${num}`;
};

export const getFilledCellCount = (map, answers) => {
  const filledCells = new Set();
  map.cells.forEach((item, index) => {
    const answer = answers?.[index];
    if (!answer) return;
    [...normalize(answer)].forEach((_, offset) => {
      const row = item.direction === 'across' ? item.row : item.row + offset;
      const col = item.direction === 'across' ? item.col + offset : item.col;
      filledCells.add(`${row}-${col}`);
    });
  });
  return filledCells.size;
};

export const getOpenCellCount = (map) => map.grid.reduce(
  (count, row) => count + [...row].filter((value) => value !== '#').length,
  0
);
