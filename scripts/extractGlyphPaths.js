const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const fontPath = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansKR.ttf');
const fontBuffer = fs.readFileSync(fontPath);
const font = opentype.parse(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));

// 기본 폰트에 없는 희귀 글자용 대체 폰트
const fallbackPath = path.join(__dirname, '..', 'assets', 'fonts', 'UhBeeGmin2Bold.ttf');
const fallbackBuffer = fs.readFileSync(fallbackPath);
const fallbackFont = opentype.parse(fallbackBuffer.buffer.slice(fallbackBuffer.byteOffset, fallbackBuffer.byteOffset + fallbackBuffer.byteLength));

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
let fallbackCount = 0;
const ascent72 = (font.ascender / font.unitsPerEm) * 72;
chars.forEach((ch) => {
  let glyph = font.charToGlyph(ch);
  let activeFont = font;
  if (!glyph || glyph.index === 0) {
    glyph = fallbackFont.charToGlyph(ch);
    activeFont = fallbackFont;
    if (!glyph || glyph.index === 0) return;
    fallbackCount++;
  }
  const y72 = (activeFont.ascender / activeFont.unitsPerEm) * 72;
  const p = glyph.getPath(0, y72, 72);
  // opentype.js toPathData 버그 회피: 27.000000000000004 같은 부동소수점 오차 좌표를 넣으면 NaN을 출력한다
  p.commands.forEach((cmd) => {
    ['x', 'y', 'x1', 'y1', 'x2', 'y2'].forEach((k) => {
      if (typeof cmd[k] === 'number') cmd[k] = Math.round(cmd[k] * 100) / 100;
    });
  });
  const pathData = p.toPathData(2);
  if (pathData && pathData.length > 2) {
    const bb = p.getBoundingBox();
    const approxLen = Math.ceil((Math.sqrt((bb.x2 - bb.x1) ** 2 + (bb.y2 - bb.y1) ** 2)) * 3);
    const advanceWidth = (glyph.advanceWidth / activeFont.unitsPerEm) * 72;
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
    // 구멍 윤곽 병합: 다른 윤곽 안에 완전히 포함된 sub-path(ㅇ, ㅎ 등의 안쪽 원)는
    // 바깥 윤곽과 같은 path로 묶어 evenodd로 그려야 구멍이 뚫린다
    const isInside = (inner, outer) =>
      inner.x1 > outer.x1 && inner.x2 < outer.x2 && inner.y1 > outer.y1 && inner.y2 < outer.y2;
    const merged = subBounds
      .filter((s) => !subBounds.some((o) => isInside(s, o)))
      .map((outer) => ({
        ...outer,
        d: outer.d + subBounds.filter((s) => isInside(s, outer)).map((s) => s.d).join(''),
      }));
    // 자모 단위 병합: 음절을 유니코드 분해해 자모 글리프(U+1100~)의 bbox를 구하고,
    // 각 윤곽을 가장 많이 겹치는 자모에 배정한다 (자모 글리프는 합성 위치로 설계됨)
    const code = ch.codePointAt(0);
    let regrouped = false;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const rel = code - 0xac00;
      const jamoCodes = [0x1100 + Math.floor(rel / 588), 0x1161 + Math.floor((rel % 588) / 28)];
      if (rel % 28 !== 0) jamoCodes.push(0x11a7 + (rel % 28));
      // 자모 글리프는 합성 위치로 설계됨 — 자모의 윤곽별 bbox를 구하고,
      // 각 윤곽을 IoU가 가장 큰 자모에 배정한다 (겹침이 없으면 bbox 거리가 가장 가까운 쪽)
      const jamoBoxes = jamoCodes.map((jc) => {
        const jg = font.charToGlyph(String.fromCodePoint(jc));
        if (!jg || jg.index === 0) return null;
        const jp = jg.getPath(0, y72, 72);
        jp.commands.forEach((cmd) => {
          ['x', 'y', 'x1', 'y1', 'x2', 'y2'].forEach((k) => {
            if (typeof cmd[k] === 'number') cmd[k] = Math.round(cmd[k] * 100) / 100;
          });
        });
        return jp.toPathData(2).split(/(?=M)/).filter((s) => s.trim().length > 2).map((sp) => {
          const nums = sp.match(/-?\d+\.?\d*/g);
          const xs = [], ys = [];
          for (let i = 0; i < nums.length; i++) {
            const v = parseFloat(nums[i]);
            if (i % 2 === 0) xs.push(v); else ys.push(v);
          }
          return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
        });
      });
      if (jamoBoxes.every((bx) => bx && bx.length > 0)) {
        const groups = jamoBoxes.map(() => []);
        merged.forEach((s) => {
          const sArea = Math.max(1, (s.x2 - s.x1) * (s.y2 - s.y1));
          let best = 0, bestIou = -1, bestGap = Infinity;
          jamoBoxes.forEach((boxes, ji) => {
            boxes.forEach((jb) => {
              const iw = Math.max(0, Math.min(s.x2, jb.x2) - Math.max(s.x1, jb.x1));
              const ih = Math.max(0, Math.min(s.y2, jb.y2) - Math.max(s.y1, jb.y1));
              const inter = iw * ih;
              const union = sArea + (jb.x2 - jb.x1) * (jb.y2 - jb.y1) - inter;
              const iou = inter / Math.max(1, union);
              const gap = Math.max(0, Math.max(s.x1 - jb.x2, jb.x1 - s.x2)) +
                Math.max(0, Math.max(s.y1 - jb.y2, jb.y1 - s.y2));
              if (iou > bestIou || (iou === bestIou && gap < bestGap)) {
                bestIou = iou; bestGap = gap; best = ji;
              }
            });
          });
          groups[best].push(s);
        });
        // 자모 그룹이 하나도 비지 않았을 때만 채택 (초성→중성→종성 순서 유지)
        const regroupedSubs = groups.filter((g) => g.length > 0).map((g) => ({
          d: g.map((s) => s.d).join(''),
          x1: Math.min(...g.map((s) => s.x1)), y1: Math.min(...g.map((s) => s.y1)),
          x2: Math.max(...g.map((s) => s.x2)), y2: Math.max(...g.map((s) => s.y2)),
        }));
        merged.length = 0;
        merged.push(...regroupedSubs);
        regrouped = groups.every((g) => g.length > 0);
      }
    }
    // regroup 실패 시 폴백 정렬: 초성(위쪽) → 중성(위쪽/오른쪽) → 종성(아래쪽)
    // 1. 글리프의 수직 중앙값 기준으로 위쪽/아래쪽 그룹 분할
    // 2. 위쪽 그룹: x1 기준 정렬 (초성이 왼쪽, 중성이 오른쪽)
    // 3. 아래쪽 그룹: x1 기준 정렬 (종성)
    const glyphMidY = (bb.y1 + bb.y2) / 2;
    const upper = merged.filter((s) => (s.y1 + s.y2) / 2 < glyphMidY + 5);
    const lower = merged.filter((s) => (s.y1 + s.y2) / 2 >= glyphMidY + 5);
    upper.sort((a, b) => a.x1 - b.x1);
    lower.sort((a, b) => a.x1 - b.x1);
    const sorted = regrouped ? merged : [...upper, ...lower];
    glyphPaths[ch] = { d: pathData, len: approxLen, w: advanceWidth, bb: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 }, subs: sorted };
    count++;
  }
});

console.log(`Extracted glyph paths: ${count} (fallback font: ${fallbackCount})`);

const outPath = path.join(__dirname, '..', 'data', 'glyphPaths.json');
fs.writeFileSync(outPath, JSON.stringify(glyphPaths, null, 0), 'utf8');
console.log(`Saved to: ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
