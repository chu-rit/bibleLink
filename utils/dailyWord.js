import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebaseConfig';
import localWords from '../data/words2/dailyWords.json';

// 선정 알고리즘 변경 시 버전을 올리면 이전 캐시가 무시되어 전원 새 단어로 전환된다
const CACHE_VERSION = 'v4';
const CACHE_PREFIX = 'dailyWord_';
const GAME_PREFIX = 'dailyWordGame_';
const FIRESTORE_TIMEOUT_MS = 4000;
const FIRESTORE_SUBMIT_TIMEOUT_MS = 15000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('firestore timeout')), ms)),
  ]);
}

/** 날짜별 게임 진행 내역 저장/복원. 같은 날 같은 단어일 때만 복원된다 */
export async function loadGameState(dateKey, wordId) {
  try {
    const raw = await AsyncStorage.getItem(GAME_PREFIX + dateKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved.wordId === wordId ? saved : null;
  } catch {
    return null;
  }
}

export async function saveGameState(dateKey, state) {
  try {
    await AsyncStorage.setItem(GAME_PREFIX + dateKey, JSON.stringify(state));
  } catch {
    // 저장 실패해도 계속 진행
  }
}

export async function clearGameState(dateKey) {
  try {
    await AsyncStorage.removeItem(GAME_PREFIX + dateKey);
  } catch {
    // 실패해도 계속 진행
  }
}

// KST(UTC+9) 밤 11시를 하루 경계로 하는 날짜 키 (23시에 다음 날 단어로 전환)
export function todayKey(now = new Date()) {
  return new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 날짜 시드로 동일한 단어를 결정하는 폴백 (오프라인·미설정 시 모든 유저 동일)
// 난이도 1~2 풀에서 날짜 시드로 랜덤 선정하되, 최근 50일 동안 출제된 단어는
// 사용 이력에서 제외해 같은 단어가 50일 안에 다시 나오지 않는다.
// (제외 기간을 풀 크기에 가깝게 하면 후보가 1개만 남아 랜덤이 안 되므로 여유를 둔다)
const RECENT_EXCLUDE_DAYS = 50;
const PICKS_EPOCH = '2026-09-19';
const ORDER_SEED = 'daily-word-order-v1';

function wordHash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function daysBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// 최근 실제 출제 단어를 사용 이력 초기값으로 둔다. 윈도우에서 밀려나면 자동 복귀
const SEED_RECENT_PICKS = ['abel', 'jacob', 'joseph'];

function seededIndex(dateKey) {
  const pool = localWords.filter((w) => w.difficulty <= 2);
  const excludeDays = Math.min(RECENT_EXCLUDE_DAYS, pool.length - 2);
  const picks = [...SEED_RECENT_PICKS];
  const pickFor = (key) => {
    // 사용 이력에서 오래된 것부터 빠지는 슬라이딩 윈도우
    const recentIds = new Set(picks.slice(-excludeDays));
    const candidates = pool.filter((w) => !recentIds.has(w.id));
    const usable = candidates.length > 0 ? candidates : pool;
    const rand = mulberry32(wordHash(ORDER_SEED + key));
    return usable[Math.floor(rand() * usable.length)];
  };
  let key = PICKS_EPOCH;
  while (key < dateKey) {
    picks.push(pickFor(key).id);
    key = nextDateKey(key);
  }
  return pickFor(dateKey);
}

export function getLocalWord(dateKey = todayKey()) {
  return seededIndex(dateKey);
}

async function readCache(dateKey) {
  try {
    const wordId = await AsyncStorage.getItem(CACHE_PREFIX + CACHE_VERSION + '_' + dateKey);
    return wordId ? localWords.find((w) => w.id === wordId) || null : null;
  } catch {
    return null;
  }
}

async function writeCache(dateKey, wordId) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + CACHE_VERSION + '_' + dateKey, wordId);
  } catch {
    // 저장 실패해도 계속 진행
  }
}

/**
 * 오늘의 단어 조회
 * 우선순위: 로컬 캐시 -> Firestore dailyWords/{date} -> 날짜 시드 로컬 선정
 * 반환: { entry, source } source: 'cache' | 'remote' | 'local'
 */
const USER_KEY = 'dailyWordUser';

export async function getUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveUser(user) {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // 저장 실패해도 계속 진행
  }
}

function createUserId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getOrCreateUser() {
  const user = await getUser();
  if (user?.userId) return user;
  const nextUser = { ...user, userId: createUserId() };
  await saveUser(nextUser);
  return nextUser;
}

// 게임 결과 제출. 정답 확인 후 바로 기록
export async function submitResult(dateKey, { userId, nickname, attempts, success, duration }) {
  if (!db) return { ok: false, error: 'firebase-not-configured' };
  try {
    await withTimeout(addDoc(collection(db, 'rankings'), {
      date: CACHE_VERSION + '_' + dateKey,
      userId,
      nickname,
      attempts,
      success,
      duration,
      submittedAt: serverTimestamp(),
    }), FIRESTORE_SUBMIT_TIMEOUT_MS);
    return { ok: true };
  } catch (error) {
    console.error('[dailyWord] ranking submit failed', error?.code, error?.message);
    return { ok: false, error: error?.code || error?.message || 'unknown-error' };
  }
}

// 당일 랭킹 조회 — 정답 제출 시각이 빠른 순
export async function fetchRankings(dateKey, userId) {
  const empty = { rankings: [], myRank: null };
  if (!db) return empty;
  try {
    const q = query(collection(db, 'rankings'), where('date', '==', CACHE_VERSION + '_' + dateKey));
    const snap = await withTimeout(getDocs(q), FIRESTORE_TIMEOUT_MS);
    const toMillis = (value) => {
      if (value?.toMillis) return value.toMillis();
      const parsed = Date.parse(value || '');
      return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    };
    const sorted = snap.docs
      .map((d) => d.data())
      .filter((entry) => entry.success)
      .sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt));
    const rankings = sorted.slice(0, 10).map((entry) => ({ ...entry, isMine: entry.userId === userId }));
    const myIndex = sorted.findIndex((entry) => entry.userId === userId);
    const myRank = myIndex >= 0 ? { ...sorted[myIndex], rank: myIndex + 1, isMine: true } : null;
    return { rankings, myRank };
  } catch {
    return empty;
  }
}

export async function getTodayWord() {
  const dateKey = todayKey();

  const cached = await readCache(dateKey);
  if (cached) return { entry: cached, source: 'cache' };

  if (isFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'dailyWords', dateKey)), FIRESTORE_TIMEOUT_MS);
      if (snap.exists()) {
        const entry = localWords.find((w) => w.id === snap.data().wordId);
        if (entry) {
          await writeCache(dateKey, entry.id);
          return { entry, source: 'remote' };
        }
      }
    } catch {
      // 네트워크 오류 시 폴백
    }
  }

  return { entry: getLocalWord(dateKey), source: 'local' };
}
