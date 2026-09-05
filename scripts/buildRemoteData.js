/**
 * 원격 배포용 데이터 파일을 생성한다.
 * - data/manifest.json (버전 정보)
 * - data/maps/crosswordMaps.json (모든 맵을 하나로 합친 JSON)
 * - data/words/bibleWordsLib1.json (이미 merge:lib1로 생성됨)
 *
 * 사용: npm run build:data
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const MAPS_DIR = path.join(DATA_DIR, 'maps');
const WORDS_DIR = path.join(DATA_DIR, 'words');

// .lastMapId 읽기
const lastMapIdPath = path.join(MAPS_DIR, '.lastMapId');
const lastMapId = JSON.parse(fs.readFileSync(lastMapIdPath, 'utf8'));
const version = `${lastMapId.date}.${lastMapId.seq}`;

// 맵 파일 합치기
const mapFiles = fs.readdirSync(MAPS_DIR)
  .filter(f => /^crosswordMap\d+\.json$/.test(f))
  .sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0], 10);
    const nb = parseInt(b.match(/\d+/)[0], 10);
    return na - nb;
  });

const maps = mapFiles.map(f => {
  const filePath = path.join(MAPS_DIR, f);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
});

const mapsOutputPath = path.join(MAPS_DIR, 'crosswordMaps.json');
fs.writeFileSync(mapsOutputPath, JSON.stringify(maps, null, 2));
console.log(`crosswordMaps.json created with ${maps.length} maps`);

// manifest.json 생성
const manifest = {
  version,
  words: 'data/words/bibleWordsLib1.json',
  maps: 'data/maps/crosswordMaps.json',
};

const manifestPath = path.join(DATA_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json created with version ${version}`);
