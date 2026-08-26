import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const COLUMNS = 5;
const RADIUS = 26;
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

export default function MapSelectScreen({ maps, progressByMap, onSelect, onWordSearch }) {
  const easyMaps = maps.filter((m) => m.difficulty <= 1.8);
  const normalMaps = maps.filter((m) => m.difficulty > 1.8 && m.difficulty < 2.6);
  const hardMaps = maps.filter((m) => m.difficulty >= 2.6);
  const easyStartIndex = 0;
  const normalStartIndex = easyMaps.length;
  const hardStartIndex = easyMaps.length + normalMaps.length;

  const renderTile = (map, number) => {
    const progress = progressByMap?.[map.id] || { filled: 0, total: map.cells.length };
    const percent = progress.total ? Math.round((progress.filled / progress.total) * 100) : 0;
    const isComplete = percent === 100;
    return (
      <Pressable
        key={map.id}
        onPress={() => onSelect(map)}
        style={[styles.tile, isComplete && styles.tileComplete]}
      >
        <Gauge percent={percent} number={number} isComplete={isComplete} />
      </Pressable>
    );
  };

  const renderSection = (eyebrow, title, sectionMaps, startIndex, accent) => (
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
        {sectionMaps.map((map, index) => renderTile(map, startIndex + index + 1))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.container, styles.containerGrow]}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>BIBLE LINK</Text>
          <Text style={styles.title}>맵 선택</Text>
          <Text style={styles.description}>풀고 싶은 퍼즐판을 선택해 보세요.</Text>
        </View>

        {onWordSearch && (
          <Pressable onPress={onWordSearch} style={styles.searchEntry}>
            <View style={styles.searchEntryCopy}>
              <Text style={styles.searchEntryTitle}>단어 찾기</Text>
              <Text style={styles.searchEntryMeta}>글자로 단어를 검색하고 사용 이력을 확인하세요</Text>
            </View>
            <Text style={styles.searchEntryArrow}>›</Text>
          </Pressable>
        )}

        {renderSection('EASY', '기초 성경 단어', easyMaps, easyStartIndex, '#3c9a72')}
        {normalMaps.length > 0 && renderSection('NORMAL', '중급 성경 단어', normalMaps, normalStartIndex, '#e08a3c')}
        {hardMaps.length > 0 && renderSection('HARD', '고급 성경 단어', hardMaps, hardStartIndex, '#d64545')}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, minHeight: '100%', backgroundColor: '#f6f8fb' },
  scrollView: { flex: 1, backgroundColor: '#f6f8fb' },
  container: { padding: 20, paddingBottom: 40, backgroundColor: '#f6f8fb' },
  containerGrow: { flexGrow: 1 },
  header: { marginBottom: 20 },
  eyebrow: { color: '#53708d', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#172536', fontSize: 28, fontWeight: '800', marginTop: 4 },
  description: { color: '#647487', fontSize: 13, lineHeight: 19, marginTop: 8 },
  searchEntry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#315d7f', borderRadius: 18, padding: 18, marginBottom: 16 },
  searchEntryCopy: { flex: 1, paddingRight: 12 },
  searchEntryTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  searchEntryMeta: { color: '#cfe0ee', fontSize: 12, marginTop: 6, lineHeight: 17 },
  searchEntryArrow: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, marginTop: 8, paddingHorizontal: 4 },
  sectionCopy: { flex: 1, alignItems: 'flex-start' },
  sectionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textAlign: 'left' },
  sectionTitle: { color: '#172536', fontSize: 20, fontWeight: '800', marginTop: 2, textAlign: 'left' },
  sectionBadge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', textAlign: 'right' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 },
  tile: { flexBasis: '20%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  tileComplete: { backgroundColor: '#e7f6ee', borderRadius: 16 },
  gauge: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  gaugeSvg: { position: 'absolute' },
  gaugeInner: { alignItems: 'center', justifyContent: 'center' },
  gaugeNumber: { color: '#172536', fontSize: 18, fontWeight: '800' },
  gaugePercent: { color: '#647487', fontSize: 9, fontWeight: '700', marginTop: 1 },
});
