# 오늘의 단어 게임 구현 계획

## 개요
- Wordle 스타일 한글 단어 맞추기 게임
- 매일 하나의 단어가 전체 사용자에게 동일하게 출제
- 출제 단어 풀: 크로스워드 맵에 사용된 단어
- 순위 시스템 포함 (시도 횟수, 소요 시간 기준)
- 일반 모드와 챌린지 모드로 분리

## 게임 모드

### 일반 모드
- 출제 조건: 자음+모음 수 5~6개인 단어, 난이도 1~2에서 랜덤 선택
- 시도 횟수: 5회
- 정의 표시: 5차 시도 직전 (4회 실패 후)에 정답 단어의 정의 표시

### 챌린지 모드
- 출제 조건: 자음+모음 수 7~8개인 단어, 난이도 3에서 랜덤 선택
- 시도 횟수: 4회
- 정의 표시: 2차 시도 전 (1회 실패 후)에 정답 단어의 정의 표시

## 기술 스택
- Firebase JS SDK (`firebase` 패키지)
  - Expo Go / Web / iOS / Android 모두 호환
  - 네이티브 SDK(`@react-native-firebase`)는 Expo Go 미지원으로 제외
- Firestore: 출제 단어 저장, 랭킹 데이터 저장/조회
- Anonymous Auth: 사용자 식별 (닉네임 입력)
- GitHub Actions: 매일 출제 단어 자동 생성 및 Firestore 업데이트

## Firebase 설정 (수동 수행)

### 1. 프로젝트 생성
- https://console.firebase.google.com
- 프로젝트명: `biblelink`
- Google Analytics: 비활성화

### 2. 웹 앱 추가
- 프로젝트 설정 → 앱 추가 → 웹(`</>`)
- 앱 닉네임: `bibleLink`
- 호스팅: 체크 해제
- 생성 후 config 객체 복사
  ```js
  const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  };
  ```

### 3. Firestore 활성화
- Firestore Database → 만들기
- 테스트 모드로 시작 (이후 보안 규칙 적용)
- 리전: `asia-northeast3` (서울) 권장

### 4. 익명 인증 활성화
- Authentication → Sign-in method
- 익명(Anonymous) → 사용 설정

## 데이터 구조 (Firestore)

### dailyWords 컬렉션
```
dailyWords/{date}
  - date: "2026-08-31" (문서 ID)
  - normal:
    - wordId: "jesus"
    - word: "예수"
    - length: 2 (자음+모음 수)
    - definition: "하느님의 아들..."
  - challenge:
    - wordId: "sanhedrin"
    - word: "산헤드린"
    - length: 4 (자음+모음 수)
    - definition: "유대 최고 법정..."
  - createdAt: timestamp
```

### rankings 컬렉션
```
rankings/{date}_{mode}_{userId}
  - date: "2026-08-31"
  - mode: "normal" | "challenge"
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

## GitHub Actions 워크플로

### 파일: `.github/workflows/daily-word.yml`
- 매일 KST 자정(UTC 15:00)에 실행
- 크로스워드 맵에 사용된 단어 풀에서 랜덤 선정
- Firestore 서비스 계정 키로 인증
- `dailyWords/{date}` 문서 생성

### 시크릿 (GitHub Secrets)
- `FIREBASE_SERVICE_ACCOUNT`: 서비스 계정 JSON 키
- `FIREBASE_PROJECT_ID`: Firebase 프로젝트 ID

### 출제 로직
1. `data/maps/crosswordMap*.json`에서 사용된 wordId 수집
2. `data/words/bibleWordsLib1.json`에서 단어 정보 조회
3. 모드별 필터링:
   - 일반: 자음+모음 수 5~6개, difficulty 1~2
   - 챌린지: 자음+모음 수 7~8개, difficulty 3
4. 이전 출제 이력 조회 (최근 30일)하여 중복 회피
5. 각 모드별로 랜덤 선정 후 Firestore에 저장

## 앱 구현 계획

### 신규 파일
- `firebaseConfig.js` - Firebase 설정 (config 값은 환경 변수 또는 별도 관리)
- `screens/DailyWordScreen.js` - Wordle 게임 화면
- `screens/RankingScreen.js` - 일일 랭킹 화면
- `utils/dailyWord.js` - 출제 단어 fetch, 결과 제출 등 유틸

### 수정 파일
- `App.js` - `dailyWord`, `ranking` 라우팅 추가
- `screens/MapSelectScreen.js` - "오늘의 단어" 진입 카드 추가
- `package.json` - `firebase` 의존성 추가

### DailyWordScreen 기능
1. 모드 선택 (일반 / 챌린지)
2. Firestore에서 오늘 단어 조회 (`dailyWords/{date}` → 해당 모드 필드)
3. 빈 칸 개수로 단어 길이 표시
4. 사용자가 글자 입력 후 제출
5. 글자별 색상 힌트
   - 초록: 정확한 위치의 글자
   - 노랑: 단어에 포함되지만 위치가 다름
   - 회색: 단어에 없는 글자
6. 모드별 시도 횟수:
   - 일반: 최대 5회, 5차 시도 직전에 정의 표시
   - 챌린지: 최대 4회, 2차 시도 전에 정의 표시
7. 정답 시 결과를 Firestore `rankings`에 제출 (모드 포함)
8. 실패 시 정답 공개
9. 결과 공유 (이모지 그리드)

### RankingScreen 기능
1. 모드별 탭 (일반 / 챌린지)
2. 오늘 랭킹 조회 (`rankings` where date == today, mode == 선택 모드)
3. 시도 횟수 오름차순, 소요 시간 오름차순 정렬
4. 상위 100명 표시
5. 본인 순위 강조
6. 어제 랭킹 조회 옵션

### 사용자 식별
- 앱 최초 실행 시 Anonymous Auth로 사용자 생성
- 닉네임 입력 프롬프트 (최초 1회)
- `AsyncStorage`에 userId, nickname 캐싱
- Web에서는 `localStorage` 사용

## 매칭 단위
- 한글 한 글자 단위로 매칭
- 예: 정답 "예수" (2글자)
  - 입력 "모세" → 회색 회색
  - 입력 "예언" → 초록 회색
  - 입력 "수예" → 노랑 노랑

## 단어 길이 기준
- 자음+모음 수를 길이로 사용 (받침은 자음으로 계산하지 않음)
- 예:
  - "예수" → ㅇ+ㅖ+ㅅ+ㅜ = 4 (자음 2 + 모음 2)
  - "산헤드린" → ㅅ+ㅏ+ㄴ+ㅎ+ㅔ+ㄷ+ㄹ+ㅣ+ㄴ = 9 (자음 5 + 모음 4)
  - "하느님" → ㅎ+ㅏ+ㄴ+ㅡ+ㄴ+ㅅ+ㅣ+ㅁ = 8 (자음 5 + 모음 3)
- 일반 모드: 자음+모음 수 5~6개
- 챌린지 모드: 자음+모음 수 7~8개

## 시도 횟수 및 정의 표시
| 모드 | 시도 횟수 | 정의 표시 시점 |
|---|---|---|
| 일반 | 5회 | 5차 시도 직전 (4회 실패 후) |
| 챌린지 | 4회 | 2차 시도 전 (1회 실패 후) |

## 오프라인 / 실패 폴백
- Firestore fetch 실패 시:
  1. 로컬 캐시(`AsyncStorage`)에서 최근 단어 조회
  2. 캐시도 없으면 날짜 기반 시드로 로컬 단어 선정
  3. 단, 다른 사용자와 일관성 보장 불가 (안내 표시)

## 캐싱 전략
- 출제 단어는 당일 캐싱 (`AsyncStorage` key: `dailyWord_{date}`)
- 사용자 결과 제출 후 로컬에도 저장
- 랭킹은 새로고침 시마다 fetch (실시간성)

## Web/iOS/Android 호환성
- Firebase JS SDK는 세 플랫폼 모두 지원
- `fetch`/`asyncStorage`는 플랫폼별 분기 불필요
- Web에서 `localStorage` 대신 `AsyncStorage` 사용 (이미 프로젝트에서 사용 중)
- 키보드 입력: 기존 PuzzleScreen의 TextInput 패턴 참고

## 구현 순서
1. Firebase 프로젝트 설정 (수동)
2. `firebase` 패키지 설치 및 `firebaseConfig.js` 작성
3. Firestore 보안 규칙 적용
4. GitHub Actions 일일 출제 워크플로 작성
5. `utils/dailyWord.js` 구현 (fetch, 제출)
6. `screens/DailyWordScreen.js` 구현
7. `screens/RankingScreen.js` 구현
8. `App.js` 라우팅 연결
9. `screens/MapSelectScreen.js` 진입점 추가
10. Web/iOS/Android 호환성 검증

## 보안 고려사항
- Firebase config는 공개되어도 안전 (보안 규칙으로 보호)
- 단, Firestore 보안 규칙이 없으면 누구나 읽기/쓰기 가능
- 서비스 계정 키는 GitHub Secrets에만 저장, 코드에 하드코딩 금지
- 랭킹 조작 방지: 클라이언트에서 결과 제출만 가능, 수정/삭제 불가
- 동일 사용자의 같은 날 중복 제출 방지 (문서 ID를 `{date}_{mode}_{userId}`로 고정)
