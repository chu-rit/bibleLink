import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { lockOrientation } from '../utils/orientation';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { CATEGORIES, ITEMS, MAX_T, MIN_T, categoryColor, formatYear, serialToMonth, serialToYear } from '../utils/chronology';
import { scaleFont, useContentMaxWidth, useUiScale } from '../utils/responsive';

const BG_IMAGE = require('../assets/BG.png');

const AXIS_MARGIN = 8;
const GAUGE_WIDTH = 140;
const SCROLL_GAUGE_WIDTH = 140;
const SCROLL_TICKS = [0, 0.25, 0.5, 0.75, 1].map((f) => {
  const year = serialToYear(MIN_T - 100 + f * (MAX_T - MIN_T + 200));
  return { f, label: year < 0 ? `-${-year}` : `${year}` };
});
const GAUGE_RESERVE = 30;
// 게이지 각 25% 지점에 해당하는 표시 연수
const GAUGE_STOPS = [2000, 1000, 500, 50, 5, 1];
const EVENT_ROW_HEIGHT = 22;
const PERIOD_LANE_HEIGHT = 19;
const PERIOD_BAR_HEIGHT = 15;
const AXIS_LABEL_HEIGHT = 16;
const FONT_SIZE = 10;

// 한글은 굵게, 영문·숫자·기호는 좁게 잡아 라벨 폭을 추정
const textWidth = (text) => {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 0xff ? 11 : 5.5;
  return w + 8;
};

const TICK_STEPS = [1 / 12, 1 / 6, 1 / 4, 1 / 2, 1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2500];

const clampView = (v, width) => {
  const pxPerYear = Math.min(Math.max(v.pxPerYear, width / 7000), width * 6);
  const start = Math.min(Math.max(v.start, MIN_T - 100), MAX_T + 100 - width / pxPerYear);
  return { start, pxPerYear };
};

// 초기 뷰: 가장 과거 기준 스팬 (모바일 2000년, 태블릿 3000년)
const fitAll = (width, span = 2000) => clampView({ start: MIN_T - 30, pxPerYear: width / span }, width);

export default function ChronologyScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const uiScale = useUiScale();
  const sf = (n) => scaleFont(n, uiScale);
  const sz = (n) => Math.round(n * uiScale);
  const contentMaxWidth = useContentMaxWidth();
  // 콘텐츠 여백·레이아웃 방향은 윈도우 크기 기준 — onLayout 측정 전 첫 렌더부터 안정된 값을 쓴다
  const { width: windowW, height: windowH } = useWindowDimensions();
  const sidePad = Math.max(0, (windowW - contentMaxWidth) / 2);
  // 타임라인 요소는 레이아웃 수치와 함께 스케일 — 텍스트 폭 추정도 같은 배율로 맞춘다
  const tScale = uiScale;
  const axisMargin = Math.round(AXIS_MARGIN * tScale);
  const eventRowH = Math.round(EVENT_ROW_HEIGHT * tScale);
  const periodLaneH = Math.round(PERIOD_LANE_HEIGHT * tScale);
  const periodBarH = Math.round(PERIOD_BAR_HEIGHT * tScale);
  const axisLabelH = Math.round(AXIS_LABEL_HEIGHT * tScale);
  const gaugeReserve = Math.round(GAUGE_RESERVE * tScale);
  // 게이지·필터 같은 조작 UI는 타임라인보다 더 크게 — 태블릿 터치 대상 확보
  const gScale = Math.min(1 + (tScale - 1) * 1.8, 2);
  const gz = (n) => Math.round(n * gScale);
  const gf = (n) => Math.round(n * (1 + (gScale - 1) * 0.7));
  // 태블릿에서는 게이지를 더 길게 — 화면 끝과 콘텐츠 여백의 중간쯤에 두고 서로 겹치지 않게 폭을 제한
  const gaugeLen = gScale * (tScale > 1 ? 1.5 : 1);
  const gaugeInset = 10 + sidePad * 0.5;
  const gaugeW = Math.round(Math.min(GAUGE_WIDTH * gaugeLen, Math.max(0, (windowW - gaugeInset * 2 - 16) / 2)));
  const scrollGaugeW = Math.round(Math.min(SCROLL_GAUGE_WIDTH * gaugeLen, Math.max(0, (windowW - gaugeInset * 2 - 16) / 2)));
  const tlFont = (n) => Math.round(n * tScale);
  const tw = (text) => textWidth(text) * tScale;
  // 회전 버튼: 누를 때마다 가로/세로 강제 잠금을 번갈아 건다 (진입은 세로 고정)
  const [isLandscape, setIsLandscape] = useState(false);
  const toggleOrientation = () => {
    lockOrientation(isLandscape ? 'PORTRAIT' : 'LANDSCAPE');
    setIsLandscape(!isLandscape);
  };
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState(null);
  const [hiddenCats, setHiddenCats] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const viewRef = useRef(null);
  const baseRef = useRef(null);
  const containerRef = useRef(null);

  const width = size.width;
  const height = size.height;
  const defaultSpan = tScale > 1 ? 3000 : 2000;
  const gaugeStops = tScale > 1 ? [3000, ...GAUGE_STOPS] : GAUGE_STOPS;
  const activeView = view || (width ? fitAll(width, defaultSpan) : { start: MIN_T, pxPerYear: 0.1 });
  viewRef.current = activeView;

  const zoomBy = (factor, focalX) => {
    if (!width) return;
    setView((v) => {
      const cur = v || fitAll(width, defaultSpan);
      const pxPerYear = cur.pxPerYear * factor;
      const anchorT = cur.start + focalX / cur.pxPerYear;
      return clampView({ start: anchorT - focalX / pxPerYear, pxPerYear }, width);
    });
  };

  const pan = useMemo(() => Gesture.Pan().runOnJS(true)
    .onStart(() => { baseRef.current = viewRef.current; })
    .onUpdate((e) => {
      const b = baseRef.current;
      if (!b) return;
      setView(clampView({ ...b, start: b.start - e.translationX / b.pxPerYear }, width));
    }), [width]);

  const pinch = useMemo(() => Gesture.Pinch().runOnJS(true)
    .onStart(() => { baseRef.current = viewRef.current; })
    .onUpdate((e) => {
      const b = baseRef.current;
      if (!b) return;
      const pxPerYear = Math.min(Math.max(b.pxPerYear * e.scale, width / 7000), width * 6);
      const anchorT = b.start + e.focalX / b.pxPerYear;
      setView(clampView({ start: anchorT - e.focalX / pxPerYear, pxPerYear }, width));
    }), [width]);

  const composed = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);

  // 좌우 스크롤 게이지: 노브가 현재 보이는 구간의 위치, 탭/드래그로 이동
  const applyScrollFrac = (frac) => {
    const v = viewRef.current;
    if (!width || !v) return;
    const min = MIN_T - 100;
    const max = MAX_T + 100 - width / v.pxPerYear;
    const range = Math.max(max - min, 0);
    setView(clampView({ start: min + Math.min(Math.max(frac, 0), 1) * range, pxPerYear: v.pxPerYear }, width));
  };
  const scrollPan = useMemo(() => Gesture.Pan().runOnJS(true)
    .onStart((e) => applyScrollFrac(e.x / scrollGaugeW))
    .onUpdate((e) => applyScrollFrac(e.x / scrollGaugeW)), [width, scrollGaugeW]);
  const scrollTap = useMemo(() => Gesture.Tap().runOnJS(true)
    .onEnd((e) => applyScrollFrac(e.x / scrollGaugeW)), [width, scrollGaugeW]);
  const scrollGesture = useMemo(() => Gesture.Exclusive(scrollPan, scrollTap), [scrollPan, scrollTap]);

  // 웹: 휠 줌 (커서 위치 시간 고정)
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = containerRef.current;
    if (!node || !node.addEventListener) return undefined;
    const onWheel = (ev) => {
      ev.preventDefault();
      const rect = node.getBoundingClientRect();
      zoomBy(ev.deltaY < 0 ? 1.25 : 1 / 1.25, ev.clientX - rect.left);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [width]);

  const openSource = (item) => {
    if (item.source) Linking.openURL(item.source).catch(() => {});
  };

  // uncertaintyHours가 약 1년(8640시간) 이상이면 연도가 확정되지 않은 "추정"으로 표시
  const UNCERTAIN_HOURS = 8640;
  const isUncertain = (item) => (item.uncertaintyHours || 0) >= UNCERTAIN_HOURS || (item.endUncertaintyHours || 0) >= UNCERTAIN_HOURS;

  const formatDate = (item) => {
    const fmt = (y, m, d) => `${formatYear(y)}${m ? ` ${m}월` : ''}${d ? ` ${d}일` : ''}`;
    const from = fmt(item.year, item.month, item.day);
    const base = item.endYear !== undefined ? `${from} ~ ${fmt(item.endYear, item.endMonth, item.endDay)}` : from;
    return isUncertain(item) ? `${base} (추정)` : base;
  };

  const span = width / activeView.pxPerYear;
  const viewEnd = activeView.start + span;
  const spanLabel = span >= 1 ? `약 ${Math.round(span).toLocaleString()}년` : `약 ${Math.max(1, Math.round(span * 12))}개월`;
  const scrollRange = Math.max(MAX_T + 100 - span - (MIN_T - 100), 0.001);
  const scrollFrac = Math.min(Math.max((activeView.start - (MIN_T - 100)) / scrollRange, 0), 1);

  // 줌 게이지: 1000→500→50→5→1년 구간을 로그 보간으로 연결
  const spanToFrac = (s) => {
    if (s >= gaugeStops[0]) return 0;
    for (let i = 0; i < gaugeStops.length - 1; i++) {
      const hi = gaugeStops[i];
      const lo = gaugeStops[i + 1];
      if (s >= lo) return (i + 1 - Math.log(s / lo) / Math.log(hi / lo)) / (gaugeStops.length - 1);
    }
    return 1;
  };
  const fracToSpan = (f) => {
    const pos = Math.min(Math.max(f, 0), 1) * (gaugeStops.length - 1);
    const i = Math.min(Math.floor(pos), gaugeStops.length - 2);
    return gaugeStops[i + 1] * Math.pow(gaugeStops[i] / gaugeStops[i + 1], i + 1 - pos);
  };
  const zoomFrac = spanToFrac(span);
  // 게이지 탭: 눈금 구역으로 스냅
  const applyGauge = (i) => {
    const v = viewRef.current;
    if (!width || !v) return;
    zoomBy(width / gaugeStops[i] / v.pxPerYear, 0);
  };
  // 게이지 드래그: 구간 사이도 연속으로, 시작 연도(좌측 끝) 기준 확대
  const applyGaugeSpan = (s) => {
    const v = viewRef.current;
    if (!width || !v) return;
    setView(clampView({ start: v.start, pxPerYear: width / s }, width));
  };
  const zoomGaugePan = useMemo(() => Gesture.Pan().runOnJS(true)
    .onStart((e) => applyGaugeSpan(fracToSpan(e.x / gaugeW)))
    .onUpdate((e) => applyGaugeSpan(fracToSpan(e.x / gaugeW))), [width, gaugeW]);
  const zoomGaugeTap = useMemo(() => Gesture.Tap().runOnJS(true)
    .onEnd((e) => applyGauge(Math.round(Math.min(Math.max(e.x / gaugeW, 0), 1) * (gaugeStops.length - 1)))), [width, gaugeW, gaugeStops]);
  const zoomGesture = useMemo(() => Gesture.Exclusive(zoomGaugePan, zoomGaugeTap), [zoomGaugePan, zoomGaugeTap]);
  const axisY = Math.round(height * 0.5);
  const laneCap = Math.round(10 * tScale);
  const maxEventLanes = Math.min(laneCap, Math.max(2, Math.floor((axisY - axisMargin) / eventRowH)));
  const maxPeriodLanes = Math.min(laneCap, Math.max(1, Math.floor((height - axisY - axisLabelH - axisMargin - gaugeReserve) / periodLaneH)));

  const { eventMarks, periodBars, ticks, rangeLabels } = useMemo(() => {
    if (!width || !height) return { eventMarks: [], periodBars: [], ticks: [], rangeLabels: null };
    const { start, pxPerYear } = activeView;
    // 드래그로 도달 가능한 시작 범위 (clampView와 동일 경계)
    const startMin = MIN_T - 100;
    const startMax = MAX_T + 100 - width / pxPerYear;

    // 사건 라벨: 축 위, 세로 막대 우측에 텍스트. level 우선순위대로 빈 레인 자리를 채우고
    // 모든 레인이 찼을 때만 숨김. 박스는 불투명 배경으로 줄기 위에 표시됨
    const candidates = ITEMS.filter((item) =>
      item.endT === null
      && item.t >= start - 4
      && item.t <= viewEnd
      && !hiddenCats.has(item.category)
    ).sort((a, b) => (b.level ?? 3) - (a.level ?? 3) || a.t - b.t);
    const rangeLabels = { left: formatYear(serialToYear(start)), right: formatYear(serialToYear(viewEnd)) };
    // 축 양 끝의 범위 라벨 자리를 레인 0에 미리 점유
    const laneSpans = [[
      [0, axisMargin + tw(rangeLabels.left) + sz(2)],
      [width - axisMargin - tw(rangeLabels.right) - sz(2), width],
    ]];
    const eventMarks = [];
    for (const item of candidates) {
      const x = (item.t - start) * pxPerYear;
      const l = x;
      const r = x + sz(1.5) + tw(item.event) + sz(4);
      if (r <= axisMargin || l >= width - axisMargin) continue;
      // 스크롤을 끝까지 해도 라벨 전체가 경계 안에 들어올 수 없으면 마커 통째로 숨김
      const xReachMin = (item.t - startMax) * pxPerYear;
      const xReachMax = (item.t - startMin) * pxPerYear;
      if (xReachMin > width - axisMargin - (r - l) || xReachMax < axisMargin) continue;
      for (let lane = 0; lane < maxEventLanes; lane++) {
        const spans = laneSpans[lane] || (laneSpans[lane] = []);
        if (spans.some(([a, b]) => l < b && r > a)) continue;
        spans.push([l, r]);
        eventMarks.push({ item, x, lane });
        break;
      }
    }
    // 낮은 레인 박스가 위 레인의 줄기 위에 그려지도록 레인 내림차순으로 렌더
    eventMarks.sort((a, b) => b.lane - a.lane);

    // 기간 막대: 축 아래, 텍스트는 막대 안에. 겹치는 막대는 아래 레인으로
    const periodRight = [];
    const periodBars = [];
    const periodCandidates = ITEMS.filter((item) =>
      item.endT !== null
      && item.endT >= start
      && item.t <= viewEnd
      && !hiddenCats.has(item.category)
    ).sort((a, b) => (b.level ?? 3) - (a.level ?? 3) || a.t - b.t);
    for (const item of periodCandidates) {
      const x0 = (item.t - start) * pxPerYear;
      const x = Math.max(x0, axisMargin);
      const w = Math.min(x0 + Math.max(sz(4), (item.endT - item.t) * pxPerYear), width - axisMargin) - x;
      if (w <= 0) continue;
      let lane = periodRight.findIndex((r) => x > r + 4);
      if (lane === -1) {
        if (periodRight.length >= maxPeriodLanes) continue;
        lane = periodRight.length;
        periodRight.push(-Infinity);
      }
      periodRight[lane] = x + w;
      periodBars.push({ item, x, w, lane });
    }

    // 눈금: 라벨이 좌우 경계를 넘는 눈금은 선째로 건너뛴다
    const step = TICK_STEPS.find((s) => s * pxPerYear >= 78 * tScale) || 2500;
    const ticks = [];
    for (let t = Math.ceil(start / step) * step; t <= viewEnd; t += step) {
      const x = (t - start) * pxPerYear;
      const isMonthTick = t % 1 !== 0;
      const year = serialToYear(t);
      const label = isMonthTick ? `${serialToMonth(t)}월` : (year < 0 ? `BC ${-year}` : `${year}`);
      const half = tw(label) / 2;
      if (x - half < axisMargin || x + half > width - axisMargin) continue;
      ticks.push({ t, x });
    }
    return { eventMarks, periodBars, ticks, rangeLabels };
  }, [activeView, width, height, viewEnd, hiddenCats, maxEventLanes, maxPeriodLanes, tScale]);

  const searchResults = useMemo(() => {
    const q = searchQuery.replace(/\s/g, '');
    if (!q) return [];
    return ITEMS.filter((it) => it.event.replace(/\s/g, '').includes(q))
      .sort((a, b) => {
        const as = a.event.replace(/\s/g, '').startsWith(q) ? 0 : 1;
        const bs = b.event.replace(/\s/g, '').startsWith(q) ? 0 : 1;
        return as - bs || a.t - b.t;
      })
      .slice(0, 30);
  }, [searchQuery]);

  // 검색 결과 선택: 해당 항목이 화면 중앙에 오도록 이동 (너무 축소된 상태면 500년 스팬까지 확대)
  const jumpToItem = (item) => {
    if (!width) return;
    const targetSpan = Math.min(width / activeView.pxPerYear, 500);
    const pxPerYear = width / targetSpan;
    const mid = item.endT != null ? (item.t + item.endT) / 2 : item.t;
    setView(clampView({ start: mid - targetSpan / 2, pxPerYear }, width));
    setSelected({ item, area: item.endT != null ? 'period' : 'event' });
    setSearchOpen(false);
    setSearchQuery('');
  };

  const toggleCategory = (cat) => {
    setHiddenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const sizeReady = width > 0 && height > 0;
  const wideLayout = windowW > windowH;
  const catChips = useMemo(() => CATEGORIES.map((cat) => {
    const hidden = hiddenCats.has(cat);
    return (
      <Pressable key={cat} onPress={() => toggleCategory(cat)} style={[styles.chip, { paddingHorizontal: gz(8), paddingVertical: gz(4), borderRadius: gz(10) }, hidden && styles.chipHidden]}>
        <View style={[styles.dot, { width: gz(8), height: gz(8), borderRadius: gz(4), marginRight: gz(5), backgroundColor: categoryColor(cat) }]} />
        <Text style={[styles.chipText, { fontSize: gf(11) }, hidden && styles.chipTextHidden]}>{cat}</Text>
      </Pressable>
    );
  }), [hiddenCats, gScale]);

  return (
    <ImageBackground source={BG_IMAGE} resizeMode="cover" imageStyle={styles.bgFill} style={[styles.screen, { paddingTop: insets.top }]}>
      <AppHeader onBack={() => onBack(isLandscape)} onRotate={toggleOrientation} onSearch={() => setSearchOpen(true)} />
      <View style={styles.timelineWrap}>
      <GestureDetector gesture={composed}>
        <View
          ref={containerRef}
          style={styles.timeline}
          onLayout={(e) => setSize(e.nativeEvent.layout)}
        >
          {sizeReady && (<>
          {/* 사건 영역 전체가 클리핑 창: 내용은 자연 위치, 경계에서만 잘림 */}
          <View style={{ position: 'absolute', left: axisMargin, top: 0, width: Math.max(width - axisMargin * 2, 0), height: axisY, overflow: 'hidden' }}>
            {eventMarks.map(({ item, x, lane }) => {
              const c = categoryColor(item.category);
              return (
                <Pressable
                  key={`e${item.id}`}
                  onPress={() => setSelected({ item, area: 'event' })}
                  style={[styles.eventMark, { height: eventRowH, left: x - axisMargin, top: axisY - (lane + 1) * eventRowH }]}
                >
                  <View style={[styles.eventStem, { height: (lane + 1) * eventRowH, width: Math.max(1.5, sz(1.5)), backgroundColor: c }]} />
                  <View style={[styles.eventBox, { paddingHorizontal: sz(4), paddingVertical: sz(1), borderRadius: sz(4), borderColor: c }]}>
                    <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.eventText, { fontSize: tlFont(FONT_SIZE), color: c }]}>
                      {item.event}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.axis, { top: axisY, left: axisMargin, right: axisMargin }]} />

          {rangeLabels && (
            <>
              <Text style={[styles.rangeLabel, { fontSize: tlFont(9), top: axisY - Math.round(15 * tScale), left: axisMargin }]}>{rangeLabels.left}</Text>
              <Text style={[styles.rangeLabel, { fontSize: tlFont(9), top: axisY - Math.round(15 * tScale), right: axisMargin }]}>{rangeLabels.right}</Text>
            </>
          )}

          {ticks.map(({ t, x }) => {
            const isMonthTick = t % 1 !== 0;
            const year = serialToYear(t);
            const label = isMonthTick ? `${serialToMonth(t)}월` : (year < 0 ? `BC ${-year}` : `${year}`);
            return (
              <View key={`t${t.toFixed(3)}`} style={[styles.tick, { width: sz(80), left: x - sz(40), top: axisY }]}>
                <View style={[styles.tickLine, { height: sz(6) }]} />
                <Text numberOfLines={1} style={[styles.tickLabel, { fontSize: tlFont(9), marginTop: sz(1) }]}>{label}</Text>
              </View>
            );
          })}

          {periodBars.map(({ item, x, w, lane }) => {
            const textW = tw(item.event) * 0.9;
            const textOffset = textW <= w ? (w - textW) / 2 : 0;
            return (
              <Pressable
                key={`p${item.id}`}
                onPress={() => setSelected({ item, area: 'period' })}
                style={[styles.periodBar, { height: periodBarH, borderRadius: sz(4), left: x, top: axisY + axisLabelH + sz(4) + lane * periodLaneH, width: w, backgroundColor: categoryColor(item.category) }]}
              >
                <View style={styles.periodBarFill}>
                  <Text style={[styles.periodText, { fontSize: tlFont(9), marginLeft: textOffset }, Platform.OS === 'web' && { WebkitTextStroke: '1.2px rgba(0,0,0,0.9)', paintOrder: 'stroke fill', whiteSpace: 'nowrap' }]}>{item.event}</Text>
                </View>
              </Pressable>
            );
          })}
          </>)}
        </View>
      </GestureDetector>
      {sizeReady && (
        <View style={styles.spanBadgeWrap} pointerEvents="none">
          <View style={[styles.spanBadge, { paddingHorizontal: gz(10), paddingVertical: gz(3), borderRadius: gz(10), gap: gz(6) }]}>
            <Text style={[styles.spanArrowText, { fontSize: sf(13) }]}>◀</Text>
            <Text style={[styles.spanBadgeText, { fontSize: sf(11) }]}>{spanLabel}</Text>
            <Text style={[styles.spanArrowText, { fontSize: sf(13) }]}>▶</Text>
          </View>
        </View>
      )}
      {selected && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
      )}
      {selected && (
        <View style={[styles.detailPanel, { left: axisMargin + sz(6) + sidePad, right: axisMargin + sz(6) + sidePad, padding: sz(10), paddingRight: sz(34), borderRadius: sz(8) }, selected.area === 'event' ? { top: axisY + axisLabelH + sz(4) } : { bottom: height - axisY + sz(4) }]}>
          <Pressable style={styles.detailClose} onPress={() => setSelected(null)}>
            <Text style={[styles.detailCloseText, { fontSize: sf(14) }]}>✕</Text>
          </Pressable>
          <Pressable onPress={() => openSource(selected.item)}>
            <Text style={[styles.detailTitle, { fontSize: sf(14) }]}>{selected.item.event}({selected.item.category})</Text>
          </Pressable>
          <Text style={[styles.detailMeta, { fontSize: sf(11) }]}>{formatDate(selected.item)}</Text>
          {selected.item.memo ? <Text style={[styles.detailMemo, { fontSize: sf(10) }]}>{selected.item.memo}</Text> : null}
        </View>
      )}

      {sizeReady && (
      <View style={[styles.zoomGauge, { width: gaugeW, height: gz(34), right: gaugeInset }]}>
        <View style={[styles.gaugeTrack, { top: gz(7), height: gz(4), borderRadius: gz(2) }]} />
        {gaugeStops.map((v, i) => {
          const f = i / (gaugeStops.length - 1);
          const labelStyle = i === 0
            ? { left: 0, textAlign: 'left' }
            : i === gaugeStops.length - 1
              ? { right: 0, textAlign: 'right' }
              : { left: f * gaugeW - gz(20) };
          return (
            <View key={v}>
              <View style={[styles.gaugeTick, { top: gz(4), height: gz(10), left: Math.min(f * gaugeW - 0.5, gaugeW - 1) }]} />
              <Text style={[styles.gaugeTickLabel, { fontSize: gf(8), top: gz(16), width: gz(40) }, labelStyle]}>{v}</Text>
            </View>
          );
        })}
        <View style={[styles.gaugeFill, { top: gz(7), height: gz(4), borderRadius: gz(2), width: zoomFrac * gaugeW }]} />
        <View style={[styles.gaugeKnob, { top: gz(2), width: gz(14), height: gz(14), borderRadius: gz(7), left: Math.min(Math.max(0, zoomFrac * gaugeW - gz(7)), gaugeW - gz(14)) }]} />
        <GestureDetector gesture={zoomGesture}>
          <View style={styles.scrollGaugeTouch} />
        </GestureDetector>
      </View>
      )}

      {searchOpen && (
        <View style={[styles.searchPanel, { left: 10 + sidePad, right: 10 + sidePad }]}>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, { fontSize: sf(13), paddingHorizontal: sz(8), paddingVertical: sz(6), borderRadius: sz(6) }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="사건·인물·기간 검색"
              placeholderTextColor="#a08c72"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => searchResults[0] && jumpToItem(searchResults[0])}
            />
            <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(''); }} hitSlop={8} style={styles.searchClose}>
              <Text style={[styles.searchCloseText, { fontSize: sf(14) }]}>✕</Text>
            </Pressable>
          </View>
          {searchResults.length > 0 && (
            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.map((item) => (
                <Pressable key={`s${item.id}`} onPress={() => jumpToItem(item)} style={styles.searchItem}>
                  <Text style={[styles.searchItemText, { fontSize: sf(13) }]}>{item.event}</Text>
                  <Text style={[styles.searchItemMeta, { fontSize: sf(11) }]}>
                    {item.category} · {formatYear(item.year)}{item.endYear !== undefined ? ` ~ ${formatYear(item.endYear)}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {searchQuery.trim() !== '' && searchResults.length === 0 && (
            <Text style={[styles.searchEmpty, { fontSize: sf(12) }]}>검색 결과가 없어요</Text>
          )}
        </View>
      )}

      {sizeReady && (
      <View style={[styles.scrollGauge, { width: scrollGaugeW, height: gz(34), left: gaugeInset }]}>
        <View style={[styles.gaugeTrack, { top: gz(7), height: gz(4), borderRadius: gz(2) }]} />
        {SCROLL_TICKS.map((tick) => {
          const x = tick.f * scrollGaugeW;
          const labelStyle = tick.f === 0
            ? { left: 0, textAlign: 'left' }
            : tick.f === 1
              ? { right: 0, textAlign: 'right' }
              : { left: x - gz(20) };
          return (
            <View key={tick.f}>
              <View style={[styles.gaugeTick, { top: gz(4), height: gz(10), left: Math.min(x - 0.5, scrollGaugeW - 1) }]} />
              <Text style={[styles.gaugeTickLabel, { fontSize: gf(8), top: gz(16), width: gz(40) }, labelStyle]}>{tick.label}</Text>
            </View>
          );
        })}
        <View style={[styles.gaugeKnob, { top: gz(2), width: gz(14), height: gz(14), borderRadius: gz(7), left: Math.min(Math.max(0, scrollFrac * scrollGaugeW - gz(7)), scrollGaugeW - gz(14)) }]} />
        <GestureDetector gesture={scrollGesture}>
          <View style={styles.scrollGaugeTouch} />
        </GestureDetector>
      </View>
      )}
      </View>

      {wideLayout || tScale > 1 ? (
        <View style={[styles.legendContent, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 10 + sidePad, gap: gz(6), paddingVertical: gz(6) }]}>
          {catChips}
        </View>
      ) : (
        <View style={[styles.filterBar, { paddingRight: 10 + sidePad }]}>
          {filterOpen && (
            <View style={styles.filterPopover}>
              <View style={styles.filterHeader}>
                <Text style={[styles.filterTitle, { fontSize: gf(12) }]}>카테고리 필터</Text>
                <Pressable onPress={() => setFilterOpen(false)} hitSlop={8}>
                  <Text style={[styles.searchCloseText, { fontSize: gf(14) }]}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.filterChips}>{catChips}</View>
            </View>
          )}
          <Pressable onPress={() => setFilterOpen((v) => !v)} style={({ pressed }) => [styles.filterButton, { minWidth: gz(36), minHeight: gz(36), padding: gz(6), borderRadius: gz(10) }, pressed && styles.chipHidden]} hitSlop={8}>
            <Svg width={gz(20)} height={gz(20)} viewBox="0 0 24 24" fill="none" stroke="#6b5a44" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
            </Svg>
            {hiddenCats.size > 0 && (
              <View style={[styles.filterBadge, { minWidth: gz(16), height: gz(16), borderRadius: gz(8), top: -gz(5), right: -gz(5) }]}>
                <Text style={[styles.filterBadgeText, { fontSize: gf(9) }]}>{hiddenCats.size}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}
      <View style={{ height: Math.max(insets.bottom, 4) + (Platform.OS === 'web' ? 52 : 0) }} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  // 웹에서 ImageBackground가 에셋 고유 크기로만 그려지는 문제 방지 — 배경 이미지를 부모 크기로 채운다
  bgFill: { width: '100%', height: '100%' },
  timeline: { flex: 1, overflow: 'hidden' },
  axis: { position: 'absolute', left: AXIS_MARGIN, right: AXIS_MARGIN, height: 1.5, backgroundColor: '#7a5c3a' },
  tick: { position: 'absolute', width: 80, alignItems: 'center' },
  tickLine: { width: 1, height: 6, backgroundColor: '#7a5c3a' },
  tickLabel: { fontSize: 9, color: '#7a5c3a', marginTop: 1, fontFamily: 'NotoSansKR', includeFontPadding: false, textAlign: 'center' },
  rangeLabel: { position: 'absolute', fontSize: 9, fontWeight: '700', color: '#7a5c3a', fontFamily: 'NotoSansKR', includeFontPadding: false },
  eventMark: { position: 'absolute', height: EVENT_ROW_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' },
  eventText: { fontSize: FONT_SIZE, fontWeight: '600', fontFamily: 'NotoSansKR', includeFontPadding: false },
  eventBox: { marginLeft: 0, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: '#f6f1e6' },
  eventStem: { position: 'absolute', left: 0, top: 0, width: 1.5 },
  periodBar: { position: 'absolute', height: PERIOD_BAR_HEIGHT, borderRadius: 4, overflow: 'hidden', opacity: 0.9 },
  periodBarFill: { flex: 1, justifyContent: 'center' },
  periodText: { fontSize: 9, color: '#fff', fontFamily: 'NotoSansKR', includeFontPadding: false, alignSelf: 'flex-start', textShadowColor: 'rgba(0,0,0,1)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3 },
  timelineWrap: { flex: 1 },
  spanBadgeWrap: { position: 'absolute', top: 4, left: 0, right: 0, alignItems: 'center' },
  spanBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f6f1e6', borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, opacity: 0.95 },
  spanBadgeText: { fontSize: 11, fontWeight: '600', color: '#6b5a44', fontFamily: 'NotoSansKR', includeFontPadding: false },
  spanArrowText: { fontSize: 13, fontWeight: '700', color: '#a08c72', fontFamily: 'NotoSansKR', includeFontPadding: false },
  zoomGauge: { position: 'absolute', right: 10, bottom: 8, width: GAUGE_WIDTH, height: 34 },
  scrollGauge: { position: 'absolute', left: 10, bottom: 8, width: SCROLL_GAUGE_WIDTH, height: 34 },
  scrollGaugeTouch: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  gaugeTrack: { position: 'absolute', left: 0, right: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: '#d8cdb8' },
  gaugeFill: { position: 'absolute', left: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: '#7a5c3a' },
  gaugeTick: { position: 'absolute', top: 4, width: 1, height: 10, backgroundColor: '#b3a68e' },
  gaugeTickLabel: { position: 'absolute', top: 16, width: 40, textAlign: 'center', fontSize: 8, color: '#a08c72', fontFamily: 'NotoSansKR', includeFontPadding: false },
  gaugeKnob: { position: 'absolute', top: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#7a5c3a', borderWidth: 1.5, borderColor: '#f6f1e6' },
  detailPanel: { position: 'absolute', left: AXIS_MARGIN + 6, right: AXIS_MARGIN + 6, backgroundColor: '#f6f1e6', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 8, padding: 10, paddingRight: 34 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#4a6fa5', textDecorationLine: 'underline', fontFamily: 'NotoSansKR', includeFontPadding: false },
  detailMeta: { fontSize: 11, color: '#6b5a44', marginTop: 3, fontFamily: 'NotoSansKR', includeFontPadding: false },
  detailMemo: { fontSize: 10, color: '#8a7a60', marginTop: 4, fontFamily: 'NotoSansKR', includeFontPadding: false },
  detailClose: { position: 'absolute', top: 6, right: 8, padding: 4 },
  detailCloseText: { fontSize: 14, color: '#8a7558', fontWeight: '700' },
  searchPanel: { position: 'absolute', top: 4, left: 10, right: 10, backgroundColor: '#f6f1e6', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 8, padding: 8, zIndex: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, backgroundColor: '#fff', color: '#4a3b28', fontFamily: 'NotoSansKR', includeFontPadding: false },
  searchClose: { padding: 4 },
  searchCloseText: { fontSize: 14, color: '#8a7558', fontWeight: '700' },
  searchResults: { maxHeight: 220, marginTop: 6 },
  searchItem: { paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#e8e0d0' },
  searchItemText: { fontSize: 13, fontWeight: '600', color: '#4a3b28', fontFamily: 'NotoSansKR', includeFontPadding: false },
  searchItemMeta: { fontSize: 11, color: '#8a7558', marginTop: 1, fontFamily: 'NotoSansKR', includeFontPadding: false },
  searchEmpty: { fontSize: 12, color: '#8a7558', padding: 8, fontFamily: 'NotoSansKR', includeFontPadding: false },
  legend: { flexGrow: 0 },
  legendContent: { alignItems: 'center', paddingHorizontal: 10, gap: 6, paddingVertical: 6 },
  filterBar: { alignItems: 'flex-end', paddingVertical: 6, paddingHorizontal: 10 },
  filterButton: { padding: 6, borderRadius: 10, backgroundColor: '#f0ebe0', borderWidth: 1.5, borderColor: '#d8cdb8', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#7a5c3a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', fontFamily: 'NotoSansKR', includeFontPadding: false },
  filterPopover: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#f6f1e6', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 8, padding: 8, zIndex: 10, shadowColor: '#3a2e1f', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  filterTitle: { fontSize: 12, fontWeight: '700', color: '#6b5a44', fontFamily: 'NotoSansKR', includeFontPadding: false },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f0ebe0', borderWidth: 1, borderColor: '#d8cdb8' },
  chipHidden: { opacity: 0.4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  chipText: { fontSize: 11, color: '#5a4a36', fontFamily: 'NotoSansKR', includeFontPadding: false },
  chipTextHidden: { textDecorationLine: 'line-through' },

});
