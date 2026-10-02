import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { lockOrientation } from '../utils/orientation';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { CATEGORIES, ITEMS, MAX_T, MIN_T, categoryColor, formatYear, minLevelForSpan, serialToMonth, serialToYear } from '../utils/chronology';

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
    .onStart((e) => applyScrollFrac(e.x / SCROLL_GAUGE_WIDTH))
    .onUpdate((e) => applyScrollFrac(e.x / SCROLL_GAUGE_WIDTH)), [width]);
  const scrollTap = useMemo(() => Gesture.Tap().runOnJS(true)
    .onEnd((e) => applyScrollFrac(e.x / SCROLL_GAUGE_WIDTH)), [width]);
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

  const formatDate = (item) => {
    const fmt = (y, m, d) => `${formatYear(y)}${m ? ` ${m}월` : ''}${d ? ` ${d}일` : ''}`;
    const from = fmt(item.year, item.month, item.day);
    return item.endYear !== undefined ? `${from} ~ ${fmt(item.endYear, item.endMonth, item.endDay)}` : from;
  };

  const span = width / activeView.pxPerYear;
  const minLevel = minLevelForSpan(span);
  const viewEnd = activeView.start + span;
  const scrollRange = Math.max(MAX_T + 100 - span - (MIN_T - 100), 0.001);
  const scrollFrac = Math.min(Math.max((activeView.start - (MIN_T - 100)) / scrollRange, 0), 1);

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
  const fracToSpan = (f) => {
    const pos = Math.min(Math.max(f, 0), 1) * (GAUGE_STOPS.length - 1);
    const i = Math.min(Math.floor(pos), GAUGE_STOPS.length - 2);
    return GAUGE_STOPS[i + 1] * Math.pow(GAUGE_STOPS[i] / GAUGE_STOPS[i + 1], i + 1 - pos);
  };
  const zoomFrac = spanToFrac(span);
  // 게이지 탭: 눈금 구역으로 스냅
  const applyGauge = (i) => {
    const v = viewRef.current;
    if (!width || !v) return;
    zoomBy(width / GAUGE_STOPS[i] / v.pxPerYear, 0);
  };
  // 게이지 드래그: 구간 사이도 연속으로, 시작 연도(좌측 끝) 기준 확대
  const applyGaugeSpan = (s) => {
    const v = viewRef.current;
    if (!width || !v) return;
    setView(clampView({ start: v.start, pxPerYear: width / s }, width));
  };
  const zoomGaugePan = useMemo(() => Gesture.Pan().runOnJS(true)
    .onStart((e) => applyGaugeSpan(fracToSpan(e.x / GAUGE_WIDTH)))
    .onUpdate((e) => applyGaugeSpan(fracToSpan(e.x / GAUGE_WIDTH))), [width]);
  const zoomGaugeTap = useMemo(() => Gesture.Tap().runOnJS(true)
    .onEnd((e) => applyGauge(Math.round(Math.min(Math.max(e.x / GAUGE_WIDTH, 0), 1) * (GAUGE_STOPS.length - 1)))), [width]);
  const zoomGesture = useMemo(() => Gesture.Exclusive(zoomGaugePan, zoomGaugeTap), [zoomGaugePan, zoomGaugeTap]);
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

  const wideLayout = width > height;
  const catChips = CATEGORIES.map((cat) => {
    const hidden = hiddenCats.has(cat);
    return (
      <Pressable key={cat} onPress={() => toggleCategory(cat)} style={[styles.chip, hidden && styles.chipHidden]}>
        <View style={[styles.dot, { backgroundColor: categoryColor(cat) }]} />
        <Text style={[styles.chipText, hidden && styles.chipTextHidden]}>{cat}</Text>
      </Pressable>
    );
  });

  return (
    <ImageBackground source={BG_IMAGE} resizeMode="cover" style={[styles.screen, { paddingTop: insets.top }]}>
      <AppHeader onBack={onBack} onRotate={toggleOrientation} onSearch={() => setSearchOpen(true)} />
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
        <GestureDetector gesture={zoomGesture}>
          <View style={styles.scrollGaugeTouch} />
        </GestureDetector>
      </View>

      {searchOpen && (
        <View style={styles.searchPanel}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="사건·인물·기간 검색"
              placeholderTextColor="#a08c72"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => searchResults[0] && jumpToItem(searchResults[0])}
            />
            <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(''); }} hitSlop={8} style={styles.searchClose}>
              <Text style={styles.searchCloseText}>✕</Text>
            </Pressable>
          </View>
          {searchResults.length > 0 && (
            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.map((item) => (
                <Pressable key={`s${item.id}`} onPress={() => jumpToItem(item)} style={styles.searchItem}>
                  <Text style={styles.searchItemText}>{item.event}</Text>
                  <Text style={styles.searchItemMeta}>
                    {item.category} · {formatYear(item.year)}{item.endYear !== undefined ? ` ~ ${formatYear(item.endYear)}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {searchQuery.trim() !== '' && searchResults.length === 0 && (
            <Text style={styles.searchEmpty}>검색 결과가 없어요</Text>
          )}
        </View>
      )}

      <View style={styles.scrollGauge}>
        <View style={styles.gaugeTrack} />
        {SCROLL_TICKS.map((tick) => {
          const x = tick.f * SCROLL_GAUGE_WIDTH;
          const labelStyle = tick.f === 0
            ? { left: 0, textAlign: 'left' }
            : tick.f === 1
              ? { right: 0, textAlign: 'right' }
              : { left: x - 20 };
          return (
            <View key={tick.f}>
              <View style={[styles.gaugeTick, { left: Math.min(x - 0.5, SCROLL_GAUGE_WIDTH - 1) }]} />
              <Text style={[styles.gaugeTickLabel, labelStyle]}>{tick.label}</Text>
            </View>
          );
        })}
        <View style={[styles.gaugeKnob, { left: Math.min(Math.max(0, scrollFrac * SCROLL_GAUGE_WIDTH - 7), SCROLL_GAUGE_WIDTH - 14) }]} />
        <GestureDetector gesture={scrollGesture}>
          <View style={styles.scrollGaugeTouch} />
        </GestureDetector>
      </View>
      </View>

      {wideLayout ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legend}
          contentContainerStyle={styles.legendContent}
        >
          {catChips}
        </ScrollView>
      ) : (
        <View style={styles.filterBar}>
          {filterOpen && (
            <View style={styles.filterPopover}>
              <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>카테고리 필터</Text>
                <Pressable onPress={() => setFilterOpen(false)} hitSlop={8}>
                  <Text style={styles.searchCloseText}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.filterChips}>{catChips}</View>
            </View>
          )}
          <Pressable onPress={() => setFilterOpen((v) => !v)} style={({ pressed }) => [styles.filterButton, pressed && styles.chipHidden]} hitSlop={8}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b5a44" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
            </Svg>
            {hiddenCats.size > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{hiddenCats.size}</Text>
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
  scrollGauge: { position: 'absolute', left: 10, bottom: 8, width: SCROLL_GAUGE_WIDTH, height: 34 },
  scrollGaugeTouch: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  gaugeTrack: { position: 'absolute', left: 0, right: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: '#d8cdb8' },
  gaugeFill: { position: 'absolute', left: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: '#7a5c3a' },
  gaugeTick: { position: 'absolute', top: 4, width: 1, height: 10, backgroundColor: '#b3a68e' },
  gaugeTickLabel: { position: 'absolute', top: 16, width: 40, textAlign: 'center', fontSize: 8, color: '#a08c72', fontFamily: 'NotoSansKR' },
  gaugeKnob: { position: 'absolute', top: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#7a5c3a', borderWidth: 1.5, borderColor: '#f6f1e6' },
  detailPanel: { position: 'absolute', left: AXIS_MARGIN + 6, right: AXIS_MARGIN + 6, backgroundColor: '#f6f1e6', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 8, padding: 10, paddingRight: 34 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#4a6fa5', textDecorationLine: 'underline', fontFamily: 'NotoSansKR' },
  detailMeta: { fontSize: 11, color: '#6b5a44', marginTop: 3, fontFamily: 'NotoSansKR' },
  detailClose: { position: 'absolute', top: 6, right: 8, padding: 4 },
  detailCloseText: { fontSize: 14, color: '#8a7558', fontWeight: '700' },
  searchPanel: { position: 'absolute', top: 4, left: 10, right: 10, backgroundColor: '#f6f1e6', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 8, padding: 8, zIndex: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, backgroundColor: '#fff', color: '#4a3b28', fontFamily: 'NotoSansKR' },
  searchClose: { padding: 4 },
  searchCloseText: { fontSize: 14, color: '#8a7558', fontWeight: '700' },
  searchResults: { maxHeight: 220, marginTop: 6 },
  searchItem: { paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#e8e0d0' },
  searchItemText: { fontSize: 13, fontWeight: '600', color: '#4a3b28', fontFamily: 'NotoSansKR' },
  searchItemMeta: { fontSize: 11, color: '#8a7558', marginTop: 1, fontFamily: 'NotoSansKR' },
  searchEmpty: { fontSize: 12, color: '#8a7558', padding: 8, fontFamily: 'NotoSansKR' },
  legend: { flexGrow: 0 },
  legendContent: { alignItems: 'center', paddingHorizontal: 10, gap: 6, paddingVertical: 6 },
  filterBar: { alignItems: 'flex-end', paddingVertical: 6, paddingHorizontal: 10 },
  filterButton: { padding: 6, borderRadius: 10, backgroundColor: '#f0ebe0', borderWidth: 1.5, borderColor: '#d8cdb8', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#7a5c3a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', fontFamily: 'NotoSansKR' },
  filterPopover: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#f6f1e6', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 8, padding: 8, zIndex: 10, shadowColor: '#3a2e1f', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  filterTitle: { fontSize: 12, fontWeight: '700', color: '#6b5a44', fontFamily: 'NotoSansKR' },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f0ebe0', borderWidth: 1, borderColor: '#d8cdb8' },
  chipHidden: { opacity: 0.4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  chipText: { fontSize: 11, color: '#5a4a36', fontFamily: 'NotoSansKR' },
  chipTextHidden: { textDecorationLine: 'line-through' },

});
