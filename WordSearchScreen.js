import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import bibleWords from './data/bibleWordsLib1.json';
import crosswordMaps from './data/crosswordMaps';

const normalize = (value) => value.replace(/\s/g, '').trim();

const usageCount = (() => {
  const counts = new Map();
  crosswordMaps.forEach((map) => {
    map.cells.forEach((cell) => {
      counts.set(cell.wordId, (counts.get(cell.wordId) || 0) + 1);
    });
  });
  return counts;
})();

const getUsage = (id) => usageCount.get(id) || 0;

export default function WordSearchScreen({ onBack }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const keyword = normalize(query);
    const list = bibleWords
      .map((item) => ({ ...item, usage: getUsage(item.id) }))
      .filter((item) => {
        if (!keyword) return true;
        return normalize(item.word).includes(keyword);
      })
      .sort((a, b) => {
        if (b.usage !== a.usage) return b.usage - a.usage;
        return a.word.localeCompare(b.word, 'ko');
      });
    return list;
  }, [query]);

  const totalUsed = useMemo(
    () => bibleWords.filter((item) => getUsage(item.id) > 0).length,
    []
  );

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
    <SafeAreaView style={styles.safeArea}>
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
            placeholder="단어에 포함된 글자를 입력하세요"
            placeholderTextColor="#9aa3ad"
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

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f8fb' },
  container: { flex: 1, padding: 16 },
  backButton: { backgroundColor: '#e9f0f6', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  backButtonText: { color: '#5d89a7', fontSize: 12, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { flex: 1, color: '#172536', fontSize: 18, fontWeight: '800', marginHorizontal: 10 },
  badge: { backgroundColor: '#e2edf6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#315d7f', fontSize: 12, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e7edf2', marginBottom: 10 },
  searchInput: { flex: 1, height: 44, color: '#20384d', fontSize: 15, backgroundColor: '#fbfdff' },
  clearButton: { paddingHorizontal: 8, paddingVertical: 6 },
  clearButtonText: { color: '#6b7c8d', fontSize: 12, fontWeight: '700' },
  resultCount: { color: '#647487', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  listContent: { paddingBottom: 24 },
  wordCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e7edf2' },
  usedWordCard: { borderColor: '#c9dcec', backgroundColor: '#f3f8fc' },
  wordCopy: { flex: 1 },
  wordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  wordText: { color: '#172536', fontSize: 17, fontWeight: '800' },
  usageBadge: { backgroundColor: '#315d7f', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  usageBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  definition: { color: '#34485d', fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  metaText: { color: '#8a99a8', fontSize: 11, fontWeight: '600' },
});
