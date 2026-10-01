import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { CATEGORIES, ITEMS, MAX_T, MIN_T, categoryColor, formatYear, minLevelForSpan, serialToMonth, serialToYear } from '../utils/chronology';

const BG_IMAGE = require('../assets/BG.png');

const EVENT_LANE_HEIGHT = 15;
const PERIOD_LANE_HEIGHT = 14;
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState(null);
  const [hiddenCats, setHiddenCats] = useState(() => new Set());
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

  const span = width / activeView.pxPerYear;
  const minLevel = minLevelForSpan(span);
  const viewEnd = activeView.start + span;
  const axisY = Math.round(height * 0.58);
  const maxEventLanes = Math.min(8, Math.max(2, Math.floor((axisY - 8) / EVENT_LANE_HEIGHT)));
  const maxPeriodLanes = Math.min(6, Math.max(2, Math.floor((height - axisY - AXIS_LABEL_HEIGHT - 8) / PERIOD_LANE_HEIGHT)));

  const { eventMarks, periodBars, ticks } = useMemo(() => {
    if (!width || !height) return { eventMarks: [], periodBars: [], ticks: [] };
    const { start, pxPerYear } = activeView;

    // 사건 라벨: 축 위. 밀집 구간에서 주요 사건이 우선 보이도록 level 내림차순으로 레인 배치
    const candidates = ITEMS.filter((item) =>
      item.endT === null
      && item.t >= start - 4
      && item.t <= viewEnd
      && (item.level ?? 3) >= minLevel
      && !hiddenCats.has(item.category)
    ).sort((a, b) => (b.level ?? 3) - (a.level ?? 3) || a.t - b.t);
    const laneRight = [];
    const eventMarks = [];
    for (const item of candidates) {
      const x = (item.t - start) * pxPerYear;
      const labelW = textWidth(item.event);
      // 화면 끝에 걸치는 라벨은 안쪽으로 밀고, 밀린 위치 기준으로도 겹치면 위 레인으로
      const labelX = Math.max(0, Math.min(x, width - 4 - labelW));
      let lane = laneRight.findIndex((r) => labelX > r + 12);
      if (lane === -1) {
        if (laneRight.length >= maxEventLanes) continue;
        lane = laneRight.length;
        laneRight.push(-Infinity);
      }
      laneRight[lane] = labelX + labelW;
      eventMarks.push({ item, x, labelX, lane });
    }
    // 아래 레인이 위 레인의 세로 줄기를 덮도록 레인 내림차순으로 렌더
    eventMarks.sort((a, b) => b.lane - a.lane);

    // 기간 막대: 축 아래, 동일하게 level 우선 레인 배치
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
      const x = (item.t - start) * pxPerYear;
      const w = Math.max(4, (item.endT - item.t) * pxPerYear);
      const labelW = w + 6 + textWidth(item.event);
      let lane = periodRight.findIndex((r) => x > r + 12);
      if (lane === -1) {
        if (periodRight.length >= maxPeriodLanes) continue;
        lane = periodRight.length;
        periodRight.push(-Infinity);
      }
      periodRight[lane] = x + Math.max(w, labelW);
      // 막대가 화면 밖에서 시작하거나 라벨이 끝에 걸치면 라벨만 안쪽으로 밂
      const textW = textWidth(item.event);
      const textShift = Math.max(-x, Math.min(0, width - 4 - (x + textW)));
      periodBars.push({ item, x, w, lane, textShift });
    }

    // 눈금
    const step = TICK_STEPS.find((s) => s * pxPerYear >= 78) || 2500;
    const ticks = [];
    for (let t = Math.ceil(start / step) * step; t <= viewEnd; t += step) {
      ticks.push({ t, x: (t - start) * pxPerYear });
    }
    return { eventMarks, periodBars, ticks };
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
      <AppHeader onBack={onBack} />
      <GestureDetector gesture={composed}>
        <View
          ref={containerRef}
          style={styles.timeline}
          onLayout={(e) => setSize(e.nativeEvent.layout)}
        >
          {eventMarks.map(({ item, x, labelX, lane }) => (
            <Pressable
              key={`e${item.id}`}
              onLongPress={() => openSource(item)}
              delayLongPress={400}
              style={[styles.eventMark, { left: labelX, top: axisY - 12 - (lane + 1) * EVENT_LANE_HEIGHT }]}
            >
              <View style={[styles.eventStem, { height: (lane + 1) * EVENT_LANE_HEIGHT - 3, top: FONT_SIZE + 3, left: x - labelX, backgroundColor: categoryColor(item.category) }]} />
              <Text numberOfLines={1} style={[styles.eventText, { color: categoryColor(item.category) }]}>
                {item.event}
              </Text>
            </Pressable>
          ))}

          <View style={[styles.axis, { top: axisY }]} />

          {ticks.map(({ t, x }) => {
            const isMonthTick = t % 1 !== 0;
            const year = serialToYear(t);
            const label = isMonthTick ? `${serialToMonth(t)}월` : formatYear(year);
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
              onLongPress={() => openSource(item)}
              delayLongPress={400}
              style={[styles.periodRow, { left: x, top: axisY + AXIS_LABEL_HEIGHT + 6 + lane * PERIOD_LANE_HEIGHT }]}
            >
              <View style={[styles.periodBar, { width: w, backgroundColor: categoryColor(item.category) }]} />
              <Text numberOfLines={1} style={[styles.periodText, { transform: [{ translateX: textShift }] }]}>{item.event}</Text>
            </Pressable>
          ))}

          <View style={styles.zoomControls} pointerEvents="box-none">
            <Pressable style={styles.zoomButton} onPress={() => zoomBy(1.6, width / 2)}>
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>
            <Pressable style={styles.zoomButton} onPress={() => zoomBy(1 / 1.6, width / 2)}>
              <Text style={styles.zoomButtonText}>−</Text>
            </Pressable>
            <Pressable style={styles.zoomButton} onPress={() => setView(fitAll(width))}>
              <Text style={styles.zoomButtonText}>전체</Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>

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
        <Text style={styles.hint}>항목을 길게 누르면 출처가 열려요</Text>
      </ScrollView>
      <View style={{ height: Math.max(insets.bottom, 4) + (Platform.OS === 'web' ? 52 : 0) }} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  timeline: { flex: 1, overflow: 'hidden' },
  axis: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: '#7a5c3a' },
  tick: { position: 'absolute', alignItems: 'center' },
  tickLine: { width: 1, height: 6, backgroundColor: '#7a5c3a' },
  tickLabel: { fontSize: 9, color: '#7a5c3a', marginTop: 1, fontFamily: 'NotoSansKR' },
  eventMark: { position: 'absolute' },
  eventText: { fontSize: FONT_SIZE, fontWeight: '600', fontFamily: 'NotoSansKR' },
  eventStem: { position: 'absolute', left: 0, width: 1.5 },
  periodRow: { position: 'absolute', flexDirection: 'column' },
  periodBar: { height: 6, borderRadius: 3, opacity: 0.85 },
  periodText: { fontSize: 9, color: '#6b5a44', marginTop: 1, fontFamily: 'NotoSansKR' },
  zoomControls: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 6 },
  zoomButton: { minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 8, backgroundColor: '#f0ebe0', borderWidth: 1.5, borderColor: '#d8cdb8', alignItems: 'center', justifyContent: 'center' },
  zoomButtonText: { fontSize: 14, color: '#7a5c3a', fontWeight: '700', fontFamily: 'NotoSansKR' },
  legend: { flexGrow: 0 },
  legendContent: { alignItems: 'center', paddingHorizontal: 10, gap: 6, paddingVertical: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f0ebe0', borderWidth: 1, borderColor: '#d8cdb8' },
  chipHidden: { opacity: 0.4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  chipText: { fontSize: 11, color: '#5a4a36', fontFamily: 'NotoSansKR' },
  chipTextHidden: { textDecorationLine: 'line-through' },
  hint: { fontSize: 10, color: '#a08c72', marginLeft: 8, fontFamily: 'NotoSansKR' },
});
