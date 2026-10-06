# Android 빌드 정보

## 앱 식별자
- 패키지명(applicationId): `com.churit.biblelink` — `app.json`의 `android.package` (iOS bundleIdentifier와 동일)
- EAS 프로젝트: `@churit/bible-link` (projectId `88a2aecd-1a65-4447-bf99-f0d11a366c5b`)
- 앱 버전: `1.0.0` (`runtimeVersion` 정책: `appVersion`)

## 서명(credentials)
- 키스토어: EAS 원격 credentials에 자동 생성·보관 (Build Credentials `XDSU97HSyL`, default)
- 로컬 키스토어 파일 없음 — `eas credentials` 또는 expo.dev 프로젝트 페이지에서 관리·백업 가능
- 모든 Android 빌드(production/preview)가 이 키스토어로 서명됨

## 버전 코드
- `eas.json`의 `appVersionSource: remote` + `autoIncrement: true`로 빌드마다 자동 증가
- 현재까지 발급: 2(production AAB) → 3(preview APK) → 4(preview APK)

## 빌드 프로필 (`eas.json`)
| 프로필 | 용도 | 산출물 | 채널 |
|---|---|---|---|
| `production` | Play 스토어 제출 | AAB | `production` |
| `preview` | 내부 테스트 설치 | APK | `preview` |
| `development` | dev client | APK | `development` |

## 빌드 명령
- 스토어용 AAB: `npx eas build -p android --profile production`
- 테스트용 APK: `npx eas build -p android --profile preview`
- 빌드는 로컬 작업 트리 기준으로 업로드되므로 커밋 여부와 무관하게 현재 코드가 반영됨

## 빌드 이력
| 빌드 | 프로필 | versionCode | 결과물/링크 |
|---|---|---|---|
| 8ea7668d-4c92-46d1-a42e-a9906d7bf41d | production | 2 | AAB: https://expo.dev/artifacts/eas/O8VooXP3Hvfm8FNMCkszYRsqY2gtI0qRZPR1OWZW8n0.aab |
| 294999cc-a663-4bbd-9c15-4401aeafe48b | preview | 3 | APK 설치 페이지(최초 테스트용) |
| d63a6a3a-8f30-4347-9596-8b2ba5434bb7 | preview | 4 | APK 설치 페이지 — 맵 5열·연대기 폰트 패딩 수정 포함 |

- **주의:** vc2의 AAB는 Android 전용 수정(맵 5열, 연대기 폰트 패딩) 이전 빌드라 제출용으로 쓰면 안 됨. Play 제출 전 production 프로필로 AAB 재빌드 필요
- OTA: production 채널은 `eas update`로 JS 번들만 갱신됨 — 네이티브 변경(패키지명 등)은 새 빌드가 필요하므로 vc2 AAB는 OTA와 무관하게 구버전 바이너리

- 설치 페이지: https://expo.dev/accounts/churit/projects/bible-link/builds/<빌드 ID>
- 빌드 목록: `npx eas build:list --platform android`

## Play 제출
- `eas.json`의 `submit.production`에는 현재 iOS 설정만 있음 (`ascAppId: 6815505330`)
- `eas submit -p android`를 쓰려면 Play Console 서비스 계정 JSON 키를 `submit.production.android.serviceAccountKeyPath`에 지정해야 함
- 서비스 계정 없이는 AAB를 Play Console에 수동 업로드

## 알려진 Android 전용 수정 사항
- 맵 리스트 그리드: 퍼센트 너비 대신 픽셀 계산 (`MapSelectScreen.js`, Yoga 반올림 오차로 4열로 표시되던 문제)
- 연대기 텍스트: `includeFontPadding: false` (`ChronologyScreen.js`, Android 폰트 패딩으로 글자가 밀려 잘리던 문제)
- 소프트 키보드: `softwareKeyboardLayoutMode: "resize"` (`app.json`)
