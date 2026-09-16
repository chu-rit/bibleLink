# 오늘의 단어 게임 구현 계획

## 개요
- Wordle 스타일 한글 단어 맞추기 게임
- 매일 하나의 단어가 전체 사용자에게 동일하게 출제 (하루 경계 = KST 23:00)
- 출제 단어 풀: `data/words2/dailyWords.json` (81개)
  - 기존 `data/words/`(Lib2~Lib15)에서 자모 완전 분해 기준 5~6개, 난이도 1~2, 인명/지명/도시명 등 명칭으로 쓰이는 단어만 추출하여 구성
- 순위 시스템 포함 예정 (시도 횟수, 소요 시간 기준) — 미구현

## 화면 구성 (구현됨)
- 페이지 플리퍼 마지막 장(인덱스 3)으로 편입: 로딩 → 맵 선택 → 퍼즐 → 오늘의 단어
- 로딩 화면 "오늘의 단어" 버튼 → `goToPage(3)` 진입
- 공통 헤더 `components/AppHeader.js` 사용 (‹ 뒤로가기, 로고, 설정 기어)
- 다른 페이지와 동일하게 상시 마운트 (배경 이미지 사전 디코딩으로 전환 깜빡임 방지)
- 여러 인스턴스가 모듈 레벨 공유 Promise로 같은 단어를 조회해 동일 내용 렌더링

## 게임 모드

### 일반 모드
- 출제 조건: 자음+모음 수 5~6개인 단어, 난이도 1~2에서 랜덤 선택
- 시도 횟수: 4회
- 힌트: 3개의 힌트를 단계별로 제공 (넓은 범주 → 구체적 식별 순서로 공개)
  - 1차 시도: 힌트 없음
  - 1차 실패 후: 힌트 1 (2차 시도 전)
  - 2차 실패 후: 힌트 2 (3차 시도 전)
  - 3차 실패 후: 힌트 3 (4차 마지막 시도 전)

### 힌트 작성 규칙
- **힌트 내용은 jw.org를 통해 검증된 내용만 사용한다.** 임의로 만든 표현·사실을 넣지 않는다.
  - 신세계역 용어만 사용 (형주, 침례, 회중 등). 일반 교회 용어 금지: 십자가(→형주), 세례(→침례), 교회(→회중) 등
  - 힌트 1의 등장 책은 `data/bible/nwt_*.txt` 본문에서 해당 이름의 실제 등장 여부로 검증한다
  - 힌트 2의 이름 뜻은 통찰책(wol.jw.org 「성경 통찰」) 기준으로 확인한다
  - 힌트 3의 사건은 신세계역 본문에서 확인 가능한 내용만 사용한다
- 힌트는 문자열만 저장 (성구 참조 없음)
- 힌트 1: 주로 등장하는 성경책 이름 (예: `창세기에 등장`)
  - 자기 이름을 딴 책에만 등장하는 예언자는 책 이름이 곧 정답이므로 `자기 이름을 딴 책에 등장`으로 표기 (이사야, 요엘, 스가랴, 스바냐, 아모스, 나훔, 오바댜, 학개)
- 힌트 2: 원문(히브리어·그리스어 등) 이름의 뜻 (예: `이름 뜻은 '발뒤꿈치를 잡는 자'`)
  - 통찰책 기준 뜻이 불확실하면 `뜻이 불확실한 이름` 또는 `~로 추정됨`으로 표기
- 힌트 3: 잘 알려진 사건을 토대로 하되, 결정적 디테일을 빼서 간접적으로 언급 — 들으면 바로 답이 떠오르는 수준이면 안 된다 (예: `형에게 죽임당한 양 치는 사람` → `양치는 사람`, `물매로 거인을 물리친 목동` → `목동이었던 왕`)

## 기술 스택
- Firebase JS SDK (`firebase` 패키지)
  - Expo Go / Web / iOS / Android 모두 호환
  - 네이티브 SDK(`@react-native-firebase`)는 Expo Go 미지원으로 제외
- Firestore: 출제 단어 저장, 랭킹 데이터 저장/조회
- Anonymous Auth: 사용자 식별 (닉네임 입력)
- GitHub Actions: 매일 출제 단어 자동 생성 및 Firestore 업데이트

## Firebase 설정 (수동 수행)

### 완료
- 프로젝트 생성: `biblelink-1e146`
- 웹 앱 등록: config 값이 `firebaseConfig.js`에 반영됨 (Analytics는 연결 안 함)

### 남은 작업

#### 1. Firestore 활성화
- Firestore Database → 만들기
- 리전: `asia-northeast3` (서울) 권장
- 규칙 탭에 `firestore.rules` 내용 적용

#### 2. 서비스 계정 → GitHub Secrets
- 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
- JSON 전체를 GitHub 리포 Secrets의 `FIREBASE_SERVICE_ACCOUNT`로 등록
- 서비스 계정 키는 코드/대화에 절대 노출 금지

#### 3. 첫 출제
- GitHub Actions에서 "오늘의 단어 출제" 워크플로 수동 실행, 또는
- 즉시 테스트: Firestore 콘솔에서 `dailyWords/{날짜키}` 문서에 `wordId` 필드 수동 생성

#### 4. 익명 인증 (랭킹 구현 시)
- Authentication → Sign-in method → 익명(Anonymous) → 사용 설정

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
  "hint1": "이름 뜻은 '사랑받는 자'", "hint2": "구약에 나오는 왕", "hint3": "물매로 거인을 물리친 목동" }
```

### rankings 컬렉션
```
rankings/{date}_{userId}
  - date: "2026-08-31"
  - userId: "anonymous-uuid"
  - nickname: "사용자 닉네임"
  - attempts: 4 (시도 횟수)
  - success: true
  - duration: 120 (소요 시간, 초)
  - submittedAt: timestamp
```

### users 컬렉션
```
users/{userId}
  - userId: "anonymous-uuid"
  - nickname: "사용자 닉네임"
  - createdAt: timestamp
```

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

    // 랭킹: 읽기는 모두, 쓰기는 인증된 사용자 본인만
    match /rankings/{docId} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow update, delete: if false; // 수정/삭제 불가
    }

    // 사용자: 본인만 읽기/쓰기
    match /users/{userId} {
      allow read, write: if request.auth != null
        && userId == request.auth.uid;
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
1. `data/words2/dailyWords.json`에서 후보 조회 — **난이도 1 풀 우선**, 소진 시 난이도 2 사용
2. 최근 50일 출제 이력과 중복되지 않는 단어 랜덤 선정 (후보 소진 시 에러 — 단어집 보충 필요)
3. `dailyWords/{date}` 문서 생성 (date, wordId, word, length, hints, createdAt)
4. 해당 날짜 문서가 이미 있으면 건너뜀
- 로컬 폴백(`utils/dailyWord.js`)도 동일하게 난이도 1 풀에서 날짜 시드 선정

## 앱 구현 현황

### 구현된 파일
- `firebaseConfig.js` — Firebase 초기화, Firestore `db` export, `isFirebaseConfigured`
- `utils/dailyWord.js` — `getTodayWord()`: 캐시 → Firestore → 날짜 시드 로컬 선정
- `screens/DailyWordScreen.js` — 게임 화면
- `components/AppHeader.js` — 공통 헤더 (맵 선택/오늘의 단어 공유)
- `scripts/pickDailyWord.js` — 출제 스크립트 (firebase-admin)
- `.github/workflows/daily-word.yml` — 일일 출제 워크플로
- `firestore.rules` — Firestore 보안 규칙

### 미구현
- `screens/RankingScreen.js` — 일일 랭킹 화면
- 익명 인증 + 닉네임, 결과 `rankings` 제출, 결과 공유(이모지 그리드)

### DailyWordScreen (구현된 기능)
1. `getTodayWord()`로 오늘 단어 조회 — 모듈 레벨 공유 Promise로 여러 인스턴스가 동일 단어 표시
2. 빈 타일 개수로 단어 길이 표시
3. 숨김 TextInput으로 입력 (타일 탭 시 포커스)
4. 자모 단위 색상 판정
   - 초록: 정확한 위치
   - 노랑: 포함되나 위치 다름
   - 회색: 없는 자모
5. 시도 횟수: 최대 4회
6. 힌트 단계별 공개 (실패 직후 힌트 1→2→3)
7. 실패 시 정답 공개

### 입력 규칙 (구현됨)
- 완성형 글자(`가-힣`)는 자모로 완전 분해해 타일 입력
- 낱자모 단독 입력은 원자 자모만 허용 (자음 14개 + 단모음 10개)
- 분해되는 자모(ㅔ, ㅘ, ㄲ 등)는 단독 입력 불가 — 타일에 표시되지 않고 제출 거부

### RankingScreen 기능
1. 오늘 랭킹 조회 (`rankings` where date == today)
2. 시도 횟수 오름차순, 소요 시간 오름차순 정렬
3. 상위 100명 표시
4. 본인 순위 강조
5. 어제 랭킹 조회 옵션

### 사용자 식별
- 앱 최초 실행 시 Anonymous Auth로 사용자 생성
- 닉네임 입력 프롬프트 (최초 1회)
- `AsyncStorage`에 userId, nickname 캐싱
- Web에서는 `localStorage` 사용

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
  3. 날짜 시드 결정적 선정 — 날짜 키 해시로 인덱스 결정, **Firebase 없이도 모든 유저가 동일 단어**
- Firebase 미설정/오프라인이어도 게임은 항상 동작

## 캐싱 전략 (구현됨)
- 출제 단어는 당일 캐싱 (`dailyWord_{dateKey}`에 wordId 저장, 단어 본문은 로컬 단어집에서 조회)
- 랭킹은 구현 시 새로고침마다 fetch (실시간성)

## Web/iOS/Android 호환성
- Firebase JS SDK는 세 플랫폼 모두 지원
- `fetch`/`asyncStorage`는 플랫폼별 분기 불필요
- Web에서 `localStorage` 대신 `AsyncStorage` 사용 (이미 프로젝트에서 사용 중)
- 키보드 입력: 기존 PuzzleScreen의 TextInput 패턴 참고

## 구현 현황
1. [x] `data/words2/` 데일리 워드 라이브러리 구성 (81개, 힌트 jw.org 검증 완료)
2. [x] Firebase 프로젝트 생성 + `firebase` 패키지 설치 + `firebaseConfig.js` 작성
3. [ ] Firestore 활성화 + `firestore.rules` 적용 (수동)
4. [ ] 서비스 계정 키 → GitHub Secrets `FIREBASE_SERVICE_ACCOUNT` (수동)
5. [x] GitHub Actions 일일 출제 워크플로 (`daily-word.yml` + `pickDailyWord.js`)
6. [x] `utils/dailyWord.js` 구현 (조회/캐시/폴백)
7. [x] `screens/DailyWordScreen.js` 구현
8. [x] `App.js` 페이지 플리퍼 마지막 장 편입 + `components/AppHeader.js`
9. [ ] `screens/RankingScreen.js` + 익명 인증 + 결과 제출 (향후)
10. [ ] Web/iOS/Android 호환성 검증 (Firestore 연동 후)

## 보안 고려사항
- Firebase config는 공개되어도 안전 (보안 규칙으로 보호)
- 단, Firestore 보안 규칙이 없으면 누구나 읽기/쓰기 가능
- 서비스 계정 키는 GitHub Secrets에만 저장, 코드에 하드코딩 금지
- 랭킹 조작 방지: 클라이언트에서 결과 제출만 가능, 수정/삭제 불가
- 동일 사용자의 같은 날 중복 제출 방지 (문서 ID를 `{date}_{userId}`로 고정)
