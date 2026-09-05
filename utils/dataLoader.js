/**
 * 원격 데이터 로더
 * - AsyncStorage 캐시 읽기/쓰기
 * - 원격 manifest.json 요청 및 버전 비교
 * - 원격 단어·맵 JSON 다운로드
 * - 기본 구조 검증
 * - fallback 우선순위: 원격 최신 -> 캐시 -> 번들 기본
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import bundledWords from '../data/words/bibleWordsLib1.json';
import bundledMaps from '../data/maps/crosswordMaps';

const REMOTE_BASE = 'https://chu-rit.github.io/bibleLink';
const MANIFEST_URL = `${REMOTE_BASE}/data/manifest.json`;
const FETCH_TIMEOUT = 8000;

const CACHE_KEYS = {
  version: 'dataVersion',
  words: 'cachedWords',
  maps: 'cachedMaps',
};

/**
 * timeout이 있는 fetch
 */
function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  return Promise.race([
    fetch(url, { cache: 'no-store' }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeout)
    ),
  ]);
}

/**
 * 단어 데이터 기본 구조 검증
 */
function validateWords(data) {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  const sample = data[0];
  if (!sample || typeof sample !== 'object') return false;
  if (!('id' in sample) || !('word' in sample) || !('definition' in sample)) return false;
  return true;
}

/**
 * 맵 데이터 기본 구조 검증
 */
function validateMaps(data) {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  for (const map of data) {
    if (!map || typeof map !== 'object') return false;
    if (!('id' in map) || !('cells' in map) || !('grid' in map)) return false;
    if (!Array.isArray(map.cells) || !Array.isArray(map.grid)) return false;
  }
  return true;
}

/**
 * 맵의 wordId가 단어 데이터의 id와 연결되는지 확인
 */
function validateWordMapLinks(words, maps) {
  const wordIds = new Set(words.map((w) => w.id));
  for (const map of maps) {
    for (const cell of map.cells) {
      if (cell.wordId && !wordIds.has(cell.wordId)) return false;
    }
  }
  return true;
}

/**
 * 캐시에서 데이터 읽기
 */
async function readCache() {
  try {
    const [version, words, maps] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEYS.version),
      AsyncStorage.getItem(CACHE_KEYS.words),
      AsyncStorage.getItem(CACHE_KEYS.maps),
    ]);
    return {
      version: version || null,
      words: words ? JSON.parse(words) : null,
      maps: maps ? JSON.parse(maps) : null,
    };
  } catch {
    return { version: null, words: null, maps: null };
  }
}

/**
 * 캐시에 데이터 저장
 */
async function writeCache(version, words, maps) {
  try {
    await Promise.all([
      AsyncStorage.setItem(CACHE_KEYS.version, version),
      AsyncStorage.setItem(CACHE_KEYS.words, JSON.stringify(words)),
      AsyncStorage.setItem(CACHE_KEYS.maps, JSON.stringify(maps)),
    ]);
  } catch {
    // 저장 실패해도 메모리 데이터로 계속 진행
  }
}

/**
 * 버전 비교: remote가 더 최신이면 true
 */
function isRemoteNewer(remoteVersion, localVersion) {
  if (!localVersion) return true;
  return remoteVersion !== localVersion;
}

/**
 * 전체 데이터 로딩 흐름
 * 반환: { words, maps, status }
 * status: 'remote' | 'cache' | 'bundled'
 */
export async function loadAppData(onStatus) {
  // 1. 캐시 읽기
  const cache = await readCache();

  // 캐시 유효성 검사
  let cacheValid = false;
  if (cache.words && cache.maps) {
    if (validateWords(cache.words) && validateMaps(cache.maps)) {
      if (validateWordMapLinks(cache.words, cache.maps)) {
        cacheValid = true;
      }
    }
  }
  if (!cacheValid) {
    cache.words = null;
    cache.maps = null;
  }

  // 2. 원격 manifest 요청
  try {
    if (onStatus) onStatus('checking');
    const manifest = await fetchWithTimeout(MANIFEST_URL);

    if (!manifest || !manifest.version) {
      throw new Error('invalid manifest');
    }

    // 3. 버전 비교
    if (isRemoteNewer(manifest.version, cache.version) || !cacheValid) {
      if (onStatus) onStatus('downloading');

      const wordsUrl = manifest.words
        ? `${REMOTE_BASE}/${manifest.words}`
        : `${REMOTE_BASE}/data/words/bibleWordsLib1.json`;
      const mapsUrl = manifest.maps
        ? `${REMOTE_BASE}/${manifest.maps}`
        : `${REMOTE_BASE}/data/maps/crosswordMaps.json`;

      const [remoteWords, remoteMaps] = await Promise.all([
        fetchWithTimeout(wordsUrl),
        fetchWithTimeout(mapsUrl),
      ]);

      // 4. 검증
      if (validateWords(remoteWords) && validateMaps(remoteMaps)) {
        if (validateWordMapLinks(remoteWords, remoteMaps)) {
          // 5. 캐시 저장
          await writeCache(manifest.version, remoteWords, remoteMaps);
          return { words: remoteWords, maps: remoteMaps, status: 'remote' };
        }
      }
      // 검증 실패 시 캐시나 번들로 fallback
    } else {
      // 원격이 최신이 아니면 캐시 사용
      if (cacheValid) {
        return { words: cache.words, maps: cache.maps, status: 'cache' };
      }
    }
  } catch {
    // 네트워크 오류 시 fallback
  }

  // 6. 캐시 fallback
  if (cacheValid) {
    return { words: cache.words, maps: cache.maps, status: 'cache' };
  }

  // 7. 번들 기본 데이터
  return { words: bundledWords, maps: bundledMaps, status: 'bundled' };
}

export { bundledWords, bundledMaps };
