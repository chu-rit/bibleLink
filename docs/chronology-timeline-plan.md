# 연대기 타임라인 구현 계획

## 개요
- Elastic History I(Pieter A.E. Hoppenbrouwers) 스타일의 탄력적(연속 줌) 연대기 뷰어
- 하루 간격 사건부터 수천 년 간격 사건까지 한 타임라인에 표시하고, 핀치로 시간 스케일을 연속 확대/축소
- 데이터: `data/chronologyEvents.json` (808건, 기원전 4026~기원후 2026)
  - 원본: `data/DemoData English.csv` + `data/TalkFile_bible_history_korean.csv` (Elastic History CSV 형식)
  - 변환: `npm run build:chronology` (`scripts/convertChronology.js`), 수동 번역은 `data/chronologyTranslations.json`

## 참고 앱(Elastic History) 기능 분석
- 수평 타임라인: 사건은 축 위 라벨, 기간(시작~종료 연도가 있는 항목)은 축 아래 막대로 표시
- 줌은 핀치만 사용(버튼 줌은 1.970에서 제거), 스케일이 연속으로 변하며 사건 간격이 유지됨
- 줌이 깊어질수록 숨겨져 있던 사건이 점진적으로 드러남 — CSV의 "표시 단계" 필드로 제어
- 사건·기간 롱프레스 → 출처 웹페이지 열기 (우리 데이터는 jw.org 링크 801건)
- 월 단위까지 줌하면 유대 달력도 표기(선택 기능 — 우리 적용 여부는 미정)
- iPad용 설계, CSV 파일 입력 지원 (우리 데이터 원본이 이 앱의 입력 형식)

## 데이터 구조 (`data/chronologyEvents.json`)
| 필드 | 의미 | 건수 |
|---|---|---|
| `id` | 원본 CSV 행 번호 | 전체 |
| `level` | 표시 단계 0~6 (클수록 주요, 축소 상태에서도 표시. L6=35건: 아담·셋 등) | 0:18, 1:26, 2:13, 3:321, 4:317, 5:77, 6:35, null:1 |
| `year` | 연도 (음수=기원전) | 범위 -4026~2026 |
| `month`/`day`/`hour` | 선택, 하위 자릿수 | month 이하 271건 |
| `uncertaintyHours` | 시작 시점 불확실성(시간) | 118건 |
| `endYear`~`endHour` | 기간 종료 (수명·재위기간 등) | 204건 |
| `endUncertaintyHours` | 종료 불확실성 | 일부 |
| `event` | 한국어 사건 텍스트 | 전체 |
| `category` | 사건 475, 인물 134, 성경 79, 왕 45, 기간 32, 신성한 비밀 12, 전쟁 10, 세계 강국 7, 전염병 6, 조정 4, 연례 대회 3, 고고학 1 | 12종 |
| `source` | jw.org 출처 링크 | 801건 |
| `needsReview` | 번역 검토 필요 표시 | 0건 (정제 완료) |

- **연도 0 없음 주의**: `year=-1`이 기원전 1년, `year=1`이 기원후 1년. 좌표 변환 시 BCE↔CE 경계 보정 필요
- `level=null` 1건(id 299) — 필터링 기본값 정책 결정 필요

## 화면 구성
- `screens/ChronologyScreen.js` 신규 화면 — 헤드업처럼 플리퍼가 아닌 독립 screen으로 처리 (가로 전용)
- 메뉴에 "연대기" 버튼 추가 (현재 3개 → 4개)
- 가로 전용: 진입 시 `lockOrientation('LANDSCAPE')`, 복귀 시 `'PORTRAIT_UP'` (헤드업과 동일 패턴)
- 웹: `landscape-allowed` + 전체화면 root 패턴 재사용 (`heads-up-active`와 동일하게 `100vw×100dvh` 해제 클래스 추가 — 클래스명 일반화 검토)
- `components/AppHeader.js` 공통 헤더 재사용 (‹ 뒤로가기)
- 사건/기간 롱프레스 → `Linking.openURL(source)` (없으면 무시, 7건)
- 카테고리별 색상 + 범례/필터 칩 (선택적 — 12종이면 필터 가치 있음)

## 렌더링 설계
- 시간 좌표: `x = (time - viewStart) * pxPerUnit`. `time`은 연+월+일을 일(day) 단위 연속값으로 변환한 유사-epoch (BCE/CE 경계·윤년 근사 허용 — 정밀도는 눈금 표시용 정도면 충분)
- 가상화: 뷰포트 시간 구간에 걸리는 이벤트만 렌더. 연도 정렬 배열 + 이진 탐색으로 윈도우 산출
- 줌 스케일 → 표시 `level` 매핑: 현재 표시 연수(span)에 따라 임계값 적용
  - 예시(조정 필요): span ≥ 3000년 → level 6, ≥ 1000 → 5+, ≥ 300 → 4+, ≥ 100 → 3+, ≥ 30 → 2+, ≥ 10 → 1+, 그 미만 → 전체
- 축 눈금: span에 따라 밀레니엄/세기/연/월/일 눈금 자동 선택, BCE 구간은 "기원전" 표기
- 사건 라벨: 축 위에 점/틱 + 텍스트, 겹침 회피를 위해 다중 레인 배치 (x 정렬 순서대로 레인에 greedy 배치)
- 기간 막대: 축 아래 수평 바(길이=기간), 카테고리 색, 양단 `uncertaintyHours` 있으면 흐림 처리 옵션
- 렌더 방식: View/Text 기반 레인 배치가 단순. 성능 부족 시 `react-native-svg`(설치됨)로 전환 검토

## 제스처
- `react-native-gesture-handler`(설치됨): Pan=시간축 이동, Pinch=핀치 중심의 시간을 고정한 스케일 변경
- `react-native-reanimated`(설치됨) 필요 시 UI 스레드 변환; 초기 구현은 state+Animated로 시작해도 됨
- 웹: 휠=줌(커서 위치 시간 고정), 드래그=이동, 롱프레스 대신 우클릭/클릭 링크 처리 결정

## 구현 단계
1. `utils/chronology.js` — 데이터 로드, 시간→epoch 일수 변환, level 매핑, BCE/CE 포맷
2. `screens/ChronologyScreen.js` — 축+눈금+pan/pinch 코어
3. 사건 라벨 레인 배치 + level 필터링
4. 기간 막대 + 카테고리 색상/범례
5. 롱프레스 출처 링크, 웹 휠/드래그 대응
6. 메뉴 버튼·화면 전환·가로 잠금 연동
7. 검증(웹/모바일) 후 발행

## 미결정 사항
- `level` 의미(높을수록 주요=축소 시에도 표시,로 추정) — Elastic History 동작 기준으로 확인 후 임계값 확정
- 최대 줌 깊이: 일 단위까지(데이터에 일 자릿수 있음) vs 연 단위까지만
- 웹에서 가로가 아닐 때: 헤드업처럼 세로 안내 오버레이 vs 세로 레이아웃 지원
- 메뉴 버튼명: "연대기" / "성경 연대기" 등
- 번들 크기: `chronologyEvents.json` ~7465줄 — 일반 require로 충분한지, 지연 로딩 필요 여부
