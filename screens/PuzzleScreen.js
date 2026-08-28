import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
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
import {
  normalize,
  formatReferenceByChapter,
  wordDataById,
  averageDifficulty,
  formatMapTitle,
  getFilledCellCount,
  getOpenCellCount,
} from '../utils';

const isLocalhost = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

function PuzzleScreen({ crosswordMap, onBack, initialAnswers, onAnswersChange, hintPoints, hintedSlots, onUseHint }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [input, setInput] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [autoFill, setAutoFill] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputKey, setInputKey] = useState(0);
  const [webViewportHeight, setWebViewportHeight] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const hasShownClearRef = useRef(getFilledCellCount(crosswordMap, initialAnswers || {}) === getOpenCellCount(crosswordMap));
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const inputRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const wrongTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const boardWidth = Math.max(200, (windowWidth || 0) - 32);
  const availableHeight = isKeyboardVisible
    ? (Platform.OS === 'web' && webViewportHeight
      ? webViewportHeight
      : Math.max(200, (windowHeight || 0) - keyboardHeight))
    : (windowHeight || 0);
  const headerHeight = 160;
  const maxBoardHeight = (windowHeight || 0) - headerHeight;
  const cellSizeRef = useRef(null);
  if (cellSizeRef.current === null) {
    cellSizeRef.current = Number.isFinite(Math.floor(boardWidth / (crosswordMap.width || 1)))
      ? Math.max(8, Math.min(
        Math.floor(boardWidth / (crosswordMap.width || 1)),
        Math.floor(maxBoardHeight / (crosswordMap.height || 1)),
        56
      ))
      : 20;
  }
  const cellSize = cellSizeRef.current;
  const boardHeight = cellSize * (crosswordMap.height || 1);

  useEffect(() => {
    onAnswersChange?.(crosswordMap.id, answers);
  }, [answers]);

  useEffect(() => {
    if (selectedSlot === null) return undefined;

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(focusTimer);
  }, [selectedSlot]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return undefined;

    const viewport = window.visualViewport;
    const initialViewportHeight = window.innerHeight;
    const updateViewport = () => {
      setWebViewportHeight(viewport.height);
      setIsKeyboardVisible(viewport.height < initialViewportHeight - 150);
      window.scrollTo(0, 0);
    };

    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => () => {
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  const triggerWrong = () => {
    setIsWrong(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 50, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      ]),
      { iterations: 5 }
    ).start(() => shakeAnim.setValue(0));
  };

  const slot = crosswordMap.cells[selectedSlot];
  const wordData = wordDataById[slot?.wordId];
  const isHinted = Boolean(hintedSlots?.[selectedSlot]) && !answers[selectedSlot];
  const clue = slot?.clue || wordData?.definition || '';
  const hintReferences = wordData?.references?.map(formatReferenceByChapter).join(', ') || '';

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
    setInputKey((current) => current + 1);
    setInput(answers[index] || '');
    setIsCorrect(Boolean(answers[index]));
    setIsWrong(false);

    if (inputRef.current) {
      inputRef.current.blur();
      inputRef.current.focus();
    }
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
      inputRef.current?.blur();
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

  const filledCellCount = getFilledCellCount(crosswordMap, answers);
  const totalCellCount = Object.keys(openCells).length;
  const progress = totalCellCount ? Math.round((filledCellCount / totalCellCount) * 100) : 0;
  const activeSpanHeight = slot?.direction === 'down' ? slot.length * cellSize : cellSize;
  const activeStartY = (slot?.row || 0) * cellSize;
  const activeEndY = slot?.direction === 'down'
    ? activeStartY + (slot.length - 1) * cellSize
    : activeStartY;
  const gridHeight = crosswordMap.grid.length * cellSize;
  const availableBelow = gridHeight - activeEndY - cellSize;
  const availableAbove = activeStartY;
  const topPadding = Math.min(cellSize * 2 + Math.max(0, cellSize * 2 - availableBelow), availableAbove);
  const bottomPadding = Math.min(cellSize * 2 + Math.max(0, cellSize * 2 - availableAbove), availableBelow);
  const hasActiveSlot = selectedSlot !== null && slot !== undefined;
  const boardViewportHeight = hasActiveSlot
    ? Math.min(boardHeight, activeSpanHeight + topPadding + bottomPadding)
    : boardHeight;
  const maxBoardOffset = Math.max(0, gridHeight - boardViewportHeight);
  const boardOffsetY = hasActiveSlot && maxBoardOffset > 0
    ? -Math.min(maxBoardOffset, Math.max(0, activeStartY - topPadding))
    : 0;

  useEffect(() => {
    if (filledCellCount < totalCellCount) {
      hasShownClearRef.current = false;
      return;
    }

    if (totalCellCount > 0 && !hasShownClearRef.current) {
      hasShownClearRef.current = true;
      Keyboard.dismiss();
      setShowClearModal(true);
    }
  }, [filledCellCount, totalCellCount]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
      ]}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>맵 선택</Text>
            </Pressable>
            <Text style={styles.mapTitle} numberOfLines={1}>{formatMapTitle(crosswordMap.title)}</Text>
            <View style={styles.headerBadges}>
              <View style={styles.hintBadge}>
                <Text style={styles.hintBadgeText}>힌트 {hintPoints}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>난이도 {averageDifficulty(crosswordMap).toFixed(1)}</Text>
              </View>
            </View>
          </View>

          {!isKeyboardVisible && (
            <View style={styles.statusRow}>
              <View style={styles.progressColumn}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>퍼즐 진행도</Text>
                  <Text style={styles.progressValue}>{filledCellCount}/{totalCellCount}</Text>
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
          )}

          <View
            style={[
              styles.boardArea,
              {
                width: boardWidth,
                flex: 1,
                justifyContent: 'flex-start',
              },
            ]}
          >
            <View style={styles.boardClip}>
            <View style={[styles.board, { transform: [{ translateY: boardOffsetY }] }]}>
                {crosswordMap.grid.map((row, rowIndex) => (
                  <View style={styles.gridRow} key={`row-${rowIndex}`}>
                    {[...row].map((value, colIndex) => {
                      const isOpen = openCells[`${rowIndex}-${colIndex}`];
                      const selected = isOpen && isSelectedCell(rowIndex, colIndex);
                      return (
                        <Pressable
                          key={`${rowIndex}-${colIndex}`}
                          onPress={() => {
                            if (!isOpen) {
                              setSelectedSlot(null);
                              setInput('');
                              setIsCorrect(false);
                              setIsWrong(false);
                              setIsKeyboardVisible(false);
                              inputRef.current?.blur();
                              Keyboard.dismiss();
                              return;
                            }
                            selectCell(rowIndex, colIndex);
                          }}
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
            </View>
        </View>
      </View>

      <View
        style={[
          styles.answerCard,
          isKeyboardVisible && {
            bottom: Platform.OS === 'web'
              ? Math.max(0, (windowHeight || 0) - (webViewportHeight || (windowHeight || 0)))
              : keyboardHeight,
          },
        ]}
        pointerEvents={slot ? 'auto' : 'none'}
      >
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
                      key={inputKey}
                      ref={inputRef}
                      value={input}
                      onChangeText={(text) => {
                        setInput(text);
                        setIsCorrect(false);
                        setIsWrong(false);
                      }}
                      placeholder="정답을 입력하세요"
                      placeholderTextColor="#9aa3ad"
                      autoFocus
                      autoCapitalize="none"
                      maxLength={slot.length}
                      style={[
                        styles.answerInput,
                        input && styles.answerInputWithClear,
                        isCorrect && styles.answerInputCorrect,
                        isWrong && styles.answerInputWrong,
                        isWrong && styles.answerInputHidden,
                      ]}
                      returnKeyType="done"
                      blurOnSubmit={false}
                      onFocus={() => {
                        if (Platform.OS !== 'web') setIsKeyboardVisible(true);
                        if (Platform.OS === 'web') {
                          const resetScroll = () => window.scrollTo(0, 0);
                          resetScroll();
                          setTimeout(resetScroll, 100);
                          setTimeout(resetScroll, 300);
                          setTimeout(resetScroll, 500);
                        }
                      }}
                      onBlur={() => {
                        if (Platform.OS !== 'web') setIsKeyboardVisible(false);
                      }}
                      onSubmitEditing={submitAnswer}
                    />
                    {input && (
                      <Pressable
                        onPress={() => {
                          setAnswers((current) => {
                            const next = { ...current };
                            delete next[selectedSlot];
                            return next;
                          });
                          setInput('');
                          setIsCorrect(false);
                          setIsWrong(false);
                          inputRef.current?.focus();
                        }}
                        accessibilityLabel="입력 내용 지우기"
                        style={styles.clearInputButton}
                      >
                        <Text style={styles.clearInputButtonText}>×</Text>
                      </Pressable>
                    )}
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

        <Modal
          visible={showClearModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowClearModal(false)}
        >
          <View style={styles.clearModalOverlay}>
            <View style={styles.clearModalCard}>
              <Pressable
                onPress={() => setShowClearModal(false)}
                accessibilityLabel="클리어 팝업 닫기"
                style={styles.clearModalCloseButton}
              >
                <Text style={styles.clearModalCloseText}>×</Text>
              </Pressable>
              <Text style={styles.clearModalTitle}>퍼즐 클리어</Text>
              <Text style={styles.clearModalText}>모든 글자를 채웠습니다.</Text>
              <Pressable
                onPress={() => {
                  setShowClearModal(false);
                  onBack();
                }}
                style={styles.clearModalButton}
              >
                <Text style={styles.clearModalButtonText}>맵 선택으로 돌아가기</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f8fb', position: 'relative', height: '100%' },
  webFixedScreen: { position: 'fixed', top: 0, right: 0, bottom: 0, left: 0 },
  flex: { flex: 1, position: 'relative' },
  container: { flex: 1, padding: 16, position: 'relative' },
  backButton: { backgroundColor: '#e9f0f6', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  backButtonText: { color: '#5d89a7', fontSize: 12, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mapTitle: { flex: 1, color: '#172536', fontSize: 16, fontWeight: '800', marginHorizontal: 10 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: '#e2edf6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#315d7f', fontSize: 12, fontWeight: '700' },
  hintBadge: { backgroundColor: '#fdf0e3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  hintBadgeText: { color: '#e08a3c', fontSize: 12, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e7edf2' },
  progressColumn: { flex: 1, paddingRight: 12 },
  autoFillBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoFillLabel: { color: '#647487', fontSize: 12, fontWeight: '700' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#647487', fontSize: 13, fontWeight: '600' },
  progressValue: { color: '#315d7f', fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#e9eef3', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4d8cba', borderRadius: 8 },
  boardArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  boardClip: { overflow: 'hidden', width: '100%', height: '100%' },
  board: {
    borderWidth: 2,
    borderColor: '#315d7f',
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#17324d',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  gridRow: { flexDirection: 'row' },
  cell: { width: 36, height: 36, borderWidth: 0.5, borderColor: '#c4d2de', backgroundColor: '#fdfefe', alignItems: 'center', justifyContent: 'center' },
  blockedCell: { backgroundColor: '#2a3f54', borderColor: '#2a3f54' },
  selectedCell: { backgroundColor: '#dff1ff', borderColor: '#4d8cba', borderWidth: 2 },
  cellText: { color: '#234963', fontSize: 20, fontWeight: '800' },
  clue: { color: '#34485d', fontSize: 13, lineHeight: 19 },
  check: { color: '#3c9a72', fontSize: 11, fontWeight: '800', marginLeft: 8 },
  answerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e7edf2',
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    shadowColor: '#17324d',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  clearModalOverlay: { flex: 1, backgroundColor: 'rgba(23, 37, 54, 0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  clearModalCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
  clearModalCloseButton: { position: 'absolute', top: 8, right: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clearModalCloseText: { color: '#8b98a5', fontSize: 24, lineHeight: 26, fontWeight: '500' },
  clearModalTitle: { color: '#315d7f', fontSize: 22, fontWeight: '800' },
  clearModalText: { color: '#647487', fontSize: 14, marginTop: 8, marginBottom: 20 },
  clearModalButton: { backgroundColor: '#315d7f', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  clearModalButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  selectedDirection: { color: '#5d89a7', fontSize: 12, fontWeight: '800' },
  emptySelection: { alignItems: 'center' },
  emptySelectionTitle: { color: '#315d7f', fontSize: 14, fontWeight: '800' },
  emptySelectionText: { color: '#647487', fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },
  answerInputWrap: { flex: 1, position: 'relative' },
  answerInput: { borderWidth: 1, borderColor: '#cbd8e2', borderRadius: 12, paddingHorizontal: 12, height: 42, color: '#20384d', fontSize: 16, backgroundColor: '#fbfdff' },
  answerInputWithClear: { paddingRight: 36 },
  clearInputButton: { position: 'absolute', top: 1, right: 1, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clearInputButtonText: { color: '#8b98a5', fontSize: 24, lineHeight: 26, fontWeight: '500' },
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
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

export default PuzzleScreen;
