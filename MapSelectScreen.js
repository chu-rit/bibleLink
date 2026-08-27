import React, { useState } from 'react';
import { Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const COLUMNS = 4;
const RADIUS = 28;
const STROKE = 5;
const SIZE = (RADIUS + STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Gauge({ percent, number, isComplete }) {
  const color = isComplete ? '#3c9a72' : '#4d8cba';
  const offset = CIRCUMFERENCE * (1 - percent / 100);
  return (
    <View style={styles.gauge}>
      <Svg width={SIZE} height={SIZE} style={styles.gaugeSvg}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#e9eef3"
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          originX={SIZE / 2}
          originY={SIZE / 2}
        />
      </Svg>
      <View style={styles.gaugeInner}>
        <Text style={styles.gaugeNumber}>{number}</Text>
        <Text style={styles.gaugePercent}>{percent}%</Text>
      </View>
    </View>
  );
}

export default function MapSelectScreen({ maps, progressByMap, onSelect, onWordSearch, onResetProgress }) {
  const [hideSolved, setHideSolved] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = (windowWidth || 375) < 480;
  const isWeb = Platform.OS === 'web';

  const easyMaps = maps.filter((m) => m.difficulty <= 1.8);
  const normalMaps = maps.filter((m) => m.difficulty > 1.8 && m.difficulty < 2.6);
  const hardMaps = maps.filter((m) => m.difficulty >= 2.6);

  const mapNumber = (map) => {
    const match = /^([A-Z])-(\d+)$/.exec(map.title || '');
    return match ? match[2] : '';
  };

  const renderTile = (map, columns) => {
    const progress = progressByMap?.[map.id] || { filled: 0, total: map.cells.length };
    const percent = progress.total ? Math.round((progress.filled / progress.total) * 100) : 0;
    const isComplete = percent === 100;
    return (
      <Pressable
        key={map.id}
        onPress={() => onSelect(map)}
        style={[styles.tile, { flexBasis: `${100 / columns}%` }, isComplete && styles.tileComplete]}
      >
        <Gauge percent={percent} number={mapNumber(map)} isComplete={isComplete} />
      </Pressable>
    );
  };

  const getPercent = (map) => {
    const progress = progressByMap?.[map.id] || { filled: 0, total: map.cells.length };
    return progress.total ? Math.round((progress.filled / progress.total) * 100) : 0;
  };

  const renderSection = (eyebrow, title, sectionMaps, accent) => {
    const solvedCount = sectionMaps.filter((map) => getPercent(map) === 100).length;
    const revealCount = Math.min(5 + solvedCount, sectionMaps.length);
    const revealedMaps = sectionMaps.slice(0, revealCount);
    const columns = isSmallScreen ? 4 : 5;
    return (
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionEyebrow, { color: accent }]}>{eyebrow}</Text>
          </View>
          <View style={[styles.sectionBadge, { backgroundColor: accent + '1a' }]}>
            <Text style={[styles.sectionBadgeText, { color: accent }]}>{sectionMaps.length}개 맵</Text>
          </View>
        </View>
        <View style={styles.tileGrid}>
          {revealedMaps.map((map) => {
            if (hideSolved && getPercent(map) === 100) return null;
            return renderTile(map, columns);
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, Platform.OS === 'web' && styles.webSafeArea]}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, isSmallScreen && styles.headerSmall]}>
        <Text style={[styles.brandTitle, isSmallScreen && styles.brandTitleSmall]}>BIBLE LINK</Text>
        <Pressable onPress={() => setShowSettings(true)} style={styles.settingsButton}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              fill="none" stroke="#53708d" strokeWidth="2"
            />
            <Path
              d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              fill="none" stroke="#53708d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      {onWordSearch && (
        <Pressable onPress={onWordSearch} style={[styles.searchEntry, isSmallScreen && styles.searchEntrySmall]}>
          <View style={styles.searchEntryCopy}>
            <Text style={styles.searchEntryTitle}>단어 찾기</Text>
            <Text style={styles.searchEntryMeta}>글자로 단어를 검색하고 사용 이력을 확인하세요</Text>
          </View>
          <Text style={styles.searchEntryArrow}>›</Text>
        </Pressable>
      )}

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>푼 퍼즐 가리기</Text>
        <Switch
          value={hideSolved}
          onValueChange={setHideSolved}
          trackColor={{ false: '#d4dde6', true: '#315d7f' }}
          thumbColor={hideSolved ? '#fff' : '#fff'}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollViewContent, isSmallScreen && styles.scrollViewContentSmall]}
      >
        {renderSection('EASY', '기초 성경 단어', easyMaps, '#3c9a72')}
        {normalMaps.length > 0 && renderSection('NORMAL', '중급 성경 단어', normalMaps, '#e08a3c')}
        {hardMaps.length > 0 && renderSection('HARD', '고급 성경 단어', hardMaps, '#d64545')}
      </ScrollView>

      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSettings(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>설정</Text>
            <Pressable
              style={styles.resetButton}
              onPress={() => {
                if (onResetProgress) onResetProgress();
                setShowSettings(false);
              }}
            >
              <Text style={styles.resetButtonText}>진행 데이터 초기화</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={() => setShowSettings(false)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, minHeight: '100%', backgroundColor: '#f6f8fb' },
  webSafeArea: { height: '100vh' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  headerSmall: { paddingHorizontal: 14, paddingTop: 14, marginBottom: 10 },
  brandTitle: { color: '#172536', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  brandTitleSmall: { fontSize: 22, letterSpacing: 0.5 },
  settingsButton: { padding: 6, borderRadius: 10, backgroundColor: '#e9f0f6' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  toggleLabel: { color: '#53708d', fontSize: 12, fontWeight: '700', marginRight: 8 },
  searchEntry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#315d7f', borderRadius: 18, padding: 18, marginHorizontal: 20, marginBottom: 16 },
  searchEntrySmall: { padding: 14, marginHorizontal: 14, marginBottom: 10, borderRadius: 14 },
  searchEntryCopy: { flex: 1, paddingRight: 12 },
  searchEntryTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  searchEntryMeta: { color: '#cfe0ee', fontSize: 12, marginTop: 6, lineHeight: 17 },
  searchEntryArrow: { color: '#fff', fontSize: 24, fontWeight: '800' },
  scrollView: { flex: 1, backgroundColor: '#f6f8fb' },
  scrollViewContent: { paddingHorizontal: 20, paddingBottom: 40 },
  scrollViewContentSmall: { paddingHorizontal: 14, paddingBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, marginTop: 8, paddingHorizontal: 4 },
  sectionCopy: { flex: 1, alignItems: 'flex-start' },
  sectionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textAlign: 'left' },
  sectionTitle: { color: '#172536', fontSize: 20, fontWeight: '800', marginTop: 2, textAlign: 'left' },
  sectionBadge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', textAlign: 'right' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 },
  tile: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  tileComplete: { backgroundColor: '#e7f6ee', borderRadius: 16 },
  gauge: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  gaugeSvg: { position: 'absolute' },
  gaugeInner: { alignItems: 'center', justifyContent: 'center' },
  gaugeNumber: { color: '#172536', fontSize: 18, fontWeight: '800' },
  gaugePercent: { color: '#647487', fontSize: 9, fontWeight: '700', marginTop: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '80%', maxWidth: 320, alignItems: 'stretch' },
  modalTitle: { color: '#172536', fontSize: 20, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  resetButton: { backgroundColor: '#d64545', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  resetButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  closeButton: { backgroundColor: '#e9f0f6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { color: '#53708d', fontSize: 15, fontWeight: '800' },
});
