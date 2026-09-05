import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const normalize = (value) => value.replace(/\s/g, '').trim();

export default function WordSearchScreen({ maps, words, onBack }) {
  const bibleWords = words || [];
  const crosswordMaps = maps || [];

  const usageCount = useMemo(() => {
    const counts = new Map();
    crosswordMaps.forEach((map) => {
      map.cells.forEach((cell) => {
        counts.set(cell.wordId, (counts.get(cell.wordId) || 0) + 1);
      });
    });
    return counts;
  }, [crosswordMaps]);

  const getUsage = (id) => usageCount.get(id) || 0;
  const getMapTitles = useCallback((wordId) => crosswordMaps
    .filter((map) => map.cells.some((cell) => cell.wordId === wordId))
    .map((map) => map.title), [crosswordMaps]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const body = document.body;
    const root = document.getElementById('root');
    const previous = {
      bodyPosition: body.style.position,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      rootHeight: root?.style.height || '',
      rootOverflow: root?.style.overflow || '',
    };
    body.style.position = 'static';
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    if (root) {
      root.style.height = 'auto';
      root.style.overflow = 'visible';
    }

    return () => {
      body.style.position = previous.bodyPosition;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
      if (root) {
        root.style.height = previous.rootHeight;
        root.style.overflow = previous.rootOverflow;
      }
    };
  }, []);

  const results = useMemo(() => {
    const raw = normalize(query);
    const xMatch = raw.match(/^(x+)(.*)$/i);
    const isExclusion = Boolean(xMatch);
    const excludeIndex = xMatch ? xMatch[1].length - 1 : -1;
    const keyword = xMatch ? xMatch[2] : raw;
    const list = bibleWords
      .map((item) => ({ ...item, usage: getUsage(item.id), mapTitles: getMapTitles(item.id) }))
      .filter((item) => {
        if (!keyword && !isExclusion) return true;
        if (isExclusion) {
          if (!keyword) return true;
          const word = normalize(item.word);
          if (!word.includes(keyword)) return false;
          if (word.startsWith(keyword, excludeIndex)) return false;
          return true;
        }
        return normalize(item.word).includes(keyword);
      })
      .sort((a, b) => {
        if (b.usage !== a.usage) return b.usage - a.usage;
        return a.word.localeCompare(b.word, 'ko');
      });
    return list;
  }, [query, bibleWords, crosswordMaps, getMapTitles]);

  const PAGE_SIZE = 100;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  const visibleResults = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount]
  );

  const handleScroll = useCallback(({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distanceFromBottom < 200 && visibleCount < results.length) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, results.length));
    }
  }, [visibleCount, results.length]);

  const totalUsed = useMemo(
    () => bibleWords.filter((item) => getUsage(item.id) > 0).length,
    [bibleWords, usageCount]
  );

  const diffStats = useMemo(() => {
    const stats = { 1: { total: 0, used: 0 }, 2: { total: 0, used: 0 }, 3: { total: 0, used: 0 } };
    bibleWords.forEach((item) => {
      const d = item.difficulty;
      if (!stats[d]) return;
      stats[d].total++;
      if (getUsage(item.id) > 0) stats[d].used++;
    });
    return stats;
  }, [bibleWords, usageCount]);

  const renderItem = ({ item }) => (
    <View style={[styles.wordCard, item.usage > 0 && styles.usedWordCard]}>
      <View style={styles.wordCopy}>
        <View style={styles.wordHeader}>
          <Text style={styles.wordText}>{item.word}</Text>
          {item.usage > 0 && (
            <View style={styles.usageBadge}>
              <Text style={styles.usageBadgeText}>사용 {item.usage}회</Text>
            </View>
          )}
        </View>
        <Text style={styles.definition} numberOfLines={2}>{item.definition}</Text>
        <View style={styles.mapUsageRow}>
          <Text style={styles.mapUsageLabel}>등장 맵</Text>
          <Text style={styles.mapUsageText} numberOfLines={2}>
            {item.mapTitles.length > 0 ? item.mapTitles.join(' · ') : '아직 맵에 사용되지 않음'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>난이도 {item.difficulty}</Text>
          {item.references?.length > 0 && (
            <Text style={styles.metaText} numberOfLines={1}> · {item.references.join(', ')}</Text>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, Platform.OS === 'web' && styles.webSafeArea]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>맵 선택</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>단어 찾기</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>사용 {totalUsed}/{bibleWords.length}</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="단어에 포함된 글자 입력 · x글자: 해당 위치 제외"
            placeholderTextColor="#a89880"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>지우기</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.resultCount}>검색 결과 {results.length}개</Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {visibleResults.map((item) => (
            <View key={item.id}>{renderItem({ item })}</View>
          ))}
          {visibleCount < results.length && (
            <Text style={styles.loadingMore}>더 불러오는 중...</Text>
          )}
        </ScrollView>

        <View style={styles.statsPanel}>
          {[
            { label: 'EASY', d: 1, color: '#3c9a72' },
            { label: 'NORMAL', d: 2, color: '#e08a3c' },
            { label: 'HARD', d: 3, color: '#d64545' },
          ].map(({ label, d, color }) => {
            const s = diffStats[d];
            const percent = s.total ? Math.round((s.used / s.total) * 100) : 0;
            return (
              <View key={d} style={styles.statRow}>
                <View style={[styles.statDot, { backgroundColor: color }]} />
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{s.used}/{s.total}</Text>
                <Text style={styles.statPercent}>{percent}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0ebe0' },
  webSafeArea: { height: '100vh', width: '100%', maxWidth: 480, alignSelf: 'center' },
  container: { flex: 1, padding: 16 },
  backButton: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#e0d8c8' },
  backButtonText: { color: '#7a6450', fontSize: 12, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { flex: 1, color: '#2e2418', fontSize: 18, fontWeight: '800', marginHorizontal: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e0d8c8' },
  badgeText: { color: '#7a5c3a', fontSize: 12, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e0d8c8', marginBottom: 10 },
  searchInput: { flex: 1, height: 44, color: '#3a2e1f', fontSize: 15 },
  clearButton: { paddingHorizontal: 8, paddingVertical: 6 },
  clearButtonText: { color: '#8a7560', fontSize: 12, fontWeight: '700' },
  resultCount: { color: '#8a7560', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  list: { flex: 1, minHeight: 0, overflow: 'scroll' },
  listContent: { paddingBottom: 24 },
  wordCard: { borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e0d8c8' },
  usedWordCard: { borderColor: '#7a5c3a', borderWidth: 1.5, backgroundColor: 'transparent' },
  wordCopy: { flex: 1 },
  wordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  wordText: { color: '#2e2418', fontSize: 17, fontWeight: '800' },
  usageBadge: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#7a5c3a', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  usageBadgeText: { color: '#7a5c3a', fontSize: 11, fontWeight: '800' },
  definition: { color: '#5a4a35', fontSize: 13, lineHeight: 19 },
  mapUsageRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  mapUsageLabel: { color: '#7a6450', fontSize: 11, fontWeight: '800', marginRight: 8 },
  mapUsageText: { flex: 1, color: '#8a7560', fontSize: 11, lineHeight: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  metaText: { color: '#a89880', fontSize: 11, fontWeight: '600' },
  loadingMore: { color: '#a89880', fontSize: 12, fontWeight: '700', textAlign: 'center', paddingVertical: 16 },
  statsPanel: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e0d8c8', marginTop: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statLabel: { color: '#2e2418', fontSize: 12, fontWeight: '800', width: 60 },
  statValue: { color: '#5a4a35', fontSize: 12, fontWeight: '700', flex: 1 },
  statPercent: { color: '#7a6450', fontSize: 12, fontWeight: '800' },
});
