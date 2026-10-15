import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { prevDateKey, todayKey } from '../utils/dailyWord';
import { scaleFont, useUiScale } from '../utils/responsive';

const MEDAL_COLORS = ['#d8a326', '#9a9a9a', '#b87333'];

export default function RankingScreen({ visible, rankings, myRank, dateKey, onSelectDate, onClose, eyebrow = 'DAILY WORD' }) {
  const uiScale = useUiScale();
  const sf = (n) => scaleFont(n, uiScale);
  const sz = (n) => Math.round(n * uiScale);
  const showMyRank = myRank && myRank.rank > 10;
  const today = todayKey();
  const yesterday = prevDateKey(today);
  const isToday = dateKey === today;
  const isYesterday = dateKey === yesterday;

  const renderRow = (ranking, index, rank) => {
    const medalColor = MEDAL_COLORS[index];
    return (
      <View key={`${ranking.userId || ranking.nickname}-${rank}`} style={[styles.row, index < 3 && styles.topRow, ranking.isMine && styles.myRow]}>
        <View style={[styles.rankBadge, { width: sz(34), height: sz(34), borderRadius: sz(17) }, medalColor && { backgroundColor: medalColor }]}>
          <Text style={[styles.rankNumber, { fontSize: sf(14) }]}>{rank}</Text>
        </View>
        <View style={styles.nameWrap}>
          <Text style={[styles.name, { fontSize: sf(15) }]} numberOfLines={1}>{ranking.nickname}</Text>
          {rank === 1 && <Text style={[styles.leader, { fontSize: sf(9) }]}>FIRST</Text>}
          {ranking.isMine && <Text style={[styles.mine, { fontSize: sf(10) }]}>나</Text>}
        </View>
        {ranking.streak > 0 && <Text style={[styles.streak, { fontSize: sf(11) }]}>연속 {ranking.streak}일</Text>}
        <Text style={[styles.info, { fontSize: sf(13) }]}>{ranking.attempts}회</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.eyebrow, { fontSize: sf(10) }]}>{eyebrow}</Text>
              <Text style={[styles.title, { fontSize: sf(22) }]}>{isYesterday ? '어제의 랭킹' : '오늘의 랭킹'}</Text>
            </View>
            <Pressable style={[styles.closeIconButton, { width: sz(32), height: sz(32) }]} onPress={onClose} hitSlop={8}>
              <Text style={[styles.closeIconText, { fontSize: sf(22) }]}>×</Text>
            </Pressable>
          </View>
          <View style={styles.tabs}>
            <Pressable onPress={() => onSelectDate?.(yesterday)} style={[styles.tab, { paddingVertical: sz(7) }, isYesterday && styles.tabActive]}>
              <Text style={[styles.tabText, { fontSize: sf(13) }, isYesterday && styles.tabTextActive]}>어제</Text>
            </Pressable>
            <Pressable onPress={() => onSelectDate?.(today)} style={[styles.tab, { paddingVertical: sz(7) }, isToday && styles.tabActive]}>
              <Text style={[styles.tabText, { fontSize: sf(13) }, isToday && styles.tabTextActive]}>오늘</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {rankings === null ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { fontSize: sf(16) }]}>불러오는 중...</Text>
              </View>
            ) : rankings.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { fontSize: sf(16) }]}>아직 기록이 없습니다</Text>
                <Text style={[styles.emptyDescription, { fontSize: sf(12) }]}>첫 번째 정답 기록을 남겨보세요</Text>
              </View>
            ) : (
              rankings.map((ranking, index) => renderRow(ranking, index, index + 1))
            )}
          </ScrollView>

          {showMyRank && (
            <View style={styles.myRankSection}>
              <Text style={[styles.myRankLabel, { fontSize: sf(11) }]}>내 순위</Text>
              {renderRow(myRank, 10, myRank.rank)}
            </View>
          )}

          <Pressable onPress={onClose} style={[styles.closeButton, { paddingVertical: sz(11) }]}>
            <Text style={[styles.closeButtonText, { fontSize: sf(14) }]}>닫기</Text>
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
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tab: { flex: 1, borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 10, paddingVertical: 7, backgroundColor: '#f0ebe0', alignItems: 'center' },
  tabActive: { backgroundColor: '#7a5c3a', borderColor: '#7a5c3a' },
  tabText: { color: '#7a6450', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#fdfbf6' },
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
