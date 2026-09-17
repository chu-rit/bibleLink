# pageFlipper

`@laffy1309/react-native-page-flipper@1.0.2`의 `lib/module` 빌드를 프로젝트 안으로 옮겨 온 사본이다 (MIT, `LICENSE` 참고).
patch-package 없이 저장소만 받으면 동일하게 동작하도록 하기 위해 포함했다.

원본 대비 수정한 부분:
- 세로 모드 페이지에 `key`를 부여해 페이지 내용이 바뀌면 다시 마운트되도록 함
- `current`가 바뀌면 회전값(`rotateYAsDeg`, `x`)을 초기화
- 마지막 페이지도 `IPage`로 렌더
- 컨테이너 폭을 shared value로 두어 창 크기 변경에 애니메이션이 따라오도록 함
- iOS Safari 뒤로 넘김 대응: 음수 폭 클램프, 이전 페이지 래퍼 `zIndex` 0
- 컨테이너 폭이 0이면 렌더하지 않음
