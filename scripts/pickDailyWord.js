/**
 * 오늘의 단어 출제 스크립트 (GitHub Actions용)
 * - KST 23:00에 실행, Firestore dailyWords/{date} 문서 생성
 * - 최근 50일 출제 이력과 중복되지 않는 단어를 랜덤 선정
 *
 * 필요한 환경 변수:
 *   FIREBASE_SERVICE_ACCOUNT - 서비스 계정 JSON (전체 문자열)
 */
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const words = require('../data/words2/dailyWords.json');

const RECENT_DAYS = 50;

const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWELS = ['ㅏ', 'ㅏㅣ', 'ㅑ', 'ㅑㅣ', 'ㅓ', 'ㅓㅣ', 'ㅕ', 'ㅕㅣ', 'ㅗ', 'ㅗㅏ', 'ㅗㅏㅣ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅓㅣ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const FINALS = ['', 'ㄱ', 'ㄱㄱ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅅㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const INITIAL_EXPANSION = { 'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ' };

function jamoLength(word) {
  let n = 0;
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) continue;
    const initial = INITIALS[Math.floor(code / 588)];
    n += (INITIAL_EXPANSION[initial] || initial).length;
    n += VOWELS[Math.floor((code % 588) / 28)].length;
    n += FINALS[code % 28].length;
  }
  return n;
}

async function main() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT 환경 변수가 없습니다');

  admin.initializeApp({ credential: admin.cert(JSON.parse(sa)) });
  const db = getFirestore();

  // KST 기준 날짜 (밤 11시 롤오버: 23시에 익일 단어 출제)
  const date = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const docRef = db.collection('dailyWords').doc(date);

  const existing = await docRef.get();
  if (existing.exists) {
    console.log(`${date}: 이미 출제됨 (${existing.data().wordId})`);
    return;
  }

  // 최근 출제 이력으로 중복 회피
  const recent = await db.collection('dailyWords').orderBy('date', 'desc').limit(RECENT_DAYS).get();
  const used = new Set(recent.docs.map((d) => d.data().wordId));
  // 난이도 1~2 풀, 최근 50일 출제 단어 제외
  let pool = words.filter((w) => w.difficulty <= 2 && !used.has(w.id));
  if (!pool.length) throw new Error('출제 가능한 단어가 없습니다. 단어집을 추가하세요');
  const pick = pool[Math.floor(Math.random() * pool.length)];

  await docRef.set({
    date,
    wordId: pick.id,
    word: pick.name,
    length: jamoLength(pick.name),
    hints: [pick.hint1, pick.hint2, pick.hint3],
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`${date}: 출제 완료 (${pick.id} ${pick.name})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
