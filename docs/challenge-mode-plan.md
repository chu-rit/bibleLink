# 오늘의 단어 챌린지 모드 구현 계획

## 개요
- 일반 모드보다 어려운 데일리 단어 모드 — **길고 인지도 낮은 단어** 포함
- 출제 풀: `data/bibleWordsLib1.json`에서 **자모 7~10개** 단어 (998개, 난이도 제한 없음)
- 일반 모드와 마찬가지로 매일 하나, 전체 사용자 동일 출제 (KST 23시 경계)
- 랭킹은 별도 컬렉션 `challengeRankings`

## 사전 조사 결과 (Lib1 기준)
- 총 2264개, 난이도 1:466 / 2:674 / 3:1104 / 4:20
- 자모 수: 7자모 347, 8자모 337, 9자모 202, 10자모 112 → **7~10자모 998개**
- 7자모 이상 중 난이도 3~4는 591개
- Lib1 필드: `{id, word, definition, difficulty, references}` — hint1~3 없음

## 게임 규칙
- 시도 횟수: 4회 (일반 모드 동일)
- 채점: 자모 단위 초록/노랑/회색 (기존 로직 재사용)
- 힌트: `docs/daily-word-plan.md` 규칙대로 **별도 제작** (hint1 카테고리 / hint2 등장 책 / hint3 사건)
  - 일반 모드와 같은 단계별 공개 (1차 실패 후 힌트1 … 3차 실패 후 힌트3)

## 데이터
- `data/words2/challengeWords.json` (신규): `[{id, name, difficulty, hint1, hint2, hint3}]`
  - Lib1에서 7~10자모 추출 후 힌트 필드 작성 (일반 모드 `dailyWords.json`과 동일 스키마)
- `data/words2/validWords.json` 확장: `buildValidWords.js`가 길이 7~10 세트도 생성
  - 7자모 이상은 별도 txt 사전이 없으므로 **Lib1 단어로 세트 구성** — 즉 챌린지 모드는 "성경 단어만 입력 가능" (정답도 Lib1 출신이라 모순 없음)

## 서버/DB
- Firestore `challengeWords/{date}` 컬렉션 — `dailyWords`와 동일 스키마(wordId, word, length, hints, createdAt)
- `challengeRankings` 컬렉션 — `rankings`와 동일 스키마 + 동일 day 규칙
- 규칙: `challengeWords` 읽기 전용, `challengeRankings` 읽기 + 서버 day 검증 create — 기존 규칙 미러
- GitHub Actions: `daily-word.yml`에 challengeWords 출제 스텝 추가 (동일 23시, 같은 랜덤+50일 제외 로직)
- `pickDailyWord.js`를 컬렉션/단어집 인자로 범용화하거나 `pickChallengeWord.js` 분리

## 클라이언트
- `utils/dailyWord.js` 범용화: 컬렉션/캐시키/랭킹 컬렉션을 파라미터로 — 일반/챌린지 공용 로직
- 화면: `DailyWordScreen`을 모드 prop으로 재사용하거나 `ChallengeWordScreen` 분리 후 공통 컴포넌트 추출
- 10자모까지 한 줄 타일 표시 — 폰트/타일 크기 축소 대응 필요
- 서버 `wordId` 미해석 시 동일하게 "앱 업데이트가 필요합니다" (stale 경로 공유)

## 작업 순서
1. `challengeWords.json` 생성 스크립트 (Lib1 → 7~10자모 추출) + 힌트 작성
2. `buildValidWords.js` 7~10 세트 확장
3. `pickDailyWord` 범용화 + 워크플로 스텝 추가 + `challengeWords`/`challengeRankings` 규칙 추가
4. 화면·유틸 범용화 + 챌린지 진입 경로 (PageFlipper 페이지 추가 또는 모드 전환)
5. 검증 후 발행
