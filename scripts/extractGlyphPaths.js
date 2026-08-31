const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const fontPath = path.join(__dirname, '..', 'assets', 'fonts', 'UhBeeGmin2.ttf');
const fontBuffer = fs.readFileSync(fontPath);
const font = opentype.parse(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));

// 맵에서 사용되는 모든 글자 수집
const mapsDir = path.join(__dirname, '..', 'data', 'maps');
const files = fs.readdirSync(mapsDir).filter((f) => /^crosswordMap\d+\.json$/.test(f));
const chars = new Set();
files.forEach((f) => {
  const map = JSON.parse(fs.readFileSync(path.join(mapsDir, f), 'utf8'));
  map.cells.forEach((cell) => {
    [...cell.answer].forEach((ch) => chars.add(ch));
  });
});

// 단어 라이브러리에서도 모든 글자 수집 (힌트 등에서 표시될 수 있음)
const wordsPath = path.join(__dirname, '..', 'data', 'words', 'bibleWordsLib1.json');
const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
words.forEach((w) => {
  if (w.word) [...w.word].forEach((ch) => chars.add(ch));
});

console.log(`Total unique characters: ${chars.size}`);

const glyphPaths = {};
let count = 0;
const ascent72 = (font.ascender / font.unitsPerEm) * 72;
chars.forEach((ch) => {
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0) return;
  const p = glyph.getPath(0, ascent72, 72);
  const pathData = p.toPathData(2);
  if (pathData && pathData.length > 2) {
    const bb = p.getBoundingBox();
    const approxLen = Math.ceil((Math.sqrt((bb.x2 - bb.x1) ** 2 + (bb.y2 - bb.y1) ** 2)) * 3);
    const advanceWidth = (glyph.advanceWidth / font.unitsPerEm) * 72;
    // sub-path 분할: M 명령으로 시작하는 각 윤곽을 분리 (자모 단위)
    const subPaths = pathData.split(/(?=M)/).filter((s) => s.trim().length > 2);
    // 각 sub-path의 bounding box 계산
    const subBounds = subPaths.map((sp) => {
      const nums = sp.match(/-?\d+\.?\d*/g);
      if (!nums) return null;
      const xs = [], ys = [];
      for (let i = 0; i < nums.length; i++) {
        const v = parseFloat(nums[i]);
        if (i % 2 === 0) xs.push(v); else ys.push(v);
      }
      return {
        d: sp,
        x1: Math.min(...xs), y1: Math.min(...ys),
        x2: Math.max(...xs), y2: Math.max(...ys),
      };
    }).filter(Boolean);
    // 쓰기 순서 정렬: 초성(위쪽) → 중성(위쪽/오른쪽) → 종성(아래쪽)
    // 1. 글리프의 수직 중앙값 기준으로 위쪽/아래쪽 그룹 분할
    // 2. 위쪽 그룹: x1 기준 정렬 (초성이 왼쪽, 중성이 오른쪽)
    // 3. 아래쪽 그룹: x1 기준 정렬 (종성)
    const glyphMidY = (bb.y1 + bb.y2) / 2;
    const upper = subBounds.filter((s) => (s.y1 + s.y2) / 2 < glyphMidY + 5);
    const lower = subBounds.filter((s) => (s.y1 + s.y2) / 2 >= glyphMidY + 5);
    upper.sort((a, b) => a.x1 - b.x1);
    lower.sort((a, b) => a.x1 - b.x1);
    const sorted = [...upper, ...lower];
    glyphPaths[ch] = { d: pathData, len: approxLen, w: advanceWidth, bb: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 }, subs: sorted };
    count++;
  }
});

console.log(`Extracted glyph paths: ${count}`);

const outPath = path.join(__dirname, '..', 'data', 'glyphPaths.json');
fs.writeFileSync(outPath, JSON.stringify(glyphPaths, null, 0), 'utf8');
console.log(`Saved to: ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
