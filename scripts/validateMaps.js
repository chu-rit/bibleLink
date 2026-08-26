const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const MAX_WORD_USES = 2;
const EASY_MAX_DIFFICULTY = 1.8;

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
const normalize = (value) => value.replace(/\s/g, '').trim();

const words = readJson('bibleWordsLib1.json');
const wordById = new Map(words.map((item) => [item.id, item]));
const mapFiles = fs
  .readdirSync(dataDir)
  .filter((file) => /^crosswordMap\d+\.json$/.test(file))
  .sort();

const errors = [];
const usage = new Map();
const mapIds = new Map();

const cellsOf = (item) =>
  Array.from({ length: item.length }, (_, i) => [
    item.row + (item.direction === 'down' ? i : 0),
    item.col + (item.direction === 'across' ? i : 0),
  ]);

mapFiles.forEach((file) => {
  const map = readJson(file);
  const fail = (message) => errors.push(`${file}: ${message}`);

  if (mapIds.has(map.id)) fail(`id "${map.id}"가 ${mapIds.get(map.id)}와 중복됩니다`);
  mapIds.set(map.id, file);

  if (map.grid.length !== map.height) fail(`grid 행 수(${map.grid.length})가 height(${map.height})와 다릅니다`);
  map.grid.forEach((row, index) => {
    if ([...row].length !== map.width) fail(`grid ${index}행 길이(${[...row].length})가 width(${map.width})와 다릅니다`);
  });

  const grid = map.grid.map((row) => [...row]);
  const owners = new Map();
  const numbers = new Set();

  map.cells.forEach((item) => {
    const label = `${item.number}번(${item.answer})`;
    if (numbers.has(item.number)) fail(`number ${item.number}가 중복됩니다`);
    numbers.add(item.number);

    if (!['across', 'down'].includes(item.direction)) fail(`${label} direction이 잘못되었습니다`);
    if (!wordById.has(item.wordId)) fail(`${label} wordId "${item.wordId}"를 단어 데이터에서 찾을 수 없습니다`);

    const answer = [...normalize(item.answer)];
    if (answer.length !== item.length) fail(`${label} 글자 수(${answer.length})가 length(${item.length})와 다릅니다`);

    cellsOf(item).forEach(([r, c], i) => {
      if (r < 0 || r >= map.height || c < 0 || c >= map.width) {
        fail(`${label}가 맵 범위를 벗어납니다`);
        return;
      }
      if (grid[r][c] !== answer[i]) fail(`${label} ${i + 1}번째 글자가 grid(${r},${c})와 다릅니다`);
      const key = `${r},${c}`;
      if (!owners.has(key)) owners.set(key, []);
      owners.get(key).push(item);
    });

    usage.set(item.wordId, [...(usage.get(item.wordId) || []), file]);
  });

  const openCells = [];
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value !== '#') openCells.push([r, c]);
    })
  );

  openCells.forEach(([r, c]) => {
    const list = owners.get(`${r},${c}`) || [];
    if (!list.length) fail(`(${r},${c}) 칸을 사용하는 단어가 없습니다`);
    if (list.length > 2) fail(`(${r},${c}) 칸에 단어가 ${list.length}개 겹칩니다`);
    if (new Set(list.map((item) => item.direction)).size !== list.length) {
      fail(`(${r},${c}) 칸에서 같은 방향 단어가 겹칩니다`);
    }
  });

  const crossCount = new Map(map.cells.map((item) => [item, 0]));
  owners.forEach((list) => {
    if (list.length === 2) list.forEach((item) => crossCount.set(item, crossCount.get(item) + 1));
  });
  crossCount.forEach((count, item) => {
    if (!count) fail(`${item.number}번(${item.answer})가 다른 단어와 교차하지 않습니다`);
  });

  const sharesWord = (a, b, direction) =>
    (owners.get(a) || []).some((item) => item.direction === direction && (owners.get(b) || []).includes(item));

  openCells.forEach(([r, c]) => {
    const right = `${r},${c + 1}`;
    const below = `${r + 1},${c}`;
    if (owners.has(right) && !sharesWord(`${r},${c}`, right, 'across')) {
      fail(`(${r},${c})와 (${r},${c + 1})이 같은 가로 단어가 아닌데 맞닿아 있습니다`);
    }
    if (owners.has(below) && !sharesWord(`${r},${c}`, below, 'down')) {
      fail(`(${r},${c})와 (${r + 1},${c})이 같은 세로 단어가 아닌데 맞닿아 있습니다`);
    }
    if (owners.has(right) && owners.has(below) && owners.has(`${r + 1},${c + 1}`)) {
      fail(`(${r},${c})에서 시작하는 2x2 구간이 모두 열려 있습니다`);
    }
  });

  const visited = new Set();
  const queue = map.cells.length ? [map.cells[0]] : [];
  while (queue.length) {
    const item = queue.pop();
    if (visited.has(item)) continue;
    visited.add(item);
    cellsOf(item).forEach(([r, c]) => {
      (owners.get(`${r},${c}`) || []).forEach((other) => {
        if (!visited.has(other)) queue.push(other);
      });
    });
  }
  if (visited.size !== map.cells.length) fail(`단어 ${map.cells.length - visited.size}개가 퍼즐 구조에서 고립되어 있습니다`);

  const difficulties = map.cells.map((item) => wordById.get(item.wordId)?.difficulty).filter(Boolean);
  const average = difficulties.reduce((sum, value) => sum + value, 0) / (difficulties.length || 1);
  if (map.difficulty <= EASY_MAX_DIFFICULTY) {
    if (map.width !== 8 || map.height !== 8) fail('이지 맵은 8x8이어야 합니다');
    if (map.cells.length !== 10) fail('이지 맵은 단어 10개여야 합니다');
    if (average < 1 || average > EASY_MAX_DIFFICULTY) {
      fail(`이지 맵의 실제 평균 난이도(${average.toFixed(2)})가 1.0~1.8 범위를 벗어납니다`);
    }
  } else if (map.difficulty >= 2.6) {
    if (map.width !== 12 || map.height !== 12) fail('하드 맵은 12x12이어야 합니다');
    if (map.cells.length !== 20) fail('하드 맵은 단어 20개여야 합니다');
    if (average < 2.6) fail(`하드 맵의 실제 평균 난이도(${average.toFixed(2)})가 2.6 이상이어야 합니다`);
  }
  console.log(
    `${file}: ${map.width}x${map.height}, 단어 ${map.cells.length}개, 평균 난이도 ${average.toFixed(2)}`
  );
});

const reused = [...usage.entries()].filter(([, files]) => files.length > 1);
if (reused.length) {
  console.log('\n재사용된 단어');
  reused.forEach(([id, files]) => {
    console.log(`  ${wordById.get(id)?.word || id}: ${files.length}회 (${files.join(', ')})`);
    if (files.length > MAX_WORD_USES) {
      errors.push(`${wordById.get(id)?.word || id} 단어가 ${files.length}회 사용되어 허용치(${MAX_WORD_USES}회)를 넘었습니다`);
    }
  });
}

console.log(`\n사용한 단어 ${usage.size}개 / 전체 ${words.length}개, 남은 단어 ${words.length - usage.size}개`);

if (errors.length) {
  console.error('\n검증 실패');
  errors.forEach((message) => console.error(`  ${message}`));
  process.exit(1);
}

console.log('\n검증 통과');
