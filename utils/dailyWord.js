import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebaseConfig';
import localWords from '../data/words2/dailyWords.json';

const CACHE_PREFIX = 'dailyWord_';
const GAME_PREFIX = 'dailyWordGame_';
const FIRESTORE_TIMEOUT_MS = 3000;

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
// 출제는 난이도 1 풀에서만 선정
function seededIndex(dateKey) {
  const pool = localWords.filter((w) => w.difficulty === 1);
  let h = 0;
  for (const ch of dateKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

export function getLocalWord(dateKey = todayKey()) {
  return seededIndex(dateKey);
}

async function readCache(dateKey) {
  try {
    const wordId = await AsyncStorage.getItem(CACHE_PREFIX + dateKey);
    return wordId ? localWords.find((w) => w.id === wordId) || null : null;
  } catch {
    return null;
  }
}

async function writeCache(dateKey, wordId) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + dateKey, wordId);
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

// 익명 인증 uid 확보 (미설정/실패 시 null)
export async function ensureAuthUser() {
  try {
    if (!isFirebaseConfigured || !auth) return null;
    if (auth.currentUser) return auth.currentUser.uid;
    const cred = await withTimeout(signInAnonymously(auth), FIRESTORE_TIMEOUT_MS);
    return cred.user.uid;
  } catch {
    return null;
  }
}

// 게임 결과 제출. 문서 ID를 {date}_{userId}로 고정해 하루 1회 제출
export async function submitResult(dateKey, { userId, nickname, attempts, success, duration }) {
  if (!db || !userId) return false;
  try {
    await withTimeout(setDoc(doc(db, 'rankings', `${dateKey}_${userId}`), {
      date: dateKey,
      userId,
      nickname,
      attempts,
      success,
      duration,
      submittedAt: new Date().toISOString(),
    }), FIRESTORE_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

// 당일 랭킹 조회 — 성공 우선, 시도 적은 순, 소요 시간 짧은 순
export async function fetchRankings(dateKey) {
  if (!db) return [];
  try {
    const q = query(collection(db, 'rankings'), where('date', '==', dateKey));
    const snap = await withTimeout(getDocs(q), FIRESTORE_TIMEOUT_MS);
    return snap.docs
      .map((d) => d.data())
      .sort((a, b) => Number(b.success) - Number(a.success) || a.attempts - b.attempts || a.duration - b.duration)
      .slice(0, 100);
  } catch {
    return [];
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
