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

## 현재 상태
- 서버 출제 완료: `scripts/pickChallengeWord.js`가 `challengeWords/{date}`에 익일~3일치 문서를 미리 생성 (최근 100일 출제 이력 제외 — 풀 200 > 100 성립). 문서는 `date`+`wordId`+`createdAt`만 저장, 정답·힌트는 번들 `challengeWords.json`에서 조회
- `daily-word.yml`에 챌린지 출제 스텝 추가됨 — 일반 모드와 같은 시각(KST 23시)에 실행
- 클라이언트 연동 완료: `utils/dailyWord.js`의 공용 `fetchDailyEntry()`를 통해 `getChallengeWord()`가 `challengeWords/{date}` 조회 → 로컬 캐시(`challengeWord_v1_`) 폴백. 서버 `wordId`가 번들에 없으면 stale → "앱 업데이트가 필요합니다"
- `ChallengeWordScreen`: 서버 단어로 플레이, 시도 시 문제 불일치면 토스트 후 `reloadApp()` — 진행 내역 키 `challengeWordGame_` 유지
- `firestore.rules`에 `challengeWords` 읽기 규칙 추가
- 챌린지 배너: 일반 모드 완료 후 패널 아래에만 표시

## 남은 작업

### 1. 랭킹 (`challengeRankings`)
- `rankings`와 동일 스키마 (day, userId, nickname, submittedAt …)
- `firestore.rules`에 `challengeRankings` 추가 — 기존 `rankings` 규칙 미러 (읽기 + day 검증 create)
- `RankingScreen`을 컬렉션 파라미터로 재사용 — 정답 직후 등록→랭킹판 자동 표시 흐름 동일
- 정책 확인 필요: 닉네임 변경 제한, 연승 표시 여부

### 수동 작업
- Firebase 콘솔에 `firestore.rules` 재적용 (`challengeWords` 읽기 규칙 반영)
- GitHub Actions "오늘의 단어·챌린지 출제" 워크플로 수동 실행으로 챌린지 3일치 버퍼 채우기

### 작업 순서
1. ~~서버 출제 + 클라이언트 연동~~ (완료)
2. `firestore.rules`에 `challengeRankings` 추가 + `RankingScreen` 컬렉션 파라미터화 + 랭킹 등록
3. 검증 후 발행 (답 노출 없이 날짜만 확인)
