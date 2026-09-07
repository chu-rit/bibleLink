import bibleWords from './data/words/bibleWordsLib1.json';

export const normalize = (value) => value.replace(/\s/g, '').trim();

export const formatReferenceByChapter = (reference) => reference.replace(/(시편\s+)?(\d+):\d+(?:-\d+)?(?:,\s*\d+)*/g, (match, psalms, p1) => {
  const suffix = psalms ? '편' : '장';
  return (psalms || '') + p1 + suffix;
});

export const PAGE_ASPECT_RATIO = 20 / 9;

// 화면 비율(9:20)을 유지하면서 창 안에 들어가는 최대 페이지 폭
export const getPageWidth = (windowWidth, windowHeight) => {
  const width = windowWidth || 375;
  const height = windowHeight || Math.round(width * PAGE_ASPECT_RATIO);
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
