# 오늘의 단어 챌린지 모드 구현 계획

## 개요
- 일반 모드보다 어려운 데일리 단어 모드 — **길고 인지도 낮은 단어** 포함
- 출제 풀: `data/words2/challengeWords.json` — 수동 선정된 고유 명칭 **200개** (자모 7~10개)
- 일반 모드와 마찬가지로 매일 하나, 전체 사용자 동일 출제 (KST 23시 경계)
- 랭킹은 별도 컬렉션 `challengeRankings`

## 게임 규칙
- 시도 횟수: 4회 (일반 모드 동일)
- 채점: 자모 단위 초록/노랑/회색 (기존 로직 재사용)
- 힌트: hint1 카테고리 / hint2 등장 책 / hint3 짧은 수동 힌트(20자 이내) — 단계별 공개 동일
- 진행 내역은 `challengeWordGame_{날짜}` 키로 일반 모드와 분리 저장

## 데이터 (완료)
- `data/words2/challengeWords.json`: 200개 — 사람 104 / 장소 78 / 집단 12 / 기타 6
  - 성경 책 이름, 그리스도, 메시아 제외. `scripts/buildChallengeWords.js`의 `PICKS`/`HINT3`/`DROPS`로 재생성 가능
- `data/words2/validWords.json`: 5~10자모 세트 (외부 txt 사전 + Lib1 합본)
  - 5자모 5082 / 6자모 7636 / 7자모 4368 / 8자모 5437 / 9자모 5610 / 10자모 4486

## 구현 계획 완료
- 서버 출제 완료: `scripts/pickChallengeWord.js`가 `challengeWords/{date}`에 익일~3일치 문서를 미리 생성 (최근 100일 출제 이력 제외 — 풀 200 > 100 성립). 문서는 `date`+`wordId`+`createdAt`만 저장, 정답·힌트는 번들 `challengeWords.json`에서 조회
- `daily-word.yml`에 챌린지 출제 스텝 추가됨 — 일반 모드와 같은 시각(KST 23시)에 실행
- 클라이언트 연동 완료: `utils/dailyWord.js`의 공용 `fetchDailyEntry()`를 통해 `getChallengeWord()`가 `challengeWords/{date}` 조회 → 로컬 캐시(`challengeWord_v1_`) 폴백. 서버 `wordId`가 번들에 없으면 stale → "앱 업데이트가 필요합니다"
- `ChallengeWordScreen`: 서버 단어로 플레이, 시도 시 문제 불일치면 토스트 후 `reloadApp()` — 진행 내역 키 `challengeWordGame_` 유지
- `firestore.rules`에 `challengeWords` 읽기 규칙 + `challengeRankings` 규칙 추가
- 랭킹 완료: `submitChallengeResult`/`fetchChallengeRankings`가 `challengeRankings` 컬렉션 사용 (`submitResultTo`/`fetchRankingsFrom` 공용화). 정답 직후 등록→랭킹판 자동 표시, `RankingScreen`은 `eyebrow` 파라미터로 재사용
  - 테스트 출제분(gehazi/megiddo)은 과거 날짜 문서로 이력에 심어 100일 제외 후 자연 복귀
  - 연승 구현됨: 로컬 저장 키 `challengeWordStreak`로 일반 모드와 분리, 랭킹 등록 시 `challengeRankings` 서버 이력 기반 연승 계산·제출 (`fetchChallengeStreakBeforeToday`), 랭킹 행에 `연속 N일` 표시
- 챌린지 배너: 일반 모드 완료 후 패널 아래에만 표시
- 화면 마무리: 마스터모드 전용 초기화, 오늘의 단어와 공유하는 옵션·도움말, 허용 자모 수 제한과 한글 복합 자모 입력 처리 완료

## 발행·수동 확인

### 수동 작업
- Firebase 콘솔에 `firestore.rules` 재적용 (`challengeRankings` 규칙 반영)
- ~~GitHub Actions "오늘의 단어·챌린지 출제" 워크플로 수동 실행으로 챌린지 3일치 버퍼 채우기~~ (완료: 9/29~10/1 + 테스트분 9/26~27 이력)

### 확인 항목
- 답 노출 없이 날짜만 확인, Web/iOS/Android 동작 확인
- Firestore 콘솔에 `challengeRankings` 규칙이 게시됐는지 확인

### 선택 사항
- 닉네임 변경 제한 여부 (현재는 설정에서 제한 없이 변경 가능하며, 기존 랭킹 기록은 등록 당시 닉네임 유지)
