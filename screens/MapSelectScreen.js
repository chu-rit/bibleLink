import React, { useEffect, useRef, useState } from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import AppHeader from '../components/AppHeader';
import MapSettingsScreen from './MapSettingsScreen';
import { scaleFont, useContentMaxWidth, useUiScale } from '../utils/responsive';

const COLUMNS = 4;
const RADIUS = 28;
const STROKE = 5;
const SIZE = (RADIUS + STROKE) * 2;

const BG_IMAGE = require('../assets/BG.png');

function Gauge({ percent, number, isComplete, scale = 1 }) {
  const color = '#7a5c3a';
  const radius = RADIUS * scale;
  const stroke = STROKE * scale;
  const size = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <View style={[styles.gauge, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.gaugeSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e0d8c8"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={styles.gaugeInner}>
        <Text style={[styles.gaugeNumber, { fontSize: scaleFont(18, scale) }]}>{number}</Text>
        <Text style={[styles.gaugePercent, { fontSize: scaleFont(9, scale) }]}>{percent}%</Text>
      </View>
    </View>
  );
}

export default function MapSelectScreen({ maps, progressByMap, onSelect, onWordSearch, onResetProgress, onCompleteMap, onResetMap, masterMode, onBack }) {
  const [showSettings, setShowSettings] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const uiScale = useUiScale();
  const contentMaxWidth = useContentMaxWidth();
  const effectiveWidth = Math.min(windowWidth || 375, contentMaxWidth);
  const masterTileWidth = Math.floor(effectiveWidth / 5) - 12;
  const gridPadding = Math.round(28 * uiScale);

  const msInstanceIdRef = useRef(null);
  if (msInstanceIdRef.current === null) {
    msInstanceIdRef.current = Math.random().toString(36).slice(2, 8);
  }
  useEffect(() => {
    return () => {};
  }, []);

  const easyMaps = maps.filter((m) => m.title?.startsWith('E-'));
  const normalMaps = maps.filter((m) => m.title?.startsWith('N-'));
  const hardMaps = maps.filter((m) => m.title?.startsWith('H-'));

  const mapNumber = (map) => {
    const match = /^([A-Z])-(\d+)$/.exec(map.title || '');
    return match ? match[2] : '';
  };

  const renderTile = (map, columns, isDimmed) => {
    const progress = progressByMap?.[map.id] || { filled: 0, total: map.cells.length };
    const percent = progress.total ? Math.round((progress.filled / progress.total) * 100) : 0;
    const isComplete = percent === 100;
    const tileStyle = columns === 1
      ? { width: masterTileWidth, marginRight: 8 }
      : { width: Math.floor((effectiveWidth - gridPadding) / columns), maxWidth: Math.floor((effectiveWidth - gridPadding) / columns) };
    return (
      <Pressable
        key={map.id}
        onPress={() => onSelect(map)}
        onLongPress={masterMode && onCompleteMap
          ? () => onCompleteMap(map.id)
          : !masterMode && isComplete && onResetMap
            ? () => {
              const reset = () => onResetMap(map.id);
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                if (window.confirm('클리어 데이터를 지우고 다시하시겠습니까?')) reset();
              } else {
                Alert.alert(
                  '맵 초기화',
                  '클리어 데이터를 지우고 다시하시겠습니까?',
                  [
                    { text: '취소', style: 'cancel' },
                    { text: '확인', onPress: reset },
                  ]
                );
              }
            }
            : undefined}
        style={[styles.tile, tileStyle, isDimmed && styles.tileDimmed]}
      >
        <Gauge percent={percent} number={mapNumber(map)} isComplete={isComplete} scale={uiScale} />
      </Pressable>
    );
  };

  const getPercent = (map) => {
    const progress = progressByMap?.[map.id] || { filled: 0, total: map.cells.length };
    return progress.total ? Math.round((progress.filled / progress.total) * 100) : 0;
  };

  const renderSection = (eyebrow, title, sectionMaps, accent) => {
    const solvedCount = sectionMaps.filter((map) => getPercent(map) === 100).length;
    const dimmedIds = new Set();
    // 넓은 화면에서는 열 수를 늘려 타일이 지나치게 커지지 않게 한다
    const columns = 5;
    return (
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <View style={styles.sectionEyebrowRow}>
              <Text style={[styles.sectionEyebrow, { fontSize: scaleFont(16, uiScale) }]}>{eyebrow}</Text>
            </View>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={[styles.sectionBadgeText, { fontSize: scaleFont(11, uiScale) }]}>{solvedCount}/{sectionMaps.length}</Text>
          </View>
        </View>
        <View style={styles.tileGrid}>
          {sectionMaps.map((map) => renderTile(map, columns, dimmedIds.has(map.id)))}
        </View>
      </View>
    );
  };

  return (
    <ImageBackground
      source={BG_IMAGE}
      resizeMode="cover"
      imageStyle={styles.bgFill}
      style={[styles.safeArea, { paddingTop: insets.top }]}
    >
      <StatusBar barStyle="dark-content" />
      <AppHeader onBack={onBack} onSettings={() => setShowSettings(true)} />
      <View style={styles.headerSpacer} />

      {onWordSearch && (
        <Pressable onPress={onWordSearch} style={[styles.searchEntry, styles.searchEntrySmall, { alignSelf: 'center', width: Math.max(200, Math.min(windowWidth || 375, contentMaxWidth) - 28) }]}>
          <View style={styles.searchEntryCopy}>
            <Text style={[styles.searchEntryTitle, { fontSize: scaleFont(17, uiScale) }]}>단어 찾기</Text>
            <Text style={[styles.searchEntryMeta, { fontSize: scaleFont(12, uiScale) }]}>글자로 단어를 검색하고 사용 이력을 확인하세요</Text>
          </View>
          <Text style={[styles.searchEntryArrow, { fontSize: scaleFont(24, uiScale) }]}>›</Text>
        </Pressable>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollViewContent, styles.scrollViewContentSmall, { alignSelf: 'center', width: Math.min(windowWidth || 375, contentMaxWidth) }]}
      >
        {renderSection('EASY', '기초 성경 단어', easyMaps, '#3c9a72')}
        {normalMaps.length > 0 && renderSection('NORMAL', '중급 성경 단어', normalMaps, '#e08a3c')}
        {hardMaps.length > 0 && renderSection('HARD', '고급 성경 단어', hardMaps, '#d64545')}
      </ScrollView>

      <MapSettingsScreen
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onResetProgress={onResetProgress}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, minHeight: '100%' },
  // 웹에서 ImageBackground가 에셋 고유 크기로만 그려지는 문제 방지 — 배경 이미지를 부모 크기로 채운다
  bgFill: { width: '100%', height: '100%' },
  headerSpacer: { height: 16 },
  searchEntry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#7a5c3a', borderRadius: 18, padding: 18, marginHorizontal: 20, marginBottom: 16 },
  searchEntrySmall: { padding: 14, marginHorizontal: 14, marginBottom: 10, borderRadius: 14 },
  searchEntryCopy: { flex: 1, paddingRight: 12 },
  searchEntryTitle: { color: '#7a5c3a', fontSize: 17, fontWeight: '800' },
  searchEntryMeta: { color: '#7a6450', fontSize: 12, marginTop: 6, lineHeight: 17 },
  searchEntryArrow: { color: '#7a5c3a', fontSize: 24, fontWeight: '800' },
  scrollView: { flex: 1 },
  scrollViewContent: { paddingHorizontal: 20, paddingBottom: 40 },
  scrollViewContentSmall: { paddingHorizontal: 14, paddingBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, marginTop: 8, paddingHorizontal: 4 },
  sectionCopy: { flex: 1, alignItems: 'flex-start' },
  sectionEyebrow: { fontSize: 16, fontWeight: '800', letterSpacing: 2, textAlign: 'left', color: '#7a6450' },
  sectionEyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { color: '#2e2418', fontSize: 20, fontWeight: '800', marginTop: 2, textAlign: 'left' },
  sectionBadge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: '#7a6450' },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', textAlign: 'right', color: '#7a6450' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', paddingBottom: 8 },
  masterScroll: { marginBottom: 12 },
  masterTileRow: { flexDirection: 'row' },
  tile: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  tileDimmed: { opacity: 0.35 },
  gauge: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  gaugeSvg: { position: 'absolute' },
  gaugeInner: { alignItems: 'center', justifyContent: 'center' },
  gaugeNumber: { color: '#2e2418', fontSize: 18, fontWeight: '800' },
  gaugePercent: { color: '#8a7560', fontSize: 9, fontWeight: '700', marginTop: 1 },
});
