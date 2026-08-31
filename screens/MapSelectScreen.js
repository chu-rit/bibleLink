import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ImageBackground, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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

export default function MapSelectScreen({ maps, progressByMap, onSelect, onWordSearch, onResetProgress, onCompleteMap, masterMode }) {
  const [hideSolved, setHideSolved] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const toggleAnim = useRef(new Animated.Value(hideSolved ? 1 : 0)).current;
  const { width: windowWidth } = useWindowDimensions();
  const isSmallScreen = true;
  const isWeb = Platform.OS === 'web';
  const effectiveWidth = isWeb ? Math.min(windowWidth || 375, 480) : (windowWidth || 375);
  const masterTileWidth = Math.floor(effectiveWidth / 5) - 12;
  const adRef = useRef(null);

  const toggleHideSolved = () => {
    setHideSolved((v) => {
      const next = !v;
      Animated.timing(toggleAnim, {
        toValue: next ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
      return next;
    });
  };

  useEffect(() => {
    if (!isWeb || !adRef.current) return;
    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', 'DAN-kILk8DoW0wkoyavP');
    ins.setAttribute('data-ad-width', '320');
    ins.setAttribute('data-ad-height', '50');
    adRef.current.appendChild(ins);
    if (!document.querySelector('script[src*="ba.min.js"]')) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
    return () => {
      if (adRef.current && adRef.current.contains(ins)) {
        adRef.current.removeChild(ins);
      }
    };
  }, [isWeb]);

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
    const tileStyle = columns === 1
      ? { width: masterTileWidth, marginRight: 8 }
      : { flexBasis: `${100 / columns}%` };
    return (
      <Pressable
        key={map.id}
        onPress={() => onSelect(map)}
        onLongPress={masterMode && onCompleteMap ? () => onCompleteMap(map.id) : undefined}
        style={[styles.tile, tileStyle, isComplete && styles.tileComplete]}
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
    const revealedMaps = masterMode ? sectionMaps : sectionMaps.slice(0, revealCount);
    const columns = 5;
    if (masterMode) {
      return (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{solvedCount}/{sectionMaps.length}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.masterScroll}>
            <View style={styles.masterTileRow}>
              {revealedMaps.map((map) => {
                if (hideSolved && getPercent(map) === 100) return null;
                return renderTile(map, 1);
              })}
            </View>
          </ScrollView>
        </View>
      );
    }
    return (
      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          </View>
          <View style={[styles.sectionBadge, { backgroundColor: accent + '1a' }]}>
            <Text style={[styles.sectionBadgeText, { color: accent }]}>{solvedCount}/{sectionMaps.length}</Text>
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
    <ImageBackground
      source={BG_IMAGE}
      resizeMode="cover"
      style={[styles.safeArea, Platform.OS === 'web' && styles.webSafeArea]}
    >
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, isSmallScreen && styles.headerSmall]}>
        <Image source={LOGO_IMAGE} style={[styles.brandLogo, isSmallScreen && styles.brandLogoSmall]} resizeMode="contain" />
        <Pressable onPress={() => setShowSettings(true)} style={styles.settingsButton}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              fill="none" stroke="#7a6450" strokeWidth="2"
            />
            <Path
              d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              fill="none" stroke="#7a6450" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
        <Pressable
          onPress={toggleHideSolved}
          accessibilityRole="switch"
          accessibilityState={{ checked: hideSolved }}
        >
          <Animated.View style={[styles.toggleSwitch, { borderColor: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: ['#c8b898', '#7a5c3a'] }) }]}>
            <Animated.View
              style={[
                styles.toggleThumb,
                {
                  backgroundColor: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: ['#c8b898', '#7a5c3a'] }),
                  transform: [{
                    translateX: toggleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 20],
                    }),
                  }],
                },
              ]}
            />
          </Animated.View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollViewContent, isSmallScreen && styles.scrollViewContentSmall]}
      >
        {renderSection('EASY', '기초 성경 단어', easyMaps, '#3c9a72')}
        {normalMaps.length > 0 && renderSection('NORMAL', '중급 성경 단어', normalMaps, '#e08a3c')}
        {hardMaps.length > 0 && renderSection('HARD', '고급 성경 단어', hardMaps, '#d64545')}
      </ScrollView>

      {isWeb && <View ref={adRef} style={styles.adContainer} />}

      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSettings(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>설정</Text>
            <Pressable
              style={styles.resetButton}
              onPress={() => {
                if (onResetProgress) onResetProgress(!hideSolved);
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, minHeight: '100%' },
  webSafeArea: { height: '100vh', width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  headerSmall: { paddingHorizontal: 14, paddingTop: 14, marginBottom: 10 },
  brandLogo: { width: 180, height: 40 },
  brandLogoSmall: { width: 140, height: 32 },
  settingsButton: { padding: 6, borderRadius: 10, backgroundColor: '#f0ebe0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  toggleLabel: { color: '#7a6450', fontSize: 12, fontWeight: '700', marginRight: 8 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#c8b898', justifyContent: 'center', padding: 2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#c8b898' },
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
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 },
  masterScroll: { marginBottom: 12 },
  masterTileRow: { flexDirection: 'row' },
  tile: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  tileComplete: { backgroundColor: '#ece8dc', borderRadius: 16 },
  gauge: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  gaugeSvg: { position: 'absolute' },
  gaugeInner: { alignItems: 'center', justifyContent: 'center' },
  gaugeNumber: { color: '#2e2418', fontSize: 18, fontWeight: '800' },
  gaugePercent: { color: '#8a7560', fontSize: 9, fontWeight: '700', marginTop: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fdfbf6', borderRadius: 20, padding: 24, width: '80%', maxWidth: 320, alignItems: 'stretch' },
  modalTitle: { color: '#2e2418', fontSize: 20, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  resetButton: { backgroundColor: '#d64545', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  resetButtonText: { color: '#fdfbf6', fontSize: 15, fontWeight: '800' },
  closeButton: { backgroundColor: '#f0ebe0', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { color: '#7a6450', fontSize: 15, fontWeight: '800' },
  adContainer: { alignItems: 'center', height: 50, marginTop: 4, marginBottom: 12 },
});
