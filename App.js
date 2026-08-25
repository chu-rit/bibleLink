import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import crosswordMaps from './data/crosswordMaps';
import bibleWords from './data/bibleWordsLib1.json';
import MapSelectScreen from './MapSelectScreen';

const normalize = (value) => value.replace(/\s/g, '').trim();
const wordDataById = Object.fromEntries(bibleWords.map((item) => [item.id, item]));

function PuzzleScreen({ crosswordMap, onBack }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('문제를 선택하고 정답을 입력해 보세요.');
  const [autoFill, setAutoFill] = useState(false);
  const [boardArea, setBoardArea] = useState({ width: 0, height: 0 });
  const cellSize = Math.min(
    Math.floor((boardArea.width - 2) / crosswordMap.width),
    Math.floor((boardArea.height - 2) / crosswordMap.height),
    56
  );

  const slot = crosswordMap.cells[selectedSlot];
  const clue = slot?.clue || wordDataById[slot?.wordId]?.definition || '';
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
  }, [crosswordMap]);

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

  const toggleAutoFill = (enabled) => {
    setAutoFill(enabled);
    setAnswers(enabled ? Object.fromEntries(crosswordMap.cells.map((item, index) => [index, item.answer])) : {});
    setMessage(enabled ? '테스트 모드: 정답을 모두 표시했습니다.' : '정답을 숨겼습니다.');
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
    setAutoFill(false);
    setSelectedSlot(null);
    setInput('');
    setMessage('문제를 선택하고 정답을 입력해 보세요.');
  };

  const getCellText = (rowIndex, colIndex) => {
    const positions = crosswordMap.cells
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const end = item.direction === 'across' ? item.col + item.length : item.col;
        const bottom = item.direction === 'down' ? item.row + item.length : item.row;
        return (
          (item.direction === 'across' && rowIndex === item.row && colIndex >= item.col && colIndex < end) ||
          (item.direction === 'down' && colIndex === item.col && rowIndex >= item.row && rowIndex < bottom)
        );
      });

    for (const { item, index } of positions) {
      const solved = answers[index];
      if (!solved) continue;
      const offset = item.direction === 'across' ? colIndex - item.col : rowIndex - item.row;
      const letter = normalize(solved)[offset];
      if (letter) return letter;
    }

    return '';
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>맵 선택</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>{crosswordMap.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>난이도 {crosswordMap.difficulty}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.progressColumn}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>퍼즐 진행도</Text>
                <Text style={styles.progressValue}>{solvedCount}/{crosswordMap.cells.length}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>
            <View style={styles.autoFillBox}>
              <Text style={styles.autoFillLabel}>정답 보기</Text>
              <Switch
                value={autoFill}
                onValueChange={toggleAutoFill}
                trackColor={{ false: '#d8e1e8', true: '#9cc8e4' }}
                thumbColor={autoFill ? '#315d7f' : '#f7fafc'}
                accessibilityLabel="정답 자동 채우기"
              />
            </View>
          </View>

          <View
            style={styles.boardArea}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setBoardArea({ width, height });
            }}
          >
            {cellSize > 0 && (
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
                          {isOpen && (
                            <Text style={[styles.cellText, { fontSize: Math.max(12, Math.floor(cellSize * 0.55)) }]}>
                              {getCellText(rowIndex, colIndex)}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.answerCard}>
            {slot ? (
              <View>
                <View style={styles.selectedHeader}>
                  <Text style={styles.selectedDirection}>{slot.direction === 'across' ? '가로' : '세로'} {slot.number}번</Text>
                  {answers[selectedSlot] && <Text style={styles.check}>완료</Text>}
                </View>
                <Text style={styles.clue} numberOfLines={2}>{clue}</Text>
                <View style={styles.actionRow}>
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
                  <Pressable onPress={submitAnswer} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>정답 확인</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.emptySelection}>
                <Text style={styles.emptySelectionTitle}>퍼즐판의 칸을 눌러 보세요</Text>
                <Text style={styles.emptySelectionText} numberOfLines={2}>선택한 단어의 문제와 정답 입력칸이 이곳에 나타납니다.</Text>
              </View>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.message} numberOfLines={1}>
                {progress === 100 ? '퍼즐을 완성했어요. 모든 성경 단어를 찾았습니다.' : message}
              </Text>
              <Pressable onPress={resetGame} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>다시 풀기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [selectedMap, setSelectedMap] = useState(null);

  if (!selectedMap) return <MapSelectScreen maps={crosswordMaps} onSelect={setSelectedMap} />;

  return <PuzzleScreen crosswordMap={selectedMap} onBack={() => setSelectedMap(null)} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f8fb' },
  flex: { flex: 1 },
  container: { flex: 1, padding: 16 },
  backButton: { backgroundColor: '#e9f0f6', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  backButtonText: { color: '#5d89a7', fontSize: 12, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow: { color: '#53708d', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { flex: 1, color: '#172536', fontSize: 18, fontWeight: '800', marginHorizontal: 10 },
  badge: { backgroundColor: '#e2edf6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#315d7f', fontSize: 12, fontWeight: '700' },
  testModeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff8e8', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0dfb2' },
  testModeCopy: { flex: 1, paddingRight: 12 },
  testModeTitle: { color: '#735a22', fontSize: 14, fontWeight: '800' },
  testModeDescription: { color: '#927842', fontSize: 12, marginTop: 4 },
  progressCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 18, shadowColor: '#17324d', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e7edf2' },
  progressColumn: { flex: 1, paddingRight: 12 },
  autoFillBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoFillLabel: { color: '#647487', fontSize: 12, fontWeight: '700' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#647487', fontSize: 13, fontWeight: '600' },
  progressValue: { color: '#315d7f', fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#e9eef3', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4d8cba', borderRadius: 8 },
  boardCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 22, alignItems: 'center', shadowColor: '#17324d', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  boardArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
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
  clue: { color: '#34485d', fontSize: 13, lineHeight: 19 },
  check: { color: '#3c9a72', fontSize: 11, fontWeight: '800', marginLeft: 8 },
  answerCard: { backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e7edf2' },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  selectedDirection: { color: '#5d89a7', fontSize: 12, fontWeight: '800' },
  emptySelection: { alignItems: 'center' },
  emptySelectionTitle: { color: '#315d7f', fontSize: 14, fontWeight: '800' },
  emptySelectionText: { color: '#647487', fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },
  answerLabel: { color: '#26384b', fontSize: 14, fontWeight: '800', marginBottom: 9 },
  answerInput: { flex: 1, borderWidth: 1, borderColor: '#cbd8e2', borderRadius: 12, paddingHorizontal: 12, height: 42, color: '#20384d', fontSize: 16, backgroundColor: '#fbfdff' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  primaryButton: { backgroundColor: '#315d7f', borderRadius: 12, paddingHorizontal: 16, height: 42, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: { flex: 1, backgroundColor: '#eaf3f9', borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#315d7f', fontSize: 14, fontWeight: '800' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  message: { flex: 1, color: '#647487', fontSize: 12, lineHeight: 17 },
  completeCard: { backgroundColor: '#e7f6ee', borderRadius: 18, padding: 18, marginTop: 16, alignItems: 'center' },
  completeTitle: { color: '#267350', fontSize: 17, fontWeight: '800' },
  completeText: { color: '#4b7964', fontSize: 13, marginTop: 5 },
  resetButton: { paddingVertical: 4 },
  resetButtonText: { color: '#6b7c8d', fontSize: 12, fontWeight: '700' },
});
