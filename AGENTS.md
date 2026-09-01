# Bible Link - AI 코딩 규칙

## 절대 규칙
- **`data/bibleWordsLib1.json`을 직접 편집하지 않는다.** 모든 단어 수정은 해당 초성의 Lib2~Lib15 원본 파일에서 수행한 뒤 `npm run merge:lib1`으로 갱신한다. Lib1을 직접 수정하면 다음 병합 시 사라진다.
- Web, iOS, Android 모두에서 동작하는지 먼저 검토한다.
- 추측하지 않는다. 확신이 없으면 관련 파일을 먼저 읽는다. 파일 확인은 `read`/`grep` 도구를 사용하며 Node 명령어로 읽지 않는다.
- 요청하지 않은 commit, push, 배포, 빌드, 개발 서버 시작은 하지 않는다.

## 프로젝트 개요
- Expo 기반 React Native 성경 단어 퍼즐 게임. JavaScript, npm.
- 진입점: `App.js`, 맵 선택: `screens/MapSelectScreen.js`
- 데이터: `data/words/`(단어), `data/maps/`(맵), `data/crosswordMaps.js`(맵 목록)
- 스크립트: `scripts/mergeLib1.js`, `scripts/generateMap.js`, `scripts/validateMaps.js`
- 배포: `.github/workflows/deploy-pages.yml` (GitHub Pages, base URL `/bibleLink`)

## 코드 수정 원칙
- 요청과 관련 없는 파일은 수정하지 않는다. 최소 변경으로 해결한다.
- 기존 로직·변수명·함수명·파일 구조·주석을 유지한다. 동작하는 코드를 임의로 개선하지 않는다.
- 새 파일·의존성은 반드시 필요한 경우에만 추가한다. 의존성 설치는 `npx expo install`을 우선한다.
- 들여쓰기 2공백, 함수형 컴포넌트+hooks, 정적 스타일은 `StyleSheet.create`, UI 텍스트는 기존 한국어 문체 유지.
- `Platform.OS` 분기, Web 미지원 Native Module은 필요시에만. Expo Go 호환 우선.

## 단어 데이터 규칙
- Lib1은 Lib2~Lib15 병합 파일. 직접 편집 금지. 수정은 원본 Lib 파일에서 후 `npm run merge:lib1` 실행.
- 초성별 매핑: Lib2(가) Lib3(나) Lib4(다) Lib5(라) Lib6(마) Lib7(바) Lib8(사) Lib9(아) Lib10(자) Lib11(차) Lib12(카) Lib13(타) Lib14(파) Lib15(하).
- `npm run validate:maps`와 `npm run generate:map`은 실행 전 자동으로 Lib1 병합 수행.
- WOL(jw.org) 통찰책에 등록된 단어만 추가. 순수 한글 2글자 이상, 중복(`id`/`word`) 불가, 한 글자 단어 불가.
- 한글 외 문자 제거 후 별개 단어가 합쳐지면 앞 단어 기준으로 등록.
- 정의는 정답을 직접 드러내지 않고 성경적 맥락 활용. `sourceUrl`은 저장하지 않는다.
- 단어 정의 수정 규칙:
  - 지문은 통찰책(wol.jw.org 「성경 통찰」) 기반으로 작성한다.
  - 일상용어에 가까운 단어는 해당 단어가 들어간 성구 본문을 사용하되, 정답 단어는 글자 수에 맞춰 `O`로 마스킹한다 (예: 2글자→`OO`, 3글자→`OOO`).
  - 가장 관련성 높은 성구로 참조를 교체한다.
  - 성구 본문은 `data/bible/nwt_*.txt` 파일에서 확인한다.
- 기존 `id`, `wordId`, 퍼즐 배치 관계를 임의로 변경하지 않는다.
- JSON 항목의 줄바꿈, 들여쓰기, 필드 순서, 배열 형식을 유지. 한 줄 축약 형식 금지.

## 퍼즐 데이터 규칙
- `wordId`는 Lib1의 `id`와 연결. 맵 생성·수정 후 `npm run validate:maps`로 검증.
- 새 맵은 `data/maps/crosswordMap<번호>.json`으로 추가하고 `data/crosswordMaps.js`에 등록. 재생성·수정 시 `id`를 새 값으로 교체.
- 단어는 미사용 단어 우선 선택, 불가피한 재사용은 전체 맵에서 최대 2회. 재사용 시 두 번째 맵에 `clue` 추가.
- 금지 구조: 교차 없는 홀로 단어, 2×2 정사각형, 관련 없는 단어의 상하좌우 맞닿음, 같은 방향 단어의 겹침·끝말잇기.
- EASY: 평균 1.0~1.8, difficulty 1.8 이하, 8×8, 10단어.
- NORMAL: 평균 1.9~2.5, 10×10, 15단어.
- HARD: 평균 2.6 이상, 12×12, 15단어.
- `clue`가 비어 있으면 `definition` 사용. `clue`==`definition`이면 중복 저장 안 함.
- 기존 배치 유지하며 문구만 수정할 때는 관련 `clue`만 변경.

## 단어 난이도
- 1: 일상어·성경 핵심 개념·인물. 2: 자주 등장하지만 생소한 인물·지명·개념. 3: 족보·obscure 지명·전문 용어.

## 검증
- JSON 변경 후 파싱 유효성 확인. 맵 변경 후 `npm run validate:maps` 실행.
- `npm run build:web`은 명시적 요청 시에만. 빌드 실패 시 원인 확인 후 최소 범위 수정.
- `git diff`/`git status`로 변경 범위 확인.

## 명령어
- 설치: `npm ci` | Web: `npm run web` | 빌드: `npm run build:web` | 검증: `npm run validate:maps` | 캐시 서버: `npx expo start -c`
