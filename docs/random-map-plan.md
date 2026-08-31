# 랜덤 맵 게임 구현 계획

## 개요
- 매번 새로운 크로스워드 맵을 실시간으로 생성하여 플레이
- 기존 고정 맵(E-1, N-1, H-1 등)과 별도 모드
- 백엔드 불필요, 프론트엔드에서 순수 JS 알고리즘으로 생성
- `scripts/generateMap.js`의 핵심 로직을 앱 내부로 이식

## 기술 방식
- `scripts/generateMap.js`의 배치 알고리즘(교차, 2×2 금지, 난이도 필터링)을 프론트엔드에서 동일하게 구현
- 단어 데이터(`bibleWordsLib1.json`)는 이미 앱에서 import 가능
- 파일 저장 없이 메모리에서 맵 객체 생성 후 바로 플레이
- 필요 시 `AsyncStorage`에 생성된 맵 JSON을 저장해 재사용

## 난이도 모드
| 모드 | 크기 | 단어 수 | 난이도 범위 |
|---|---|---|---|
| EASY | 8×8 | 10 | 1.0~1.8 |
| NORMAL | 10×10 | 15 | 1.9~2.5 |
| HARD | 12×12 | 15 | 2.6~ |

## 생성 알고리즘 (기존 generateMap.js 기반)

### 단어 풀 구성
1. `bibleWordsLib1.json`에서 단어 로드
2. 길이 2~size 필터링
3. 목표 난이도 ±1 범위 필터링
4. (옵션) 기존 맵 사용 이력에서 재사용 2회 초과 단어 제외

### 배치 로직
1. 시드 기반 결정론적 난수 생성기 (LCG)
2. 첫 단어를 무작위 위치에 배치
3. 이후 단어는 기존 단어와 교차하는 위치 탐색
4. 교차 글자가 일치하고 보드 내에 들어오는지 검증
5. 제약 조건 검사:
   - 한 칸에 3개 이상 단어 겹침 금지
   - 같은 방향 중복 겹침 금지
   - 2×2 정사각형 금지
   - 인접 글자가 교차 없이 맞닿음 금지
   - 모든 단어가 최소 1회 교차
6. 목표 단어 수 도달 시 종료
7. 평균 난이도가 목표 범위 내인지 확인

### 시드 선택
- 사용자가 "랜덤 맵" 버튼 누를 때마다 `Date.now()` 기반 시드
- 또는 난이도 모드 + 시드로 결정론적 생성 (공유 가능)
- 시드를 공유하면 다른 사용자도 같은 맵 플레이 가능

## 데이터 구조 (생성된 맵)

```js
{
  id: `random-${seed}-${difficulty}`,
  title: 'RANDOM',
  difficulty: 2.1,
  width: 10,
  height: 10,
  sourceData: './bibleWordsLib1.json',
  grid: ['##########', '...'],
  cells: [
    { number: 1, answer: '모세', direction: 'across', row: 0, col: 1, length: 2, wordId: 'mose' },
    ...
  ],
}
```

## 앱 구현 계획

### 신규 파일
- `utils/generateRandomMap.js` - 프론트엔드 맵 생성 알고리즘
- `screens/RandomMapScreen.js` - 랜덤 맵 게임 화면 (기존 PuzzleScreen 재사용 가능)

### 수정 파일
- `App.js` - `randomMap` 라우팅 추가
- `screens/MapSelectScreen.js` - "랜덤 맵" 진입 카드 추가

### RandomMapScreen 흐름
1. 난이도 선택 (EASY / NORMAL / HARD)
2. "맵 생성" 버튼 → `generateRandomMap(difficulty)` 호출
3. 생성된 맵 객체를 PuzzleScreen에 전달
4. 플레이 완료 후:
   - "다시 플레이" → 새 시드로 새 맵 생성
   - "맵 선택으로" → MapSelectScreen 복귀

### 기존 PuzzleScreen 재사용
- PuzzleScreen은 `crosswordMap` 객체를 prop으로 받음
- 랜덤 맵도 같은 구조이므로 그대로 전달 가능
- `onBack`을 "랜덤 맵 메뉴"로 연결

## 성능 고려사항

### 생성 시간
- EASY (8×8, 10단어): 약 0.1~0.5초
- NORMAL (10×10, 15단어): 약 0.3~1초
- HARD (12×12, 15단어): 약 0.5~2초
- 시드 시도 횟수: 2,000~20,000회 (기기 성능에 따라 조정)

### 최적화
- 모바일에서 시드 수를 줄여 성능 확보 (예: 5,000회)
- 생성 중 로딩 인디케이터 표시
- Web Worker(Web) / setTimeout(Native)로 블로킹 방지
- 실패 시 시드 수 자동 증가 후 재시도

## 단어 재사용 정책
- 랜덤 맵은 고정 맵과 별개이므로 재사용 제한 느슨하게 적용
- 고정 맵 사용 이력은 무시, 랜덤 맵 내에서만 2회 제한
- 또는 재사용 제한 없이 자유롭게 (랜덤 맵 특성상 중복 단어 노출 가능)

## 저장 및 공유
- 생성된 맵을 `AsyncStorage`에 저장 (최대 10개)
- "최근 플레이한 랜덤 맵" 목록에서 재플레이 가능
- 시드 공유: URL 또는 텍스트로 시드 전달 → 같은 맵 재현
  - 예: `#random/EASY-1234567`

## 오프라인 동작
- 단어 데이터는 앱 번들에 포함되어 있음
- 네트워크 불필요, 완전 오프라인 동작

## Web/iOS/Android 호환성
- 순수 JS 알고리즘이므로 세 플랫폼 모두 동일 동작
- `bibleWordsLib1.json` import는 이미 프로젝트에서 사용 중
- 키보드 입력: 기존 PuzzleScreen 패턴 그대로 재사용

## 구현 순서
1. `utils/generateRandomMap.js` - 알고리즘 이식
2. 생성 성능 테스트 (Web/iOS/Android)
3. `screens/RandomMapScreen.js` - 난이도 선택 + 생성 + 플레이
4. `App.js` 라우팅 연결
5. `screens/MapSelectScreen.js` 진입점 추가
6. (옵션) 시드 공유 기능
7. (옵션) 최근 맵 저장/재플레이

## 제약 조건 (기존 맵 규칙과 동일)
- 홀로 다른 단어와 전혀 교차하지 않는 단어 금지
- 2×2 정사각형 금지
- 교차하지 않는 관련 없는 단어 글자 상하좌우 맞닿음 금지
- 같은 방향 단어 끝과 시작 맞닿음 금지
- 모든 단어는 최소 1회 교차
