/**
 * 챌린지 단어 출제 스크립트 (GitHub Actions용)
 * - 매일 실행, Firestore challengeWords/{익일~3일 후} 문서를 미리 생성
 *   (GitHub cron 지연·실패가 있어도 며칠치 버퍼로 롤오버 공백을 방지)
 * - 최근 100일 출제 이력과 중복되지 않는 단어를 랜덤 선정
 * - 문서에는 wordId만 저장 — 정답·힌트는 앱 번들의 challengeWords.json에서 조회한다
 *
 * 필요한 환경 변수:
 *   FIREBASE_SERVICE_ACCOUNT - 서비스 계정 JSON (전체 문자열)
 */
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const words = require('../data/words2/challengeWords.json');

const RECENT_DAYS = 100;
// 서버 출제 전 테스트 기간에 화면에 하드코딩으로 출제된 단어
// 과거 날짜 이력으로 심어 최근 100일 제외 창에 포함시키고, 이후엔 자연스럽게 재출제되게 한다
const SEED_PICKS = [
  { date: '2026-09-26', wordId: 'gehazi' },
  { date: '2026-09-27', wordId: 'megiddo' },
];

async function main() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT 환경 변수가 없습니다');

  admin.initializeApp({ credential: admin.cert(JSON.parse(sa)) });
  const db = getFirestore();

  // 테스트 출제분을 과거 날짜 이력으로 한 번 심어둔다 (이미 있으면 건너뜀)
  for (const seed of SEED_PICKS) {
    const ref = db.collection('challengeWords').doc(seed.date);
    if (!(await ref.get()).exists) {
      await ref.set({ date: seed.date, wordId: seed.wordId, createdAt: FieldValue.serverTimestamp() });
      console.log(`${seed.date}: 테스트 출제분 이력 심기 (${seed.wordId})`);
    }
  }

  // 최근 출제 이력으로 중복 회피 (이번 실행에서 뽑은 것도 중복 금지)
  const recent = await db.collection('challengeWords').orderBy('date', 'desc').limit(RECENT_DAYS).get();
  const used = new Set(recent.docs.map((d) => d.data().wordId));
  // 인자로 wordId/name을 주면 첫 번째 대상 날짜에 그 단어를 강제 출제 (전환일에 기존 문제 유지용)
  // 두 번째 인자로 날짜(YYYY-MM-DD)를 주면 그 날짜 문서에 강제 출제한다
  const forced = process.argv[2];
  const forcedDate = process.argv[3];
  let forcedUsed = false;

  // 특정 날짜 강제 출제 — 최초 배포일처럼 버퍼 루프가 채우지 못하는 날짜를 수동으로 채울 때 사용
  if (forced && forcedDate) {
    const pick = words.find((w) => w.id === forced || w.name === forced);
    if (!pick) throw new Error(`단어를 찾을 수 없습니다: ${forced}`);
    const docRef = db.collection('challengeWords').doc(forcedDate);
    const existing = await docRef.get();
    if (existing.exists) {
      console.log(`${forcedDate}: 이미 출제됨 (${existing.data().wordId})`);
    } else {
      await docRef.set({ date: forcedDate, wordId: pick.id, createdAt: FieldValue.serverTimestamp() });
      used.add(pick.id);
      console.log(`${forcedDate}: 강제 출제 완료 (${pick.id} ${pick.name})`);
    }
    forcedUsed = true;
  }

  // KST 밤 11시 롤오버 기준(+10시간) 익일부터 3일치 문서를 미리 만든다
  for (let i = 1; i <= 3; i += 1) {
    const date = new Date(Date.now() + (10 + 24 * i) * 60 * 60 * 1000).toISOString().slice(0, 10);
    const docRef = db.collection('challengeWords').doc(date);

    const existing = await docRef.get();
    if (existing.exists) {
      console.log(`${date}: 이미 출제됨 (${existing.data().wordId})`);
      continue;
    }

    // 수동 선정된 챌린지 풀 전체에서 최근 100일 출제 단어를 제외하고 선정
    const pool = words.filter((w) => !used.has(w.id));
    if (!pool.length) throw new Error('출제 가능한 단어가 없습니다. 단어집을 추가하세요');
    const pick = (forced && !forcedUsed)
      ? words.find((w) => w.id === forced || w.name === forced)
      : pool[Math.floor(Math.random() * pool.length)];
    if (!pick) throw new Error(`단어를 찾을 수 없습니다: ${forced}`);
    forcedUsed = true;

    await docRef.set({
      date,
      wordId: pick.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    used.add(pick.id);
    console.log(`${date}: 출제 완료 (${pick.id} ${pick.name})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
