import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import crosswordMap from './data/crosswordMap1.json';

const normalize = (value) => value.replace(/\s/g, '').trim();

export default function App() {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('문제를 선택하고 정답을 입력해 보세요.');
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = Math.max(22, Math.min(36, Math.floor((screenWidth - 76) / crosswordMap.width)));

  const slot = crosswordMap.cells[selectedSlot];
  const solvedCount = Object.keys(answers).filter((key) => answers[key]).length;
  const progress = Math.round((solvedCount / crosswordMap.cells.length) * 100);

  const openCells = useMemo(() => {
    const cells = {};
    crosswordMap.grid.forEach((row, rowIndex) => {
      [...row].forEach((value, colIndex) => {
        if (value !== '#') cells[`${rowIndex}-${colIndex}`] = true;
      });
    });
    return cells;
  }, []);

  const chooseSlot = (index) => {
    setSelectedSlot(index);
    setInput(answers[index] || '');
    setMessage('정의를 읽고 정답을 입력해 보세요.');
  };

  const selectCell = (rowIndex, colIndex) => {
    const matchingSlots = crosswordMap.cells
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const end = item.direction === 'across' ? item.col + item.length : item.col;
        const bottom = item.direction === 'down' ? item.row + item.length : item.row;
        return (
          (item.direction === 'across' && rowIndex === item.row && colIndex >= item.col && colIndex < end) ||
          (item.direction === 'down' && colIndex === item.col && rowIndex >= item.row && rowIndex < bottom)
        );
      });

    if (!matchingSlots.length) return;
    const currentIndex = matchingSlots.findIndex(({ index }) => index === selectedSlot);
    const nextSlot = matchingSlots[currentIndex < 0 ? 0 : (currentIndex + 1) % matchingSlots.length];
    chooseSlot(nextSlot.index);
  };

  const submitAnswer = () => {
    if (!slot || !input) {
      setMessage('정답을 입력해 주세요.');
      return;
    }

    if (normalize(input) === normalize(slot.answer)) {
      setAnswers((current) => ({ ...current, [selectedSlot]: slot.answer }));
      setInput(slot.answer);
      setMessage('정답입니다. 다음 문제를 선택해 보세요.');
      return;
    }

    setMessage('아직 정답이 아닙니다. 다시 시도해 보세요.');
  };


  const resetGame = () => {
    setAnswers({});
    setSelectedSlot(null);
    setInput('');
    setMessage('문제를 선택하고 정답을 입력해 보세요.');
  };

  const getCellText = (rowIndex, colIndex) => {
    const position = crosswordMap.cells.findIndex((item) => {
      const end = item.direction === 'across' ? item.col + item.length : item.col;
      const bottom = item.direction === 'down' ? item.row + item.length : item.row;
      return (
        (item.direction === 'across' && rowIndex === item.row && colIndex >= item.col && colIndex < end) ||
        (item.direction === 'down' && colIndex === item.col && rowIndex >= item.row && rowIndex < bottom)
      );
    });

    if (position < 0) return '';
    const item = crosswordMap.cells[position];
    const offset = item.direction === 'across' ? colIndex - item.col : rowIndex - item.row;
    const solved = answers[position];
    return solved ? solved[offset] : '';
  };

  const isSelectedCell = (rowIndex, colIndex) => {
    if (!slot) return false;
    const end = slot.direction === 'across' ? slot.col + slot.length : slot.col;
    const bottom = slot.direction === 'down' ? slot.row + slot.length : slot.row;
    return (
      (slot.direction === 'across' && rowIndex === slot.row && colIndex >= slot.col && colIndex < end) ||
      (slot.direction === 'down' && colIndex === slot.col && rowIndex >= slot.row && rowIndex < bottom)
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BIBLE LINK</Text>
            <Text style={styles.title}>성경 단어 퍼즐</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>난이도 1</Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>퍼즐 진행도</Text>
            <Text style={styles.progressValue}>{solvedCount}/{crosswordMap.cells.length}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.boardCard}>
          <Text style={styles.sectionTitle}>퍼즐판</Text>
          <View style={styles.board}>
            {crosswordMap.grid.map((row, rowIndex) => (
              <View style={styles.gridRow} key={`row-${rowIndex}`}>
                {[...row].map((value, colIndex) => {
                  const isOpen = openCells[`${rowIndex}-${colIndex}`];
                  const selected = isOpen && isSelectedCell(rowIndex, colIndex);
                  return (
                    <Pressable
                      key={`${rowIndex}-${colIndex}`}
                      disabled={!isOpen}
                      onPress={() => selectCell(rowIndex, colIndex)}
                      style={[styles.cell, { width: cellSize, height: cellSize }, !isOpen && styles.blockedCell, selected && styles.selectedCell]}
                    >
                      {isOpen && <Text style={styles.cellText}>{getCellText(rowIndex, colIndex)}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {slot ? (
          <View style={styles.answerCard}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedDirection}>{slot.direction === 'across' ? '가로' : '세로'} {slot.number}번</Text>
              {answers[selectedSlot] && <Text style={styles.check}>완료</Text>}
            </View>
            <Text style={styles.clue}>{slot.clue}</Text>
            <Text style={styles.answerLabel}>정답 입력</Text>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="정답을 입력하세요"
              placeholderTextColor="#9aa3ad"
              autoCapitalize="none"
              maxLength={slot.length}
              style={styles.answerInput}
              returnKeyType="done"
              onSubmitEditing={submitAnswer}
            />
            <View style={styles.actionRow}>
              <Pressable onPress={submitAnswer} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>정답 확인</Text>
              </Pressable>
            </View>
            <Text style={styles.message}>{message}</Text>
          </View>
        ) : (
          <View style={styles.emptySelection}>
            <Text style={styles.emptySelectionTitle}>퍼즐판의 칸을 눌러 보세요</Text>
            <Text style={styles.emptySelectionText}>선택한 단어의 문제와 정답 입력칸이 이곳에 나타납니다.</Text>
          </View>
        )}

        {progress === 100 && (
          <View style={styles.completeCard}>
            <Text style={styles.completeTitle}>퍼즐을 완성했어요</Text>
            <Text style={styles.completeText}>모든 성경 단어를 찾았습니다.</Text>
          </View>
        )}

        <Pressable onPress={resetGame} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>처음부터 다시 풀기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f8fb' },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: '#53708d', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#172536', fontSize: 28, fontWeight: '800', marginTop: 4 },
  badge: { backgroundColor: '#e2edf6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#315d7f', fontSize: 12, fontWeight: '700' },
  progressCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 18, shadowColor: '#17324d', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { color: '#647487', fontSize: 13, fontWeight: '600' },
  progressValue: { color: '#315d7f', fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#e9eef3', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4d8cba', borderRadius: 8 },
  boardCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 22, alignItems: 'center', shadowColor: '#17324d', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  sectionTitle: { color: '#26384b', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  board: { borderWidth: 1, borderColor: '#d9e1e8', backgroundColor: '#fff' },
  gridRow: { flexDirection: 'row' },
  cell: { width: 36, height: 36, borderWidth: 0.5, borderColor: '#b9c9d6', backgroundColor: '#fdfefe', alignItems: 'center', justifyContent: 'center' },
  blockedCell: { backgroundColor: '#273b50', borderColor: '#273b50' },
  selectedCell: { backgroundColor: '#dff1ff', borderColor: '#4d8cba', borderWidth: 2 },
  cellText: { color: '#234963', fontSize: 20, fontWeight: '800' },
  clueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#e7edf2' },
  activeClueCard: { borderColor: '#73a7c9', backgroundColor: '#f0f8fd' },
  clueNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#315d7f', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  clueNumberText: { color: '#fff', fontWeight: '800' },
  clueContent: { flex: 1 },
  direction: { color: '#5d89a7', fontSize: 11, fontWeight: '800', marginBottom: 3 },
  clue: { color: '#34485d', fontSize: 14, lineHeight: 20 },
  check: { color: '#3c9a72', fontSize: 11, fontWeight: '800', marginLeft: 8 },
  answerCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginTop: 14, shadowColor: '#17324d', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  selectedDirection: { color: '#5d89a7', fontSize: 12, fontWeight: '800' },
  emptySelection: { backgroundColor: '#eef6fb', borderRadius: 18, padding: 20, marginTop: 14, alignItems: 'center' },
  emptySelectionTitle: { color: '#315d7f', fontSize: 16, fontWeight: '800' },
  emptySelectionText: { color: '#647487', fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
  answerLabel: { color: '#26384b', fontSize: 14, fontWeight: '800', marginBottom: 9 },
  answerInput: { borderWidth: 1, borderColor: '#cbd8e2', borderRadius: 12, paddingHorizontal: 14, height: 48, color: '#20384d', fontSize: 17, backgroundColor: '#fbfdff' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryButton: { flex: 1, backgroundColor: '#315d7f', borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: { flex: 1, backgroundColor: '#eaf3f9', borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#315d7f', fontSize: 14, fontWeight: '800' },
  message: { color: '#647487', fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  completeCard: { backgroundColor: '#e7f6ee', borderRadius: 18, padding: 18, marginTop: 16, alignItems: 'center' },
  completeTitle: { color: '#267350', fontSize: 17, fontWeight: '800' },
  completeText: { color: '#4b7964', fontSize: 13, marginTop: 5 },
  resetButton: { alignItems: 'center', paddingVertical: 18 },
  resetButtonText: { color: '#6b7c8d', fontSize: 13, fontWeight: '700' },
});
