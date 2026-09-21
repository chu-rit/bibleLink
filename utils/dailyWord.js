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

const STREAK_KEY = 'dailyWordStreak';

export function prevDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

// 연승 기록: { streak, lastWinDate, lastLostDate }
// 승리: 어제 이겼으면 +1, 아니면 1부터. 같은 날 재승리(마스터 초기화)는 중복 카운트 안 함
// 패배: lastLostDate만 기록하고 streak는 유지 — 같은 날 초기화 후 재승리하면 이어지도록
export async function recordDailyResult(dateKey, won) {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    let { streak = 0, lastWinDate, lastLostDate } = saved;
    if (won) {
      if (lastWinDate !== dateKey) {
        streak = lastWinDate === prevDateKey(dateKey) ? streak + 1 : 1;
        lastWinDate = dateKey;
      }
      if (lastLostDate === dateKey) lastLostDate = undefined;
    } else {
      lastLostDate = dateKey;
    }
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ streak, lastWinDate, lastLostDate }));
    return streak;
  } catch {
    return 0;
  }
}

// 화면에 표시할 현재 연승. 오늘 실패했거나 마지막 승리가 어제보다 전이면(하루 이상 건너뜀) 0
export async function getDailyStreak(dateKey = todayKey()) {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const { streak = 0, lastWinDate, lastLostDate } = JSON.parse(raw);
    if (lastLostDate === dateKey) return 0;
    if (lastWinDate === dateKey || lastWinDate === prevDateKey(dateKey)) return streak;
    return 0;
  } catch {
    return 0;
  }
}

// 서버 이력이 계산한 연승으로 로컬값을 덮어쓴다 (조작·드리프트 자동 교정)
export async function overrideDailyStreak(dateKey, streak) {
  try {
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ streak, lastWinDate: dateKey }));
  } catch {
    // 실패해도 계속 진행
  }
}

// 내 랭킹 이력에서 "어제까지 연속으로 성공한 일수"를 계산
// day 필드는 규칙이 서버 시간과 대조해 검증하므로 과거 날짜를 소급해 채울 수 없다
// 반환 null이면 조회 실패 — 호출 측에서 로컬 연승으로 폴백
export async function fetchStreakBeforeToday(userId) {
  if (!db || !userId) return null;
  try {
    const q = query(collection(db, 'rankings'), where('userId', '==', userId));
    const snap = await withTimeout(getDocs(q), FIRESTORE_TIMEOUT_MS);
    const days = new Set(
      snap.docs
        .map((d) => d.data())
        .filter((entry) => entry.success)
        .map((entry) => entry.day)
        .filter(Number.isInteger)
    );
    let day = todayDayNum() - 1;
    let streak = 0;
    while (days.has(day)) {
      streak += 1;
      day -= 1;
    }
    return streak;
  } catch {
    return null;
  }
}

// 서버 시간과 기기 시계의 차이(ms). getTodayWord() 첫 호출 때 1회 동기화하고
// 실패하면 0으로 두어 기기 시간을 그대로 사용한다
let serverOffsetMs = 0;
let timeSyncPromise = null;

// Firestore에 ping 문서를 쓰고 읽어 서버 시각을 구한다 (애드블록/오프라인이면 기기 시간 폴백)
async function syncServerTime() {
  if (!db) return;
  try {
    const ref = await withTimeout(addDoc(collection(db, 'timePings'), { t: serverTimestamp() }), FIRESTORE_TIMEOUT_MS);
    const snap = await withTimeout(getDoc(ref), FIRESTORE_TIMEOUT_MS);
    const t = snap.data()?.t;
    if (t?.toMillis) serverOffsetMs = t.toMillis() - Date.now();
  } catch {
    // 동기화 실패 시 기기 시간 사용
  }
}

// KST(UTC+9) 밤 11시를 하루 경계로 하는 날짜 키 (23시에 다음 날 단어로 전환)
// 서버 시간 동기화가 된 뒤에는 서버 기준으로 계산된다
export function todayKey(now = new Date()) {
  return new Date(now.getTime() + serverOffsetMs + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// todayKey와 같은 경계의 날짜 번호 — Firestore 규칙이 서버 시간과 대조해 미래 날짜 제출을 차단한다
function todayDayNum() {
  return Math.floor((Date.now() + serverOffsetMs + 10 * 60 * 60 * 1000) / 86400000);
}

// dateKey의 날짜 번호 — 어제 등 과거 날짜 랭킹 조회용
function dayNumForKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
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
export async function submitResult(dateKey, { userId, nickname, attempts, success, duration, streak }) {
  if (!db) return { ok: false, error: 'firebase-not-configured' };
  try {
    await withTimeout(addDoc(collection(db, 'rankings'), {
      date: CACHE_VERSION + '_' + dateKey,
      day: todayDayNum(),
      userId,
      nickname,
      attempts,
      success,
      duration,
      streak,
      submittedAt: serverTimestamp(),
    }), FIRESTORE_SUBMIT_TIMEOUT_MS);
    return { ok: true };
  } catch (error) {
    console.error('[dailyWord] ranking submit failed', error?.code, error?.message);
    return { ok: false, error: error?.code || error?.message || 'unknown-error' };
  }
}

// 당일 랭킹 조회 — 정답 제출 시각이 빠른 순
// 조회 키는 규칙으로 서버 오늘이 검증되는 day 필드를 사용한다
// day 필드가 없는 구형 문서는 date 문자열 일치로 함께 조회한다
// (day 없는 문서는 새 규칙으로 생성 불가라 위조 경로가 없다)
export async function fetchRankings(dateKey, userId) {
  const empty = { rankings: [], myRank: null };
  if (!db) return empty;
  try {
    const day = dayNumForKey(dateKey);
    const legacyDate = CACHE_VERSION + '_' + dateKey;
    const rankingsRef = collection(db, 'rankings');
    const [byDay, byDate] = await Promise.all([
      withTimeout(getDocs(query(rankingsRef, where('day', '==', day))), FIRESTORE_TIMEOUT_MS),
      withTimeout(getDocs(query(rankingsRef, where('date', '==', legacyDate))), FIRESTORE_TIMEOUT_MS),
    ]);
    const toMillis = (value) => {
      if (value?.toMillis) return value.toMillis();
      const parsed = Date.parse(value || '');
      return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    };
    const seen = new Set();
    const sorted = [...byDay.docs, ...byDate.docs]
      .filter((docSnap) => {
        if (seen.has(docSnap.id)) return false;
        seen.add(docSnap.id);
        const entry = docSnap.data();
        return entry.day === day || (!Number.isInteger(entry.day) && entry.date === legacyDate);
      })
      .map((docSnap) => docSnap.data())
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
  if (!timeSyncPromise) timeSyncPromise = syncServerTime();
  await timeSyncPromise;
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
