import React, { useEffect, useRef, useState } from 'react';
import { Alert, ImageBackground, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const COLUMNS = 4;
const RADIUS = 28;
const STROKE = 5;
const SIZE = (RADIUS + STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BG_IMAGE = require('../assets/BG.png');
const LOGO_IMAGE = require('../assets/LOGO.png');

function Gauge({ percent, number, isComplete }) {
  const color = '#7a5c3a';
  const offset = CIRCUMFERENCE * (1 - percent / 100);
  return (
    <View style={styles.gauge}>
      <Svg width={SIZE} height={SIZE} style={styles.gaugeSvg}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#e0d8c8"
          strokeWidth={STROKE}
          fill="#fdfbf6"
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

export default function MapSelectScreen({ maps, progressByMap, onSelect, onWordSearch, onResetProgress, onCompleteMap, onResetMap, masterMode }) {
  const [showSettings, setShowSettings] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isSmallScreen = true;
  const isWeb = Platform.OS === 'web';
  const effectiveWidth = isWeb ? Math.min(windowWidth || 375, 480) : (windowWidth || 375);
  const masterTileWidth = Math.floor(effectiveWidth / 5) - 12;
  const [viewportHeight, setViewportHeight] = useState(windowHeight);

  const msInstanceIdRef = useRef(null);
  if (msInstanceIdRef.current === null) {
    msInstanceIdRef.current = Math.random().toString(36).slice(2, 8);
  }
  useEffect(() => {
    return () => {};
  }, []);

  useEffect(() => {
    if (!isWeb) return undefined;
    const update = () => {
      const frameWidth = Math.min(window.innerWidth, 480);
      setViewportHeight(Math.min(window.innerHeight, Math.round(frameWidth * 20 / 9)));
    };
    update();
    window.addEventListener('resize', update);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update);
      window.visualViewport.addEventListener('scroll', update);
    }
    return () => {
      window.removeEventListener('resize', update);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update);
        window.visualViewport.removeEventListener('scroll', update);
      }
    };
  }, [isWeb]);

  const confirmResetProgress = () => {
    const reset = () => {
      if (onResetProgress) onResetProgress();
      setShowSettings(false);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('모든 진행 데이터를 초기화하시겠습니까?')) reset();
    } else {
      Alert.alert(
        '진행 데이터 초기화',
        '모든 퍼즐의 진행 데이터가 삭제됩니다. 계속하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '초기화', style: 'destructive', onPress: reset },
        ]
      );
    }
  };

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
      : { width: `${Math.floor(100 / columns)}%`, maxWidth: `${Math.floor(100 / columns)}%` };
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
        style={[styles.tile, tileStyle, isComplete && styles.tileComplete, isDimmed && styles.tileDimmed]}
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
    const dimmedIds = new Set();
    const columns = 5;
    return (
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{solvedCount}/{sectionMaps.length}</Text>
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
      style={[styles.safeArea, isWeb && { height: viewportHeight, width: '100%', maxWidth: 480, alignSelf: 'center' }]}
    >
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, isSmallScreen && styles.headerSmall]}>
        <Image source={LOGO_IMAGE} style={[styles.brandLogo, isSmallScreen && styles.brandLogoSmall]} resizeMode="contain" />
        <Pressable onPress={() => setShowSettings(true)} style={styles.settingsButton}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#7a6450" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
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
            <Text style={styles.modalEyebrow}>BIBLE LINK</Text>
            <Text style={styles.modalTitle}>설정</Text>
            <Text style={styles.modalDescription}>퍼즐 진행 상태를 관리할 수 있습니다</Text>
            <Pressable
              style={styles.resetButton}
              onPress={confirmResetProgress}
            >
              <Text style={styles.resetButtonText}>진행 데이터 초기화</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={() => setShowSettings(false)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, minHeight: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  headerSmall: { paddingHorizontal: 14, paddingTop: 14, marginBottom: 10 },
  brandLogo: { width: 180, height: 40 },
  brandLogoSmall: { width: 140, height: 32 },
  settingsButton: { padding: 6, borderRadius: 10, backgroundColor: '#f0ebe0' },
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
  sectionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textAlign: 'left', color: '#7a6450' },
  sectionTitle: { color: '#2e2418', fontSize: 20, fontWeight: '800', marginTop: 2, textAlign: 'left' },
  sectionBadge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e0d8c8' },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', textAlign: 'right', color: '#7a6450' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', paddingBottom: 8 },
  masterScroll: { marginBottom: 12 },
  masterTileRow: { flexDirection: 'row' },
  tile: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  tileComplete: { backgroundColor: '#ece8dc', borderRadius: 16 },
  tileDimmed: { opacity: 0.35 },
  gauge: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  gaugeSvg: { position: 'absolute' },
  gaugeInner: { alignItems: 'center', justifyContent: 'center' },
  gaugeNumber: { color: '#2e2418', fontSize: 18, fontWeight: '800' },
  gaugePercent: { color: '#8a7560', fontSize: 9, fontWeight: '700', marginTop: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(46,36,24,0.28)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fdfbf6', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, alignItems: 'stretch', borderWidth: 1, borderColor: '#e0d8c8', shadowColor: '#2e2418', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 8 },
  modalEyebrow: { color: '#a89880', fontSize: 10, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginBottom: 6 },
  modalTitle: { color: '#2e2418', fontSize: 22, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  modalDescription: { color: '#8a7560', fontSize: 12, textAlign: 'center', marginBottom: 22 },
  resetButton: { backgroundColor: '#fdfbf6', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1.5, borderColor: '#d64545' },
  resetButtonText: { color: '#c13d3d', fontSize: 14, fontWeight: '800' },
  closeButton: { backgroundColor: '#7a5c3a', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
});
