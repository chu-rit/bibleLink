import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function MapSelectScreen({ maps, onSelect }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>BIBLE LINK</Text>
          <Text style={styles.title}>맵 선택</Text>
          <Text style={styles.description}>풀고 싶은 퍼즐판을 선택해 보세요.</Text>
        </View>

        {maps.map((map) => (
          <Pressable key={map.id} onPress={() => onSelect(map)} style={styles.mapCard}>
            <View style={styles.mapCopy}>
              <Text style={styles.mapTitle}>{map.title}</Text>
              <Text style={styles.mapMeta}>
                {map.width}x{map.height} 퍼즐판 · 단어 {map.cells.length}개
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>난이도 {map.difficulty}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f8fb' },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  eyebrow: { color: '#53708d', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#172536', fontSize: 28, fontWeight: '800', marginTop: 4 },
  description: { color: '#647487', fontSize: 13, lineHeight: 19, marginTop: 8 },
  mapCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#e7edf2', shadowColor: '#17324d', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  mapCopy: { flex: 1, paddingRight: 12 },
  mapTitle: { color: '#26384b', fontSize: 17, fontWeight: '800' },
  mapMeta: { color: '#647487', fontSize: 13, marginTop: 6 },
  badge: { backgroundColor: '#e2edf6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#315d7f', fontSize: 12, fontWeight: '700' },
});
