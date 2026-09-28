import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function WordHelpModal({ visible, onClose, eyebrow = 'DAILY WORD' }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.helpOverlay}>
        <View style={styles.helpCard}>
          <View style={styles.helpHeader}>
            <View>
              <Text style={styles.helpEyebrow}>{eyebrow}</Text>
              <Text style={styles.helpTitle}>게임 방법</Text>
            </View>
            <Pressable style={styles.helpCloseIcon} onPress={onClose} hitSlop={8}>
              <Text style={styles.helpCloseIconText}>×</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.helpList} contentContainerStyle={styles.helpListContent}>
            <View style={styles.helpItem}>
              <Text style={styles.helpItemTitle}>목적</Text>
              <Text style={styles.helpItemText}>상단에 표시된 칸 수만큼 자모를 입력해 단어를 맞히세요.</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpItemTitle}>색상의 의미</Text>
              <View style={styles.helpLegendItem}>
                <View style={[styles.helpDot, styles.helpDot_green]} />
                <Text style={styles.helpItemText}>자모와 위치가 모두 맞음</Text>
              </View>
              <View style={styles.helpLegendItem}>
                <View style={[styles.helpDot, styles.helpDot_yellow]} />
                <Text style={styles.helpItemText}>자모는 맞지만 위치가 다름</Text>
              </View>
              <View style={styles.helpLegendItem}>
                <View style={[styles.helpDot, styles.helpDot_gray]} />
                <Text style={styles.helpItemText}>단어에 없는 자모</Text>
              </View>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpItemTitle}>자모 풀이</Text>
              <Text style={styles.helpItemText}>복합 모음(ㅐ, ㅞ 등), 쌍자음(ㄲ, ㅆ 등), 겹받침(ㄳ, ㅄ 등)은 풀어서 사용됩니다.</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpItemTitle}>새 단어</Text>
              <Text style={styles.helpItemText}>매일 밤 11시에 새 단어로 바뀌며, 모든 사람에게 같은 단어가 출제됩니다.</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpItemTitle}>연승</Text>
              <Text style={styles.helpItemText}>매일 정답을 맞히면 연승 기록이 쌓입니다. 하루를 건너뛰거나 맞히지 못하면 초기화됩니다.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  helpOverlay: { flex: 1, backgroundColor: 'rgba(58,46,31,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  helpCard: { width: '100%', maxWidth: 360, maxHeight: 480, backgroundColor: '#fdfbf6', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 24, padding: 20, shadowColor: '#3a2e1f', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  helpHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  helpEyebrow: { color: '#e08a3c', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  helpTitle: { color: '#3a2e1f', fontSize: 22, fontWeight: '900', marginTop: 4 },
  helpCloseIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: '#d8cdb8', backgroundColor: '#f0ebe0', alignItems: 'center', justifyContent: 'center' },
  helpCloseIconText: { color: '#7a6450', fontSize: 22, lineHeight: 24, fontWeight: '500' },
  helpList: { marginTop: 14 },
  helpListContent: { paddingBottom: 2, gap: 10 },
  helpItem: { backgroundColor: '#f7f2e8', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  helpItemTitle: { color: '#7a5c3a', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  helpItemText: { color: '#7a6450', fontSize: 13, lineHeight: 19 },
  helpLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  helpDot: { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
  helpDot_green: { borderColor: '#3c9a72', backgroundColor: '#3c9a72' },
  helpDot_yellow: { borderColor: '#e08a3c', backgroundColor: '#e08a3c' },
  helpDot_gray: { borderColor: '#b8a88f', backgroundColor: '#b8a88f' },
});
