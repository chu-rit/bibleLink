import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import crosswordMaps from './data/crosswordMaps';
import bibleWords from './data/bibleWordsLib1.json';
import MapSelectScreen from './MapSelectScreen';
import WordSearchScreen from './WordSearchScreen';

const normalize = (value) => value.replace(/\s/g, '').trim();
const wordDataById = Object.fromEntries(bibleWords.map((item) => [item.id, item]));

const isLocalhost = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const averageDifficulty = (map) => {
  const values = map.cells.map((cell) => wordDataById[cell.wordId]?.difficulty).filter(Boolean);
  if (!values.length) return map.difficulty;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

function PuzzleScreen({ crosswordMap, onBack, initialAnswers, onAnswersChange, hintPoints, hintedSlots, onUseHint }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [input, setInput] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [autoFill, setAutoFill] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const wrongTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const boardWidth = Math.max(200, (windowWidth || 0) - 32);
  const boardHeight = Math.max(200, Math.min(boardWidth, (windowHeight || 0) * 0.5));
  const rawCellSize = Math.min(
    Math.floor(boardWidth / (crosswordMap.width || 1)),
    Math.floor(boardHeight / (crosswordMap.height || 1)),
    56
  );
  const cellSize = Number.isFinite(rawCellSize) ? Math.max(8, rawCellSize) : 20;

  useEffect(() => {
    onAnswersChange?.(crosswordMap.id, answers);
  }, [answers]);

  useEffect(() => () => {
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  const triggerWrong = () => {
    setIsWrong(true);
    fadeAnim.setValue(1);
    translateYAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 50, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      ]),
      { iterations: 10 }
    ).start(() => {
      shakeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 800, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(translateYAnim, { toValue: -20, duration: 800, easing: Easing.ease, useNativeDriver: true }),
      ]).start(() => {
        setInput('');
        fadeAnim.setValue(1);
        translateYAnim.setValue(0);
        setIsWrong(false);
      });
    });
  };

  const slot = crosswordMap.cells[selectedSlot];
  const wordData = wordDataById[slot?.wordId];
  const isHinted = Boolean(hintedSlots?.[selectedSlot]) && !answers[selectedSlot];
  const clue = slot?.clue || wordData?.definition || '';
  const hintReferences = wordData?.references?.join(', ') || '';
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
    setIsCorrect(Boolean(answers[index]));
    setIsWrong(false);
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
  };

  const submitAnswer = () => {
    if (!slot || !input) return;

    if (normalize(input) === normalize(slot.answer)) {
      setAnswers((current) => ({ ...current, [selectedSlot]: slot.answer }));
      setInput(slot.answer);
      setIsCorrect(true);
      setIsWrong(false);
    } else {
      triggerWrong();
    }
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
              <Text style={styles.badgeText}>난이도 {averageDifficulty(crosswordMap).toFixed(1)}</Text>
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
            {isLocalhost && (
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
            )}
          </View>

          <View
            style={[styles.boardArea, { width: boardWidth, height: boardHeight }]}
          >
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
          </View>

          <View style={styles.hintPointBar}>
            <Text style={styles.hintPointText}>힌트 {hintPoints}</Text>
          </View>

          <View style={styles.answerCard}>
            {slot ? (
              <View>
                {!isCorrect && (
                  <View style={styles.hintBox}>
                    {isHinted ? (
                      <Text style={styles.hintReference} numberOfLines={2}>{hintReferences}</Text>
                    ) : (
                      <Pressable
                        onPress={() => onUseHint?.(crosswordMap.id, selectedSlot)}
                        disabled={hintPoints <= 0}
                        style={[
                          styles.hintButton,
                          hintPoints <= 0 && styles.primaryButtonDisabled,
                        ]}
                      >
                        <Text style={styles.hintButtonText}>
                          {hintPoints <= 0 ? '없음' : '힌트'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <View style={styles.selectedHeader}>
                  <Text style={styles.selectedDirection}>{slot.direction === 'across' ? '가로' : '세로'} {slot.number}번</Text>
                  {answers[selectedSlot] && <Text style={styles.check}>완료</Text>}
                </View>
                <Text style={styles.clue} numberOfLines={2}>{clue}</Text>
                <View style={styles.actionRow}>
                  <Animated.View
                    style={[
                      styles.answerInputWrap,
                      { transform: [{ translateX: shakeAnim }] },
                    ]}
                  >
                    <TextInput
                      value={input}
                      onChangeText={(text) => {
                        setInput(text);
                        setIsCorrect(false);
                        setIsWrong(false);
                      }}
                      placeholder="정답을 입력하세요"
                      placeholderTextColor="#9aa3ad"
                      autoCapitalize="none"
                      maxLength={slot.length}
                      style={[
                        styles.answerInput,
                        isCorrect && styles.answerInputCorrect,
                        isWrong && styles.answerInputWrong,
                        isWrong && styles.answerInputHidden,
                      ]}
                      returnKeyType="done"
                      blurOnSubmit={false}
                      onSubmitEditing={submitAnswer}
                    />
                    {isWrong && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.wrongTextOverlay,
                          {
                            transform: [
                              { translateX: shakeAnim },
                              { translateY: translateYAnim },
                            ],
                            opacity: fadeAnim,
                          },
                        ]}
                      >
                        <Text style={styles.wrongText}>{input}</Text>
                      </Animated.View>
                    )}
                  </Animated.View>
                  <Pressable
                    onPress={submitAnswer}
                    style={[
                      styles.primaryButton,
                      isCorrect && styles.primaryButtonCorrect,
                      isWrong && styles.primaryButtonWrong,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isCorrect ? '정답' : isWrong ? '오답' : '정답 확인'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.emptySelection}>
                <Text style={styles.emptySelectionTitle}>퍼즐판의 칸을 눌러 보세요</Text>
                <Text style={styles.emptySelectionText} numberOfLines={2}>선택한 단어의 문제와 정답 입력칸이 이곳에 나타납니다.</Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState('mapSelect');
  const [selectedMap, setSelectedMap] = useState(null);
  const [answersByMap, setAnswersByMap] = useState({});
  const [hintPointsByMap, setHintPointsByMap] = useState({});
  const [hintedSlotsByMap, setHintedSlotsByMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('answersByMap'),
      AsyncStorage.getItem('hintPointsByMap'),
      AsyncStorage.getItem('hintedSlotsByMap'),
    ])
      .then(([storedAnswers, storedHintPoints, storedHintedSlots]) => {
        if (storedAnswers) setAnswersByMap(JSON.parse(storedAnswers));
        if (storedHintPoints) setHintPointsByMap(JSON.parse(storedHintPoints));
        if (storedHintedSlots) setHintedSlotsByMap(JSON.parse(storedHintedSlots));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleAnswersChange = (mapId, answers) => {
    setAnswersByMap((prev) => {
      const next = { ...prev, [mapId]: answers };
      AsyncStorage.setItem('answersByMap', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleUseHint = (mapId, slotIndex) => {
    setHintPointsByMap((prev) => {
      const current = prev[mapId] ?? 3;
      if (current <= 0) return prev;
      const next = { ...prev, [mapId]: current - 1 };
      AsyncStorage.setItem('hintPointsByMap', JSON.stringify(next)).catch(() => {});
      return next;
    });
    setHintedSlotsByMap((prev) => {
      const next = { ...prev, [mapId]: { ...(prev[mapId] || {}), [slotIndex]: true } };
      AsyncStorage.setItem('hintedSlotsByMap', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const progressByMap = useMemo(
    () =>
      Object.fromEntries(
        crosswordMaps.map((map) => {
          const answers = answersByMap[map.id] || {};
          const solved = Object.keys(answers).filter((key) => answers[key]).length;
          return [map.id, { solved, total: map.cells.length }];
        })
      ),
    [answersByMap]
  );

  if (!loaded) return null;

  if (screen === 'wordSearch') {
    return <WordSearchScreen onBack={() => setScreen('mapSelect')} />;
  }

  if (screen !== 'puzzle' || !selectedMap) {
    return (
      <MapSelectScreen
        maps={crosswordMaps}
        progressByMap={progressByMap}
        onSelect={(map) => {
          setSelectedMap(map);
          setScreen('puzzle');
        }}
        onWordSearch={isLocalhost ? () => setScreen('wordSearch') : undefined}
      />
    );
  }

  return (
    <PuzzleScreen
      crosswordMap={selectedMap}
      initialAnswers={answersByMap[selectedMap.id]}
      onAnswersChange={handleAnswersChange}
      hintPoints={hintPointsByMap[selectedMap.id] ?? 3}
      hintedSlots={hintedSlotsByMap[selectedMap.id] || {}}
      onUseHint={handleUseHint}
      onBack={() => {
        setSelectedMap(null);
        setScreen('mapSelect');
      }}
    />
  );
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
  boardArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
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
  answerCard: { backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e7edf2', position: 'relative' },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  selectedDirection: { color: '#5d89a7', fontSize: 12, fontWeight: '800' },
  emptySelection: { alignItems: 'center' },
  emptySelectionTitle: { color: '#315d7f', fontSize: 14, fontWeight: '800' },
  emptySelectionText: { color: '#647487', fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },
  answerLabel: { color: '#26384b', fontSize: 14, fontWeight: '800', marginBottom: 9 },
  answerInputWrap: { flex: 1, position: 'relative' },
  answerInput: { borderWidth: 1, borderColor: '#cbd8e2', borderRadius: 12, paddingHorizontal: 12, height: 42, color: '#20384d', fontSize: 16, backgroundColor: '#fbfdff' },
  answerInputHidden: { color: 'transparent' },
  answerInputCorrect: { borderColor: '#3c9a72', backgroundColor: '#e7f6ee' },
  answerInputWrong: { borderColor: '#d64545', backgroundColor: '#fdeaea' },
  wrongTextOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 12 },
  wrongText: { fontSize: 16, fontWeight: '600', color: '#d64545' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  primaryButton: { backgroundColor: '#315d7f', borderRadius: 12, paddingHorizontal: 16, height: 42, alignItems: 'center', justifyContent: 'center' },
  primaryButtonCorrect: { backgroundColor: '#3c9a72' },
  primaryButtonWrong: { backgroundColor: '#d64545' },
  primaryButtonDisabled: { backgroundColor: '#a3b3c2' },
  hintBox: { position: 'absolute', top: -2, right: -2, zIndex: 1, maxWidth: 160 },
  hintButton: { backgroundColor: '#e08a3c', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  hintButtonText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  hintReference: { color: '#e08a3c', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  hintPointBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6, paddingHorizontal: 4 },
  hintPointText: { color: '#e08a3c', fontSize: 12, fontWeight: '800' },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  secondaryButton: { flex: 1, backgroundColor: '#eaf3f9', borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#315d7f', fontSize: 14, fontWeight: '800' },
});
