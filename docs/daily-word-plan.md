# 오늘의 단어 게임 구현 계획

## 개요
- Wordle 스타일 한글 단어 맞추기 게임
- 매일 하나의 단어가 전체 사용자에게 동일하게 출제 (하루 경계 = KST 23:00)
- 출제 단어 풀: `data/words2/dailyWords.json` (81개)
  - 기존 `data/words/`(Lib2~Lib15)에서 자모 완전 분해 기준 5~6개, 난이도 1~2, 인명/지명/도시명 등 명칭으로 쓰이는 단어만 추출하여 구성
- 순위 시스템 포함 (정답 제출 시각 선착순) — 구현됨, Firestore 연동 완료

## 화면 구성 (구현됨)
- 페이지 플리퍼 마지막 장(인덱스 3)으로 편입: 로딩 → 맵 선택 → 퍼즐 → 오늘의 단어
- 로딩 화면 "오늘의 단어" 버튼 → `goToPage(3)` 진입
- 공통 헤더 `components/AppHeader.js` 사용 (‹ 뒤로가기, 로고, 설정 기어)
- 다른 페이지와 동일하게 상시 마운트 (배경 이미지 사전 디코딩으로 전환 깜빡임 방지)
- 여러 인스턴스가 모듈 레벨 공유 Promise로 같은 단어를 조회해 동일 내용 렌더링

## 게임 모드

### 일반 모드
- 출제 조건: 자음+모음 수 5~6개인 단어, 난이도 1~2 풀에서 날짜 시드 랜덤 선정 (최근 50일 이력 제외)
- 시도 횟수: 4회
- 힌트: 3개의 힌트를 단계별로 제공 (넓은 범주 → 구체적 식별 순서로 공개)
  - 1차 시도: 힌트 없음
  - 1차 실패 후: 힌트 1 (2차 시도 전)
  - 2차 실패 후: 힌트 2 (3차 시도 전)
  - 3차 실패 후: 힌트 3 (4차 마지막 시도 전)

### 힌트 작성 규칙
- **힌트 내용은 jw.org를 통해 검증된 내용만 사용한다.** 임의로 만든 표현·사실을 넣지 않는다.
  - 신세계역 용어만 사용 (형주, 침례, 회중 등). 일반 교회 용어 금지: 십자가(→형주), 세례(→침례), 교회(→회중) 등
  - 힌트 2의 등장 책은 `data/bible/nwt_*.txt` 본문에서 해당 이름의 실제 등장 여부로 검증한다
  - 힌트 3의 사건은 신세계역 본문에서 확인 가능한 내용만 사용한다
- 힌트는 문자열만 저장 (성구 참조 없음)
- 힌트 1: 단어의 카테고리만 표기 — `사람 이름`(52) `장소 이름`(26: 도시·지방·산·강·바다·섬) `기타`(3: 파라오·바알·사탄)
  - 2026-09 변경: 기존에는 힌트 1이 등장 책, 힌트 2가 이름 뜻이었으나, 이름 뜻 중 상당수가 통찰책 현행판에서 어원 미제공(구판 Aid에만 존재)이라 카테고리+등장책 구조로 개편하고 이름 뜻 힌트는 폐기
- 힌트 2: 주로 등장하는 성경책 이름 (예: `창세기에 등장`)
  - 자기 이름을 딴 책에만 등장하는 예언자는 책 이름이 곧 정답이므로 `자기 이름을 딴 책에 등장`으로 표기 (이사야, 요엘, 스가랴, 스바냐, 아모스, 나훔, 오바댜, 학개)
- 힌트 3: 잘 알려진 사건을 토대로 하되, 결정적 디테일을 빼서 간접적으로 언급 — 들으면 바로 답이 떠오르는 수준이면 안 된다 (예: `형에게 죽임당한 양 치는 사람` → `양치는 사람`, `물매로 거인을 물리친 목동` → `목동이었던 왕`)

## 기술 스택
- Firebase JS SDK (`firebase` 패키지)
  - Expo Go / Web / iOS / Android 모두 호환
  - 네이티브 SDK(`@react-native-firebase`)는 Expo Go 미지원으로 제외
- Firestore: 출제 단어 저장, 랭킹 데이터 저장/조회
- 不使用匿名认证 — 本地生成设备级 `userId` 存 AsyncStorage，用于识别本人排名
- GitHub Actions: 매일 출제 단어 자동 생성 및 Firestore 업데이트

## Firebase 설정 (수동 수행)

### 已完成
- 프로젝트 생성: `biblelink-1e146`
- 웹 앱 등록: config 값이 `firebaseConfig.js`에 반영됨 (Analytics는 연결 안 함)
- Cloud Firestore API 사용 설정 + Firestore Database 생성 완료
- `firestore.rules` 규칙 콘솔에 적용 완료 (rankings 공개 생성 허용)

### 남은 작업

#### 1. 서비스 계정 → GitHub Secrets
- 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
- JSON 전체를 GitHub 리포 Secrets의 `FIREBASE_SERVICE_ACCOUNT`로 등록
- 서비스 계정 키는 코드/대화에 절대 노출 금지

#### 2. 첫 출제
- GitHub Actions에서 "오늘의 단어 출제" 워크플로 수동 실행, 또는
- 즉시 테스트: Firestore 콘솔에서 `dailyWords/{날짜키}` 문서에 `wordId` 필드 수동 생성

> 익명 인증은 사용하지 않음 — fruitBox와 동일하게 로컬 userId로 본인을 식별한다.

## 데이터 구조 (Firestore)

### dailyWords 컬렉션
```
dailyWords/{date}
  - date: "2026-08-31" (문서 ID)
  - wordId: "david"
  - word: "다윗"
  - length: 6 (쪼갠 자모 수, 런타임에 계산 가능)
  - hints: ["힌트1 문자열", "힌트2 문자열", "힌트3 문자열"]
  - createdAt: timestamp
```

로컬 라이브러리 `data/words2/dailyWords.json`의 항목 형식:
```json
{ "id": "david", "name": "다윗", "difficulty": 1,
  "hint1": "사람 이름", "hint2": "사무엘상에 등장", "hint3": "목동이었던 왕" }
```

### rankings 컬렉션
```
rankings/{자동ID} (addDoc으로 생성, 문서 ID 자동)
  - date: "v4_2026-08-31" (CACHE_VERSION_날짜키 — 버전 올리면 구 기록은 자연스럽게 안 보임)
  - userId: "로컬 생성 기기 ID" (익명 인증 아님, AsyncStorage 저장)
  - nickname: "사용자 닉네임" (미설정 시 NONAME)
  - attempts: 4 (시도 횟수)
  - success: true
  - duration: 120 (소요 시간, 초 — 저장만 하고 순위 기준·표시에는 사용 안 함)
  - submittedAt: timestamp
```

### users 컬렉션
- Firestore users 컬렉션은 사용하지 않음. userId·닉네임은 `AsyncStorage`(`dailyWordUser`)에만 로컬 저장

## Firestore 보안 규칙

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 출제 단어: 읽기만 가능
    match /dailyWords/{date} {
      allow read: if true;
      allow write: if false; // GitHub Actions 서비스 계정만
    }

    // 랭킹: 읽기와 신규 등록은 모두 허용 (익명 인증 미사용, fruitBox와 동일 방식)
    match /rankings/{docId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false; // 수정/삭제 불가
    }
  }
}
```

## 날짜 경계 (하루 = KST 23:00 ~ 익일 23:00)
- 날짜 키: `new Date(now + 10시간)`의 UTC 날짜 — KST 23:00에 익일 키로 전환
- 클라이언트(`utils/dailyWord.js` `todayKey()`)와 출제 스크립트(`scripts/pickDailyWord.js`)가 동일 계산 사용
- 출제: KST 23:00에 익일 단어 문서 생성 → 앱은 같은 시각부터 새 단어 조회

## GitHub Actions 워크플로 (구현됨)

### 파일: `.github/workflows/daily-word.yml`
- 매일 KST 23:00(UTC 14:00)에 실행 — 익일 단어 출제
- 수동 실행(`workflow_dispatch`) 지원

### 시크릿 (GitHub Secrets)
- `FIREBASE_SERVICE_ACCOUNT`: 서비스 계정 JSON 키

### 출제 로직 (`scripts/pickDailyWord.js`)
1. `data/words2/dailyWords.json`에서 후보 조회 — **난이도 1~2 풀**
2. `dailyWords/{date}` 문서 생성 (date, wordId, word, length, hints, createdAt)
3. 해당 날짜 문서가 이미 있으면 건너뜀

### 로컬 폴백 선정 (`utils/dailyWord.js` `seededIndex`, 구현됨)
- 난이도 1~2 풀(81개)에서 **날짜 시드 난수(mulberry32)**로 랜덤 선정 — 모든 기기가 동일 결과
- **사용 이력 슬라이딩 윈도우**: 기준일(`PICKS_EPOCH='2026-09-19'`)부터 매일 시뮬레이션해 직전 50일(`RECENT_EXCLUDE_DAYS`) 출제 단어를 후보에서 제외 — 같은 단어는 50일 안에 재출제되지 않음
  - 제외 기간을 풀 크기에 가깝게 잡으면 후보가 1개만 남아 랜덤이 안 되므로 50일로 설정 (후보 ≥31개 유지)
- `SEED_RECENT_PICKS`: 과거 구 알고리즘으로 실제 출제된 단어(아벨/야곱/요셉)를 사용 이력 초기값으로 삽입해 재출제 방지, 50일 후 자동 복귀
- **주의**: 단어 추가/삭제로 풀이 바뀌면 시뮬레이션 이력이 바뀌어 직전 출제 단어가 재출제될 수 있음 → `npm run add:daily-word` 스크립트가 단어 추가와 `CACHE_VERSION` 자동 인상을 함께 처리

## 앱 구현 현황

### 구현된 파일
- `firebaseConfig.js` — Firebase 초기화, Firestore `db` export, `isFirebaseConfigured`
- `utils/dailyWord.js` — `getTodayWord()`: 캐시 → Firestore → 날짜 시드 로컬 선정
- `screens/DailyWordScreen.js` — 게임 화면
- `components/AppHeader.js` — 공통 헤더 (맵 선택/오늘의 단어 공유)
- `scripts/pickDailyWord.js` — 출제 스크립트 (firebase-admin)
- `.github/workflows/daily-word.yml` — 일일 출제 워크플로
- `firestore.rules` — Firestore 보안 규칙

### 랭킹 (구현됨)
- 정답 확정 즉시 `addDoc`로 `rankings` 컬렉션에 자동 등록 (성공한 경우만)
- 닉네임은 설정 화면에서 미리 등록, 미설정 시 `NONAME`
- 정렬 기준: `submittedAt` 오름차순 = **정답을 먼저 맞힌 선착순**. `duration`은 저장만 하고 표시·정렬에 사용 안 함
- 등록 성공 후 랭킹판 자동 표시; 종료 후 "랭킹" 버튼으로 재조회 가능
- 표시: 상위 10등까지. 본인이 10등 안이면 해당 행에 `나` 표시만, 10등 밖이면 목록 아래 `내 순위` 한 줄로 실제 순위 표시
- 본인 식별: 로컬 생성 `userId` (`getOrCreateUser()` — `dailyWordUser` AsyncStorage 키, 익명 인증 아님)
- `fetchRankings(dateKey, userId)` 반환: `{rankings: 상위10+isMine, myRank: {rank, ...}|null}`
- Firestore 타임아웃: 등록 15초, 조회 4초 — 등록 실패 시 오류 코드를 화면에 표시, 로컬 대체 표시 없음 (실제 등록된 기록만 표시)
- 랭킹 date 필드: `{CACHE_VERSION}_{dateKey}` — 버전 인상 시 구 기록 자연 은폐
- 공유 기능은 제거된 상태 유지

### 미구현
- 어제 랭킹 조회, 카카오 SDK 직접 연동(카카오 개발자 앱 키 필요)

### DailyWordScreen (구현된 기능)
1. `getTodayWord()`로 오늘 단어 조회 — 모듈 레벨 공유 Promise로 여러 인스턴스가 동일 단어 표시
2. 빈 타일 개수로 단어 길이 표시
3. 숨김 TextInput으로 입력 (타일 탭 시 포커스)
4. 자모 단위 색상 판정
   - 초록: 정확한 위치
   - 노랑: 포함되나 위치 다름
   - 회색: 없는 자모
5. 시도 횟수: 최대 4회 — `N/4회 시도` 큰 숫자로 표시
6. 힌트 단계별 공개 (실패 직후 힌트 1→2→3)
7. 실패 시 정답 공개
8. 지난 시도 줄 + 입력 중인 줄만 표시 (빈 줄 미표시), 게임 종료 후에도 지난 시도는 유지
9. 버튼: 진행 중 "입력"만 표시, 종료 후 "랭킹" (새 게임·포기하기·공유하기 버튼 없음)
10. 마스터 모드(`masterMode` prop, App.js 기존 로직 공유): "입력" 왼쪽에 "초기화" 버튼 — 당일 저장 내역 삭제 후 같은 단어로 재시작. 랭킹 재제출은 규칙상 차단됨

### 게임 진행 내역 저장 (구현됨)
- 시도할 때마다 `AsyncStorage` `dailyWordGame_{날짜키}`에 `{wordId, guesses, over, won, message, startedAt}` 저장
- 같은 날짜·같은 단어면 복원, 날짜/단어 변경 시 자동 새 게임

### 입력 규칙 (구현됨)
- 완성형 글자(`가-힣`)는 자모로 완전 분해해 타일 입력
- 낱자모 단독 입력은 원자 자모만 허용 (자음 14개 + 단모음 10개)
- 분해되는 자모(ㅔ, ㅘ, ㄲ 등)는 단독 입력 불가 — 타일에 표시되지 않고 제출 거부

### RankingScreen 기능 (`screens/RankingScreen.js`, 분리됨)
1. 오늘 랭킹 조회 결과 표시 (`fetchRankings`가 `submittedAt` 오름차순 정렬 후 전달)
2. 상위 10등만 목록 표시 — 1~3등 금/은/동 배지, 1등 `FIRST` 표시
3. 본인 행 `나` 표시 + 녹색 강조 (`isMine`)
4. 본인이 10등 밖이면 목록 아래 `내 순위` 구역에 실제 순위로 한 줄 표시
5. 표시 항목: 순위·닉네임·시도 횟수 (소요 시간은 표시 안 함 — 선착순 기준과 혼동 방지)
6. 카드형 모달: `DAILY WORD` 라벨 + `오늘의 랭킹` 제목 + 우상단 × + 하단 닫기 버튼

### 사용자 식별 (익명 인증 미사용 — fruitBox와 동일 방식)
- `getOrCreateUser()`: `AsyncStorage` `dailyWordUser`에 `{userId, nickname}` 저장
  - `userId`: 로컬 생성 기기 식별자 (`{timestamp36}_{random36}`), 랭킹의 본인 식별에 사용
  - `nickname`: 기본값 `NONAME`, 설정 화면에서 변경
- 진입 시 닉네임 미설정(`NONAME`)이면 닉네임 설정 모달 자동 표시로 유도
  - `isActive` prop으로 실제 화면 활성화 시에만 검사 (PageFlipper가 전 페이지를 미리 마운트하므로)
  - 모듈 레벨 `nicknamePromptShown` 플래그로 다중 인스턴스 중복 표시 방지, 600ms 지연 표시
  - 저장 없이 닫으면 다음 진입 시 다시 유도

### 설정 화면 (분리됨)
- `SettingsScreen.js`: 공통 모달 틀 — 우상단 사각 `×` 버튼, 바깥 탭 닫기, 하단 닫기 버튼 없음
- `MapSettingsScreen.js`: 가로세로 퍼즐 전용 (진행 초기화 포함)
- `DailyWordSettingsScreen.js`: 오늘의 단어 전용 — 닉네임만 (초기화 없음)
  - 닉네임 기본값 `NONAME`. 포커스 시 `NONAME`이 즉시 지워지고 빈 상태로 blur하면 `NONAME` 복원
  - 저장 시 `getOrCreateUser()`로 기존 `userId`를 유지한 채 닉네임만 갱신

## 매칭 단위
- 낱자모(자음/모음 하나) 단위로 매칭. 글자는 자모로 완전 분해해 비교
- 예: 정답 "다윗" → ㄷㅏㅇㅜㅣㅅ (6타일)
  - 입력 "요한" → ㅇㅛㅎㅏㄴ 분해 후 타일별 초록/노랑/회색 판정

## 단어 길이 기준
- 자음+모음을 키 입력 단위로 완전 분해한 개수를 길이로 사용
  - 합성 모음·겹자모는 쪼갬: ㅔ→ㅓㅣ, ㅟ→ㅜㅣ, ㄲ→ㄱㄱ, ㄺ→ㄹㄱ
- 예:
  - "다윗" → ㄷㅏㅇㅜㅣㅅ = 6
  - "마리아" → ㅁㅏㄹㅣㅇㅏ = 6
  - "베다니" → ㅂㅓㅣㄷㅏㄴㅣ = 7 (기준 초과로 단어집에서 제외)
- 출제 조건: 쪼갠 자모 수 5~6개 (단어집 데이터가 보장)
- 입력 규칙: 낱자모 단독 입력은 타일에 존재하는 원자 자모만 허용 (ㄱ, ㅏ 등). 분해되는 자모(ㅔ, ㅘ, ㄲ 등)는 단독 입력 불가 — 완성형 글자나 단모음으로만 입력 가능

## 시도 횟수 및 힌트 공개
| 시도 횟수 | 힌트 공개 시점 |
|---|---|
| 4회 | 1차 힌트 없음, 1차 실패 후 힌트 1, 2차 실패 후 힌트 2, 3차 실패 후 힌트 3과 함께 4차 마지막 시도 |

## 오프라인 / 실패 폴백 (구현됨)
- `getTodayWord()` 우선순위:
  1. 로컬 캐시(`AsyncStorage` key: `dailyWord_{dateKey}`) — 당일 조회 이력이 있으면 즉시 사용
  2. Firestore `dailyWords/{dateKey}` — `wordId`로 로컬 단어집에서 항목 조회 후 캐싱
  3. 날짜 시드 결정적 선정 — 날짜 시드 난수 + 최근 50일 이력 제외, **Firebase 없이도 모든 유저가 동일 단어**
- Firebase 미설정/오프라인이어도 게임은 항상 동작

## 캐싱 전략 (구현됨)
- 출제 단어는 당일 캐싱 (`dailyWord_{CACHE_VERSION}_{dateKey}`에 wordId 저장, 단어 본문은 로컬 단어집에서 조회)
- `CACHE_VERSION`(현재 `v4`): 선정 알고리즘·단어 풀 변경 시 올리면 구 캐시가 무시되어 전원 새 단어로 전환. 랭킹 `date` 필드도 `{CACHE_VERSION}_{dateKey}`라 랭킹도 함께 리셋됨
- 랭킹은 새로고침마다 fetch (실시간성)

## Web/iOS/Android 호환성
- Firebase JS SDK는 세 플랫폼 모두 지원
- `fetch`/`asyncStorage`는 플랫폼별 분기 불필요
- Web에서 `localStorage` 대신 `AsyncStorage` 사용 (이미 프로젝트에서 사용 중)
- 키보드 입력: 기존 PuzzleScreen의 TextInput 패턴 참고

## 구현 현황

### 앱 코드 — 전부 완료
1. [x] `data/words2/` 데일리 워드 라이브러리 구성 (81개, 힌트 jw.org 검증 완료)
2. [x] Firebase 프로젝트 생성 + `firebase` 패키지 설치 + `firebaseConfig.js` 작성
3. [x] GitHub Actions 일일 출제 워크플로 (`daily-word.yml` + `pickDailyWord.js`)
4. [x] `utils/dailyWord.js` 구현 (조회/캐시/폴백/진행 내역 저장/랭킹, 등록 타임아웃 15초·조회 4초)
5. [x] `screens/DailyWordScreen.js` 구현 (게임+랭킹 자동 표시+마스터 초기화+닉네임 유도)
6. [x] `App.js` 페이지 플리퍼 마지막 장 편입 + `components/AppHeader.js` (`isActive` 전달)
7. [x] 설정 화면 분리: `SettingsScreen`(공통 모달 틀) / `MapSettingsScreen`(맵 설정+초기화) / `DailyWordSettingsScreen`(닉네임)
8. [x] `screens/RankingScreen.js` 분리 (카드형 랭킹 모달, 상위 10 + 내 순위)
9. [x] `scripts/addDailyWord.js` — 단어 추가 + `CACHE_VERSION` 자동 인상 (`npm run add:daily-word`)

### Firebase 콘솔 수동 작업
1. [x] Cloud Firestore API 사용 설정 + Firestore Database 생성 완료
2. [x] 규칙 탭에 `firestore.rules` 적용 완료 (rankings 공개 create 허용)
3. [ ] 서비스 계정 키 → GitHub Secrets `FIREBASE_SERVICE_ACCOUNT` (자동 출제에 필수)
4. [ ] 첫 출제 테스트 — Actions 워크플로 수동 실행 또는 `dailyWords/{날짜키}` 문서 수동 생성

> 익명 인증은 사용하지 않으므로 Authentication 설정 불필요. 랭킹은 Firestore에 실제 등록된 기록만 표시한다.

### 검증
- [ ] Web/iOS/Android 호환성 검증 (Firestore 연동 후)

## 보안 고려사항
- Firebase config는 공개되어도 안전 (보안 규칙으로 보호)
- 단, Firestore 보안 규칙이 없으면 누구나 읽기/쓰기 가능
- 서비스 계정 키는 GitHub Secrets에만 저장, 코드에 하드코딩 금지
- 랭킹 조작 방지: 클라이언트에서 결과 제출만 가능, 수정/삭제 불가
- 익명 인증이 없으므로 동일 사용자 중복 제출은 규칙으로 막지 못함 — 로컬 `userId`로 본인 식별만 수행 (fruitBox와 동일한 트레이드오프)
