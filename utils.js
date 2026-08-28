import bibleWords from './data/words/bibleWordsLib1.json';

export const normalize = (value) => value.replace(/\s/g, '').trim();

export const formatReferenceByChapter = (reference) => reference.replace(/(\d+):\d+(?:-\d+)?(?:,\s*\d+)*/g, '$1장');

export const wordDataById = Object.fromEntries(bibleWords.map((item) => [item.id, item]));

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
