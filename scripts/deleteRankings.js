/**
 * 랭킹 기록 삭제 스크립트 (Firestore 규칙상 클라이언트 삭제 불가 → 서비스 계정 필요)
 *
 * 사용법: FIREBASE_SERVICE_ACCOUNT=<서비스계정JSON> node scripts/deleteRankings.js [날짜 YYYY-MM-DD] <닉네임1> [닉네임2 ...]
 * 날짜 생략 시 오늘(KST 23시 경계) 기준.
 * 예: node scripts/deleteRankings.js 128bit kyun
 */
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const dateArg = /^\d{4}-\d{2}-\d{2}$/.test(args[0] || '') ? args.shift() : null;
const nicknames = args;
if (!nicknames.length) {
  console.error('사용법: node scripts/deleteRankings.js [YYYY-MM-DD] <닉네임1> [닉네임2 ...]');
  process.exit(1);
}

const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) {
  console.error('FIREBASE_SERVICE_ACCOUNT 환경 변수가 없습니다');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
const db = admin.firestore();

// todayKey와 같은 KST 23시 경계 날짜 번호
const dateKey = dateArg || new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
const [y, m, d] = dateKey.split('-').map(Number);
const day = Date.UTC(y, m - 1, d) / 86400000;

async function main() {
  const snap = await db.collection('rankings').where('day', '==', day).get();
  const targets = snap.docs.filter((doc) => nicknames.includes(doc.data().nickname));
  if (!targets.length) {
    console.log(`${dateKey} (day=${day}) 랭킹에서 [${nicknames.join(', ')}] 기록을 찾지 못했습니다.`);
    console.log('당일 전체 기록:', snap.docs.map((doc) => doc.data().nickname).join(', ') || '없음');
    return;
  }
  for (const doc of targets) {
    const data = doc.data();
    await doc.ref.delete();
    console.log(`삭제: ${data.nickname} (attempts=${data.attempts}, submittedAt=${data.submittedAt?.toDate?.()})`);
  }
  console.log(`${targets.length}개 기록 삭제 완료`);
}

main().catch((e) => { console.error(e); process.exit(1); });
