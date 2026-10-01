import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { CATEGORIES, ITEMS, MAX_T, MIN_T, categoryColor, formatYear, minLevelForSpan, serialToMonth, serialToYear } from '../utils/chronology';

const BG_IMAGE = require('../assets/BG.png');

const AXIS_MARGIN = 8;
const GAUGE_WIDTH = 200;
const GAUGE_RESERVE = 30;
// 게이지 각 25% 지점에 해당하는 표시 연수
const GAUGE_STOPS = [1000, 500, 50, 5, 1];
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

const fitAll = (width) => clampView({ start: MIN_T - 30, pxPerYear: width / (MAX_T - MIN_T + 60) }, width);

export default function ChronologyScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  // 회전 잠금 토글: 잠금 해제(기울임으로 자유 회전) ↔ 현재 방향으로 잠금
  const [rotationUnlocked, setRotationUnlocked] = useState(false);
  const toggleOrientationLock = async () => {
    try {
      const { Orientation, OrientationLock } = ScreenOrientation;
      if (rotationUnlocked) {
        const orientation = await ScreenOrientation.getOrientationAsync();
        const lock = orientation === Orientation.LANDSCAPE_LEFT ? OrientationLock.LANDSCAPE_LEFT
          : orientation === Orientation.LANDSCAPE_RIGHT ? OrientationLock.LANDSCAPE_RIGHT
          : OrientationLock.PORTRAIT_UP;
        await ScreenOrientation.lockAsync(lock);
      } else {
        // unlockAsync(DEFAULT) 대신 ALL을 사용: 명시적으로 전 방향 마스크를 걸어 자동회전을 재개한다
        await ScreenOrientation.lockAsync(OrientationLock.ALL);
      }
      setRotationUnlocked(!rotationUnlocked);
    } catch {}
  };
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState(null);
  const [hiddenCats, setHiddenCats] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const viewRef = useRef(null);
  const baseRef = useRef(null);
  const containerRef = useRef(null);

  const width = size.width;
  const height = size.height;
  const activeView = view || (width ? fitAll(width) : { start: MIN_T, pxPerYear: 0.1 });
  viewRef.current = activeView;

  const zoomBy = (factor, focalX) => {
    if (!width) return;
    setView((v) => {
      const cur = v || fitAll(width);
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

  const formatDate = (item) => {
    const fmt = (y, m, d) => `${formatYear(y)}${m ? ` ${m}월` : ''}${d ? ` ${d}일` : ''}`;
    const from = fmt(item.year, item.month, item.day);
    return item.endYear !== undefined ? `${from} ~ ${fmt(item.endYear, item.endMonth, item.endDay)}` : from;
  };

  const span = width / activeView.pxPerYear;
  const minLevel = minLevelForSpan(span);
  const viewEnd = activeView.start + span;

  // 줌 게이지: 1000→500→50→5→1년 구간을 로그 보간으로 연결
  const spanToFrac = (s) => {
    if (s >= GAUGE_STOPS[0]) return 0;
    for (let i = 0; i < GAUGE_STOPS.length - 1; i++) {
      const hi = GAUGE_STOPS[i];
      const lo = GAUGE_STOPS[i + 1];
      if (s >= lo) return (i + 1 - Math.log(s / lo) / Math.log(hi / lo)) / (GAUGE_STOPS.length - 1);
    }
    return 1;
  };
  const zoomFrac = spanToFrac(span);
  // 게이지는 눈금 구역 탭으로 조절
  const applyGauge = (i) => {
    if (!width) return;
    const target = width / GAUGE_STOPS[i];
    zoomBy(target / activeView.pxPerYear, 0);
  };
  const axisY = Math.round(height * 0.5);
  const maxEventLanes = Math.min(10, Math.max(2, Math.floor((axisY - 8) / EVENT_ROW_HEIGHT)));
  const maxPeriodLanes = Math.min(10, Math.max(1, Math.floor((height - axisY - AXIS_LABEL_HEIGHT - 8 - GAUGE_RESERVE) / PERIOD_LANE_HEIGHT)));

  const { eventMarks, periodBars, ticks, rangeLabels } = useMemo(() => {
    if (!width || !height) return { eventMarks: [], periodBars: [], ticks: [], rangeLabels: null };
    const { start, pxPerYear } = activeView;

    // 사건 라벨: 축 위, 세로 막대 우측에 텍스트. level 우선순위대로 빈 레인 자리를 채우고
    // 모든 레인이 찼을 때만 숨김. 박스는 불투명 배경으로 줄기 위에 표시됨
    const candidates = ITEMS.filter((item) =>
      item.endT === null
      && item.t >= start - 4
      && item.t <= viewEnd
      && (item.level ?? 3) >= minLevel
      && !hiddenCats.has(item.category)
    ).sort((a, b) => (b.level ?? 3) - (a.level ?? 3) || a.t - b.t);
    const rangeLabels = { left: formatYear(serialToYear(start)), right: formatYear(serialToYear(viewEnd)) };
    // 축 양 끝의 범위 라벨 자리를 레인 0에 미리 점유
    const laneSpans = [[
      [0, AXIS_MARGIN + textWidth(rangeLabels.left) + 2],
      [width - AXIS_MARGIN - textWidth(rangeLabels.right) - 2, width],
    ]];
    const eventMarks = [];
    for (const item of candidates) {
      const x = (item.t - start) * pxPerYear;
      const l = x;
      const r = x + 1.5 + textWidth(item.event) + 4;
      if (l < AXIS_MARGIN || r > width - AXIS_MARGIN) continue;
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
      && (item.level ?? 3) >= minLevel
      && !hiddenCats.has(item.category)
    ).sort((a, b) => (b.level ?? 3) - (a.level ?? 3) || a.t - b.t);
    for (const item of periodCandidates) {
      const x0 = (item.t - start) * pxPerYear;
      const x = Math.max(x0, AXIS_MARGIN);
      const w = Math.min(x0 + Math.max(4, (item.endT - item.t) * pxPerYear), width - AXIS_MARGIN) - x;
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

    // 눈금
    const step = TICK_STEPS.find((s) => s * pxPerYear >= 78) || 2500;
    const ticks = [];
    for (let t = Math.ceil(start / step) * step; t <= viewEnd; t += step) {
      ticks.push({ t, x: (t - start) * pxPerYear });
    }
    return { eventMarks, periodBars, ticks, rangeLabels };
  }, [activeView, width, height, minLevel, viewEnd, hiddenCats, maxEventLanes, maxPeriodLanes]);

  const toggleCategory = (cat) => {
    setHiddenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <ImageBackground source={BG_IMAGE} resizeMode="cover" style={[styles.screen, { paddingTop: insets.top }]}>
      <AppHeader onBack={onBack} onRotate={toggleOrientationLock} rotateUnlocked={rotationUnlocked} />
      <View style={styles.timelineWrap}>
      <GestureDetector gesture={composed}>
        <View
          ref={containerRef}
          style={styles.timeline}
          onLayout={(e) => setSize(e.nativeEvent.layout)}
        >
          {eventMarks.map(({ item, x, lane }) => (
            <Pressable
              key={`e${item.id}`}
              onPress={() => setSelected({ item, area: 'event' })}
              style={[styles.eventMark, { left: x, top: axisY - (lane + 1) * EVENT_ROW_HEIGHT }]}
            >
              <View style={[styles.eventStem, { height: (lane + 1) * EVENT_ROW_HEIGHT, backgroundColor: categoryColor(item.category) }]} />
              <View style={[styles.eventBox, { borderColor: categoryColor(item.category) }]}>
                <Text numberOfLines={1} style={[styles.eventText, { color: categoryColor(item.category) }]}>
                  {item.event}
                </Text>
              </View>
            </Pressable>
          ))}

          <View style={[styles.axis, { top: axisY }]} />

          {rangeLabels && (
            <>
              <Text style={[styles.rangeLabel, { top: axisY - 15, left: AXIS_MARGIN }]}>{rangeLabels.left}</Text>
              <Text style={[styles.rangeLabel, { top: axisY - 15, right: AXIS_MARGIN }]}>{rangeLabels.right}</Text>
            </>
          )}

          {ticks.map(({ t, x }) => {
            const isMonthTick = t % 1 !== 0;
            const year = serialToYear(t);
            const label = isMonthTick ? `${serialToMonth(t)}월` : (year < 0 ? `BC ${-year}` : `${year}`);
            return (
              <View key={`t${t.toFixed(3)}`} style={[styles.tick, { left: x, top: axisY }]}>
                <View style={styles.tickLine} />
                <Text style={styles.tickLabel}>{label}</Text>
              </View>
            );
          })}

          {periodBars.map(({ item, x, w, lane }) => (
            <Pressable
              key={`p${item.id}`}
              onPress={() => setSelected({ item, area: 'period' })}
              style={[styles.periodBar, { left: x, top: axisY + AXIS_LABEL_HEIGHT + 4 + lane * PERIOD_LANE_HEIGHT, width: w, backgroundColor: categoryColor(item.category) }]}
            >
              <Text numberOfLines={1} style={styles.periodText}>{item.event}</Text>
            </Pressable>
          ))}

        </View>
      </GestureDetector>
      {selected && (
        <View style={[styles.detailPanel, selected.area === 'event' ? { top: axisY + AXIS_LABEL_HEIGHT + 4 } : { bottom: height - axisY + 4 }]}>
          <Pressable style={styles.detailClose} onPress={() => setSelected(null)}>
            <Text style={styles.detailCloseText}>✕</Text>
          </Pressable>
          <Pressable onPress={() => openSource(selected.item)}>
            <Text style={styles.detailTitle}>{selected.item.event}({selected.item.category})</Text>
          </Pressable>
          <Text style={styles.detailMeta}>{formatDate(selected.item)}</Text>
        </View>
      )}

      <View style={styles.zoomGauge}>
        <View style={styles.gaugeTrack} />
        {GAUGE_STOPS.map((v, i) => {
          const f = i / (GAUGE_STOPS.length - 1);
          const labelStyle = i === 0
            ? { left: 0, textAlign: 'left' }
            : i === GAUGE_STOPS.length - 1
              ? { right: 0, textAlign: 'right' }
              : { left: f * GAUGE_WIDTH - 20 };
          return (
            <View key={v}>
              <View style={[styles.gaugeTick, { left: Math.min(f * GAUGE_WIDTH - 0.5, GAUGE_WIDTH - 1) }]} />
              <Text style={[styles.gaugeTickLabel, labelStyle]}>{v}</Text>
            </View>
          );
        })}
        <View style={[styles.gaugeFill, { width: zoomFrac * GAUGE_WIDTH }]} />
        <View style={[styles.gaugeKnob, { left: Math.min(Math.max(0, zoomFrac * GAUGE_WIDTH - 7), GAUGE_WIDTH - 14) }]} />
        {GAUGE_STOPS.map((v, i) => {
          const prev = i === 0 ? 0 : (i - 0.5) / (GAUGE_STOPS.length - 1);
          const next = i === GAUGE_STOPS.length - 1 ? 1 : (i + 0.5) / (GAUGE_STOPS.length - 1);
          return (
            <Pressable
              key={`z${v}`}
              onPress={() => applyGauge(i)}
              style={[styles.gaugeZone, { left: prev * GAUGE_WIDTH, width: (next - prev) * GAUGE_WIDTH }]}
            />
          );
        })}
      </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legend}
        contentContainerStyle={styles.legendContent}
      >
        {CATEGORIES.map((cat) => {
          const hidden = hiddenCats.has(cat);
          return (
            <Pressable key={cat} onPress={() => toggleCategory(cat)} style={[styles.chip, hidden && styles.chipHidden]}>
              <View style={[styles.dot, { backgroundColor: categoryColor(cat) }]} />
              <Text style={[styles.chipText, hidden && styles.chipTextHidden]}>{cat}</Text>
            </Pressable>
          );
        })}
        <Text style={styles.hint}>항목을 누르면 상세 정보가 열려요</Text>
      </ScrollView>
      <View style={{ height: Math.max(insets.bottom, 4) + (Platform.OS === 'web' ? 52 : 0) }} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  timeline: { flex: 1, overflow: 'hidden' },
  axis: { position: 'absolute', left: AXIS_MARGIN, right: AXIS_MARGIN, height: 1.5, backgroundColor: '#7a5c3a' },
  tick: { position: 'absolute', alignItems: 'center' },
  tickLine: { width: 1, height: 6, backgroundColor: '#7a5c3a' },
  tickLabel: { fontSize: 9, color: '#7a5c3a', marginTop: 1, fontFamily: 'NotoSansKR' },
  rangeLabel: { position: 'absolute', fontSize: 9, fontWeight: '700', color: '#7a5c3a', fontFamily: 'NotoSansKR' },
  eventMark: { position: 'absolute', height: EVENT_ROW_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' },
  eventText: { fontSize: FONT_SIZE, fontWeight: '600', fontFamily: 'NotoSansKR' },
  eventBox: { marginLeft: 0, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: '#f6f1e6' },
  eventStem: { position: 'absolute', left: 0, top: 0, width: 1.5 },
  periodBar: { position: 'absolute', height: PERIOD_BAR_HEIGHT, borderRadius: 4, justifyContent: 'center', paddingHorizontal: 4, overflow: 'hidden', opacity: 0.9 },
  periodText: { fontSize: 9, color: '#fff', fontFamily: 'NotoSansKR' },
  timelineWrap: { flex: 1 },
  zoomGauge: { position: 'absolute', right: 10, bottom: 8, width: GAUGE_WIDTH, height: 34 },
  gaugeTrack: { position: 'absolute', left: 0, right: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: '#d8cdb8' },
  gaugeFill: { position: 'absolute', left: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: '#7a5c3a' },
  gaugeTick: { position: 'absolute', top: 4, width: 1, height: 10, backgroundColor: '#b3a68e' },
  gaugeZone: { position: 'absolute', top: 0, height: 34 },
  gaugeTickLabel: { position: 'absolute', top: 16, width: 40, textAlign: 'center', fontSize: 8, color: '#a08c72', fontFamily: 'NotoSansKR' },
  gaugeKnob: { position: 'absolute', top: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#7a5c3a', borderWidth: 1.5, borderColor: '#f6f1e6' },
  detailPanel: { position: 'absolute', left: AXIS_MARGIN + 6, right: AXIS_MARGIN + 6, backgroundColor: '#f6f1e6', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 8, padding: 10, paddingRight: 34 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#4a6fa5', textDecorationLine: 'underline', fontFamily: 'NotoSansKR' },
  detailMeta: { fontSize: 11, color: '#6b5a44', marginTop: 3, fontFamily: 'NotoSansKR' },
  detailClose: { position: 'absolute', top: 6, right: 8, padding: 4 },
  detailCloseText: { fontSize: 14, color: '#8a7558', fontWeight: '700' },
  legend: { flexGrow: 0 },
  legendContent: { alignItems: 'center', paddingHorizontal: 10, gap: 6, paddingVertical: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f0ebe0', borderWidth: 1, borderColor: '#d8cdb8' },
  chipHidden: { opacity: 0.4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  chipText: { fontSize: 11, color: '#5a4a36', fontFamily: 'NotoSansKR' },
  chipTextHidden: { textDecorationLine: 'line-through' },
  hint: { fontSize: 10, color: '#a08c72', marginLeft: 8, fontFamily: 'NotoSansKR' },
});
