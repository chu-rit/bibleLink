const fs = require('fs');
const path = require('path');

const wordsDir = path.join(__dirname, '..', 'data', 'words');
const mapsDir = path.join(__dirname, '..', 'data', 'maps');
const MAX_WORD_USES = 2;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : Number(args[index + 1]);
};

const mapNumber = Number(args[0]);
if (!mapNumber) {
  console.error('사용법: node scripts/generateMap.js <맵번호> [--size 8] [--words 10] [--difficulty 1.3] [--seeds 20000]');
  process.exit(1);
}

const size = option('size', 8);
const targetWords = option('words', 10);
const targetDifficulty = option('difficulty', 1.3);
const seedCount = option('seeds', 20000);
const minDifficulty = option('min-difficulty', 0);
const longLength = option('long-length', 999);
const longLimit = option('long-limit', 999);
const maxDiff3 = option('max-diff3', 999);
const outputFile = `crosswordMap${mapNumber}.json`;
const isEasy = targetDifficulty <= 1.8;
const isNormal = targetDifficulty > 1.8 && targetDifficulty < 2.6;
const isHard = targetDifficulty >= 2.6;
if (size !== 8 || targetWords !== 10) {
  console.error('맵 규칙: 8x8, 단어 10개를 사용하세요.');
  process.exit(1);
}
if (isEasy && targetDifficulty < 1) {
  console.error('이지 맵 규칙: 평균 난이도 1.0~1.8을 사용하세요.');
  process.exit(1);
}
if (isNormal && (targetDifficulty < 1.9 || targetDifficulty > 2.5)) {
  console.error('노말 맵 규칙: 평균 난이도 1.9~2.5를 사용하세요.');
  process.exit(1);
}
if (isHard && targetDifficulty < 2.6) {
  console.error('하드 맵 규칙: 평균 난이도 2.6 이상을 사용하세요.');
  process.exit(1);
}

const readJson = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const words = readJson(wordsDir, 'bibleWordsLib1.json');

const usageCount = new Map();
fs.readdirSync(mapsDir)
  .filter((file) => /^crosswordMap\d+\.json$/.test(file) && file !== outputFile)
  .forEach((file) => {
    readJson(mapsDir, file).cells.forEach((cell) => {
      usageCount.set(cell.wordId, (usageCount.get(cell.wordId) || 0) + 1);
    });
  });

const pool = words
  .map((item) => ({
    id: item.id,
    word: item.word.replace(/\s/g, ''),
    letters: [...item.word.replace(/\s/g, '')],
    difficulty: item.difficulty,
    uses: usageCount.get(item.id) || 0,
  }))
  .filter((item) => item.letters.length >= 2 && item.letters.length <= size)
  .filter((item) => item.difficulty <= Math.ceil(targetDifficulty) + 1)
  .filter((item) => item.uses < MAX_WORD_USES);

const cellsOf = (item) =>
  Array.from({ length: item.letters.length }, (_, i) => [
    item.row + (item.direction === 'down' ? i : 0),
    item.col + (item.direction === 'across' ? i : 0),
  ]);

function inspect(list) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const owners = new Map();

  for (const item of list) {
    const positions = cellsOf(item);
    for (let i = 0; i < positions.length; i += 1) {
      const [r, c] = positions[i];
      if (r < 0 || c < 0 || r >= size || c >= size) return null;
      if (grid[r][c] && grid[r][c] !== item.letters[i]) return null;
      grid[r][c] = item.letters[i];
      const key = `${r},${c}`;
      if (!owners.has(key)) owners.set(key, []);
      if (!owners.get(key).includes(item)) owners.get(key).push(item);
    }
  }

  for (const holders of owners.values()) {
    if (holders.length > 2) return null;
    if (new Set(holders.map((item) => item.direction)).size !== holders.length) return null;
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!grid[r][c]) continue;
      const here = owners.get(`${r},${c}`);
      const right = owners.get(`${r},${c + 1}`);
      const below = owners.get(`${r + 1},${c}`);
      if (right && !here.some((item) => item.direction === 'across' && right.includes(item))) return null;
      if (below && !here.some((item) => item.direction === 'down' && below.includes(item))) return null;
      if (grid[r][c + 1] && grid[r + 1] && grid[r + 1][c] && grid[r + 1][c + 1]) return null;
    }
  }

  if (list.length > 1) {
    const crossed = list.every((item) => cellsOf(item).some(([r, c]) => owners.get(`${r},${c}`).length === 2));
    if (!crossed) return null;
  }

  return { grid, owners };
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const shuffle = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function build(seed) {
  const random = createRandom(seed);
  const starters = pool.filter((item) => item.letters.length >= 3 && item.uses === 0);
  if (!starters.length) return null;

  const first = shuffle(starters, random)[0];
  const list = [
    {
      ...first,
      direction: 'across',
      row: Math.floor(random() * size),
      col: Math.floor(random() * (size - first.letters.length + 1)),
    },
  ];
  if (!inspect(list)) return null;

  while (list.length < targetWords) {
    const total = list.reduce((sum, item) => sum + item.difficulty, 0);
    const longCount = list.filter((item) => item.letters.length >= longLength).length;
    const diff3Count = list.filter((item) => item.difficulty >= 3).length;
    const currentAvg = list.length ? total / list.length : 0;
    const needHigher = currentAvg < targetDifficulty;
    const candidates = shuffle(
      pool.filter(
        (item) =>
          !list.some((placed) => placed.id === item.id) &&
          (total + item.difficulty) / (list.length + 1) <= targetDifficulty &&
          (item.letters.length < longLength || longCount < longLimit) &&
          (item.difficulty < 3 || diff3Count < maxDiff3)
      ),
      random
    ).sort((a, b) => {
      if (a.uses !== b.uses) return a.uses - b.uses;
      return 0;
    });

    let placed = null;
    for (const candidate of candidates) {
      for (const base of shuffle(list, random)) {
        const direction = base.direction === 'across' ? 'down' : 'across';
        const basePositions = cellsOf(base);
        for (let bi = 0; bi < base.letters.length && !placed; bi += 1) {
          for (let wi = 0; wi < candidate.letters.length && !placed; wi += 1) {
            if (base.letters[bi] !== candidate.letters[wi]) continue;
            const [r, c] = basePositions[bi];
            const attempt = {
              ...candidate,
              direction,
              row: direction === 'down' ? r - wi : r,
              col: direction === 'across' ? c - wi : c,
            };
            if (inspect([...list, attempt])) placed = attempt;
          }
        }
        if (placed) break;
      }
      if (placed) break;
    }

    if (!placed) return null;
    list.push(placed);
  }

  const result = inspect(list);
  if (!result) return null;
  const average = list.reduce((sum, item) => sum + item.difficulty, 0) / list.length;
  if (average > targetDifficulty) return null;

  return { list, grid: result.grid, average, fresh: list.filter((item) => item.uses === 0).length };
}

let best = null;
const seedOffset = Math.floor(Math.random() * 1000000);
for (let seed = 1; seed <= seedCount; seed += 1) {
  const result = build(seed + seedOffset);
  if (!result) continue;
  if (result.average < minDifficulty) continue;
  if (!best || result.fresh > best.fresh || (result.fresh === best.fresh && result.average < best.average)) {
    best = result;
  }
  if (best.fresh === targetWords && best.average <= targetDifficulty && best.average >= minDifficulty) break;
}

if (!best) {
  console.error('조건을 만족하는 배치를 찾지 못했습니다. --seeds 값을 늘리거나 조건을 조정하세요.');
  process.exit(1);
}

const ordered = [...best.list].sort((a, b) => a.row - b.row || a.col - b.col);

// 난이도별 시리즈 번호 계산 (E-1, N-1, H-1 형식)
const prefix = isEasy ? 'E' : isHard ? 'H' : 'N';
const outputFilePath = path.join(mapsDir, outputFile);
const fileExists = fs.existsSync(outputFilePath);

// 기존 맵이 있으면 타이틀 유지, 없으면 시리즈 번호 새로 부여
let title;
if (fileExists) {
  const existingMap = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
  title = existingMap.title;
} else {
  const existingMaps = fs.readdirSync(mapsDir)
    .filter(f => /^crosswordMap\d+\.json$/.test(f) && f !== outputFile)
    .map(f => {
      const m = JSON.parse(fs.readFileSync(path.join(mapsDir, f), 'utf8'));
      return { file: f, title: m.title };
    });
  const sameTitlePrefixCount = existingMaps.filter((m) => m.title?.startsWith(`${prefix}-`)).length;
  title = `${prefix}-${sameTitlePrefixCount + 1}`;
}

// id 생성: 날짜 기반 (YYYYMMDD_NNN) 형식, 카운터 파일로 삭제 후 재생성 충돌 방지
const today = new Date();
const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
const counterFile = path.join(mapsDir, '.lastMapId');
let lastCounter = { date: '', seq: 0 };
if (fs.existsSync(counterFile)) {
  try { lastCounter = JSON.parse(fs.readFileSync(counterFile, 'utf8')); } catch {}
}
const allIds = fs.readdirSync(mapsDir)
  .filter(f => /^crosswordMap\d+\.json$/.test(f))
  .map(f => JSON.parse(fs.readFileSync(path.join(mapsDir, f), 'utf8')).id);
let maxSeqForToday = 0;
allIds.forEach(id => {
  const match = id && id.match(/^(\d{8})_(\d+)$/);
  if (match && match[1] === dateStr) maxSeqForToday = Math.max(maxSeqForToday, parseInt(match[2]));
});
if (lastCounter.date === dateStr) maxSeqForToday = Math.max(maxSeqForToday, lastCounter.seq);
const newSeq = maxSeqForToday + 1;
const newId = `${dateStr}_${String(newSeq).padStart(3, '0')}`;
fs.writeFileSync(counterFile, JSON.stringify({ date: dateStr, seq: newSeq }), 'utf8');

const map = {
  id: newId,
  title,
  difficulty: Math.max(1, Math.round(best.average * 10) / 10),
  width: size,
  height: size,
  sourceData: './bibleWordsLib1.json',
  grid: best.grid.map((row) => row.map((value) => value || '#').join('')),
  cells: ordered.map((item, index) => ({
    number: index + 1,
    answer: item.word,
    direction: item.direction,
    row: item.row,
    col: item.col,
    length: item.letters.length,
    wordId: item.id,
  })),
};

fs.writeFileSync(path.join(mapsDir, outputFile), `${JSON.stringify(map, null, 2)}\n`);
console.log(`${outputFile} 생성: ${size}x${size}, 단어 ${map.cells.length}개, 평균 난이도 ${best.average.toFixed(2)}, 새 단어 ${best.fresh}개`);
