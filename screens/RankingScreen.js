import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const MEDAL_COLORS = ['#d8a326', '#9a9a9a', '#b87333'];

export default function RankingScreen({ visible, rankings, myRank, onClose }) {
  const showMyRank = myRank && myRank.rank > 10;

  const renderRow = (ranking, index, rank) => {
    const medalColor = MEDAL_COLORS[index];
    return (
      <View key={`${ranking.userId || ranking.nickname}-${rank}`} style={[styles.row, index < 3 && styles.topRow, ranking.isMine && styles.myRow]}>
        <View style={[styles.rankBadge, medalColor && { backgroundColor: medalColor }]}>
          <Text style={styles.rankNumber}>{rank}</Text>
        </View>
        <View style={styles.nameWrap}>
          <Text style={styles.name} numberOfLines={1}>{ranking.nickname}</Text>
          {rank === 1 && <Text style={styles.leader}>FIRST</Text>}
          {ranking.isMine && <Text style={styles.mine}>나</Text>}
        </View>
        {ranking.streak > 0 && <Text style={styles.streak}>연속 {ranking.streak}일</Text>}
        <Text style={styles.info}>{ranking.attempts}회</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>DAILY WORD</Text>
              <Text style={styles.title}>오늘의 랭킹</Text>
            </View>
            <Pressable style={styles.closeIconButton} onPress={onClose} hitSlop={8}>
              <Text style={styles.closeIconText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>정답을 먼저 맞힌 순서로 표시됩니다</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {rankings === null ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>불러오는 중...</Text>
              </View>
            ) : rankings.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>아직 기록이 없습니다</Text>
                <Text style={styles.emptyDescription}>첫 번째 정답 기록을 남겨보세요</Text>
              </View>
            ) : (
              rankings.map((ranking, index) => renderRow(ranking, index, index + 1))
            )}
          </ScrollView>

          {showMyRank && (
            <View style={styles.myRankSection}>
              <Text style={styles.myRankLabel}>내 순위</Text>
              {renderRow(myRank, 10, myRank.rank)}
            </View>
          )}

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(58,46,31,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, maxHeight: 480, backgroundColor: '#fdfbf6', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 24, padding: 20, shadowColor: '#3a2e1f', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eyebrow: { color: '#e08a3c', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#3a2e1f', fontSize: 22, fontWeight: '900', marginTop: 4 },
  closeIconButton: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: '#d8cdb8', backgroundColor: '#f0ebe0', alignItems: 'center', justifyContent: 'center' },
  closeIconText: { color: '#7a6450', fontSize: 22, lineHeight: 24, fontWeight: '500' },
  subtitle: { color: '#7a6450', fontSize: 12, marginTop: 8 },
  list: { marginTop: 14 },
  listContent: { paddingBottom: 2, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f7f2e8', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, gap: 10 },
  topRow: { backgroundColor: '#fff8ea', borderColor: '#e8c98c' },
  myRow: { backgroundColor: '#eef7f0', borderColor: '#3c9a72' },
  rankBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#7a5c3a', alignItems: 'center', justifyContent: 'center' },
  rankNumber: { color: '#fdfbf6', fontSize: 14, fontWeight: '900' },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: '#3a2e1f', fontSize: 15, fontWeight: '800' },
  leader: { color: '#d8a326', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  mine: { color: '#3c9a72', fontSize: 10, fontWeight: '900' },
  info: { color: '#7a6450', fontSize: 13, fontWeight: '800' },
  streak: { color: '#e08a3c', fontSize: 11, fontWeight: '800' },
  myRankSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0d8c8' },
  myRankLabel: { color: '#7a6450', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, paddingHorizontal: 16 },
  emptyTitle: { color: '#3a2e1f', fontSize: 16, fontWeight: '800' },
  emptyDescription: { color: '#7a6450', fontSize: 12, marginTop: 6, textAlign: 'center' },
  closeButton: { marginTop: 14, borderRadius: 12, paddingVertical: 11, backgroundColor: '#7a5c3a', alignItems: 'center' },
  closeButtonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
});
