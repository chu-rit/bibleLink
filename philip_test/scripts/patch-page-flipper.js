/**
 * Patch script for @laffy1309/react-native-page-flipper@1.0.2
 * Fixes: 마지막 페이지 역방향 3D 플립이 보이지 않는 문제
 * Run: node scripts/patch-page-flipper.js (after npm install)
 */
const fs = require('fs');
const path = require('path');

const pkgRoot = path.join(__dirname, '..', 'node_modules', '@laffy1309', 'react-native-page-flipper');

// 1. package.json: main을 lib/module로 변경
const pkgJsonPath = path.join(pkgRoot, 'package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
if (pkgJson.main !== 'lib/module/index') {
  pkgJson.main = 'lib/module/index';
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
  console.log('[patch] package.json main -> lib/module/index');
}

// 2. BookPagePortrait.js: 3곳 수정
const bpPath = path.join(pkgRoot, 'lib', 'module', 'portrait', 'BookPagePortrait.js');
let bp = fs.readFileSync(bpPath, 'utf8');

// 2-1. current를 static View 대신 IPage로 렌더링
const oldRender = `  }), current && next ? /*#__PURE__*/React.createElement(IPage, _extends({
    page: current,
    right: true
  }, iPageProps)) : /*#__PURE__*/React.createElement(View, {
    style: {
      height: '100%',
      width: '100%'
    }
  }, renderPage && /*#__PURE__*/React.createElement(View, {
    style: getPageStyle(true, true)
  }, renderPage(current.right))), prev && /*#__PURE__*/React.createElement(IPage, _extends({
    page: prev,
    right: false
  }, iPageProps)))))`;

const newRender = `  }), current && next ? /*#__PURE__*/React.createElement(IPage, _extends({
    page: current,
    right: true
  }, iPageProps)) : /*#__PURE__*/React.createElement(IPage, _extends({
    page: current,
    right: true
  }, iPageProps)), prev && /*#__PURE__*/React.createElement(IPage, _extends({
    page: prev,
    right: false
  }, iPageProps)))))`;

if (bp.includes(oldRender)) {
  bp = bp.replace(oldRender, newRender);
  console.log('[patch] current -> IPage: OK');
} else if (bp.includes(newRender)) {
  console.log('[patch] current -> IPage: already applied');
} else {
  console.log('[patch] current -> IPage: FAIL (pattern not found)');
}

// 2-2. portraitBackStyle에 Extrapolate.CLAMP 추가
const oldBackStyle = `  const portraitBackStyle = useAnimatedStyle(() => {
    const x = interpolate(rotationVal.value, [0, 180], [containerWidth, -containerWidth / 2]);
    const w = interpolate(rotationVal.value, [0, 180], [0, containerWidth / 2]);`;

const newBackStyle = `  const wrapperStyle = useAnimatedStyle(() => {
    return {
      zIndex: right ? (rotateYAsDeg.value < 0 ? -2 : 0) : -1
    };
  });
  const portraitBackStyle = useAnimatedStyle(() => {
    const x = interpolate(rotationVal.value, [0, 180], [containerWidth, -containerWidth / 2], Extrapolate.CLAMP);
    const w = interpolate(rotationVal.value, [0, 180], [0, containerWidth / 2], Extrapolate.CLAMP);`;

if (bp.includes(oldBackStyle)) {
  bp = bp.replace(oldBackStyle, newBackStyle);
  console.log('[patch] wrapperStyle + Extrapolate.CLAMP: OK');
} else if (bp.includes(newBackStyle)) {
  console.log('[patch] wrapperStyle + Extrapolate.CLAMP: already applied');
} else {
  console.log('[patch] wrapperStyle + Extrapolate.CLAMP: FAIL (pattern not found)');
}

// 2-3. IPage wrapper View를 Animated.View로 변경
const oldWrapper = `  return /*#__PURE__*/React.createElement(View, {
    style: {
      ...StyleSheet.absoluteFillObject,
      zIndex: -1
    },
    pointerEvents: "box-none"
  }, /*#__PURE__*/React.createElement(Animated.View, {`;

const newWrapper = `  return /*#__PURE__*/React.createElement(Animated.View, {
    style: [StyleSheet.absoluteFillObject, wrapperStyle, {
      pointerEvents: "box-none"
    }]
  }, /*#__PURE__*/React.createElement(Animated.View, {`;

if (bp.includes(oldWrapper)) {
  bp = bp.replace(oldWrapper, newWrapper);
  console.log('[patch] wrapper -> Animated.View: OK');
} else if (bp.includes(newWrapper)) {
  console.log('[patch] wrapper -> Animated.View: already applied');
} else {
  console.log('[patch] wrapper -> Animated.View: FAIL (pattern not found)');
}

fs.writeFileSync(bpPath, bp, 'utf8');

// 3. 문법 체크
try {
  const parser = require('@babel/parser');
  parser.parse(bp, { sourceType: 'module', plugins: ['jsx'] });
  console.log('[patch] syntax check: OK');
} catch (e) {
  console.error('[patch] syntax check: FAIL -', e.message);
  process.exit(1);
}

console.log('[patch] done');
