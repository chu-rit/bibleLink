import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Keyboard,
  Modal,
  Platform,
  Pressable,
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
import AnswerCard from './AnswerCard';

const BG_IMAGE = require('../assets/BG.png');

const isLocalhost = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const webPath = Platform.OS === 'web' &&
  typeof window !== 'undefined'
  ? (window.location.pathname + (window.location.hash || ''))
  : '';

const getMasterModeFromStorage = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try { return localStorage.getItem('masterMode') === '1'; } catch { return false; }
};

const isMasterMode = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (isLocalhost || webPath.includes('/master') || getMasterModeFromStorage());

function PuzzleScreen({ crosswordMap, onBack, initialAnswers, onAnswersChange, hintPoints, hintedSlots, onUseHint, masterMode }) {
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
  const [answerCardHeight, setAnswerCardHeight] = useState(0);
  const [showClearModal, setShowClearModal] = useState(false);
  const hasShownClearRef = useRef(getFilledCellCount(crosswordMap, initialAnswers || {}) === getOpenCellCount(crosswordMap));
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const inputRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const wrongTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const effectiveWidth = Platform.OS === 'web' ? Math.min(windowWidth || 0, 480) : (windowWidth || 0);
  const boardWidth = Math.max(200, effectiveWidth - 32);
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
  const exactBoardWidth = cellSize * (crosswordMap.width || 1) + 4;
  const boardHeight = cellSize * (crosswordMap.height || 1) + 4;

  useEffect(() => {
    onAnswersChange?.(crosswordMap.id, answers);
  }, [answers]);

  useEffect(() => {
    if (selectedSlot === null) return undefined;

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(focusTimer);
  }, [selectedSlot]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const input = inputRef.current;
    if (!input) return undefined;
    const onFocus = () => setIsKeyboardVisible(true);
    const onBlur = () => {
      const viewport = window.visualViewport;
      const baseHeight = baseHeightRef.current || window.innerHeight;
      const vh = viewport ? viewport.height : window.innerHeight;
      setIsKeyboardVisible(vh < baseHeight - 150);
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    return () => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
    };
  }, [selectedSlot]);

  const baseHeightRef = useRef(null);
  if (baseHeightRef.current === null && typeof window !== 'undefined') {
    baseHeightRef.current = window.innerHeight;
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const viewport = window.visualViewport;
    const baseHeight = baseHeightRef.current || window.innerHeight;

    const updateViewport = () => {
      const vh = viewport ? viewport.height : window.innerHeight;
      setWebViewportHeight(vh);
      setIsKeyboardVisible(vh < baseHeight - 150);
      window.scrollTo(0, 0);
    };

    updateViewport();
    if (viewport) {
      viewport.addEventListener('resize', updateViewport);
      viewport.addEventListener('scroll', updateViewport);
    }
    window.addEventListener('resize', updateViewport);
    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', updateViewport);
        viewport.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const frameEvent = Platform.OS === 'ios' ? 'keyboardDidChangeFrame' : 'keyboardDidChangeFrame';

    const subscriptions = [];

    subscriptions.push(Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height || 0);
    }));

    subscriptions.push(Keyboard.addListener(frameEvent, (e) => {
      if (e.endCoordinates) {
        setKeyboardHeight(e.endCoordinates.height || 0);
      }
    }));

    subscriptions.push(Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    }));

    return () => {
      subscriptions.forEach((s) => s.remove());
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
      if (!solved) {
        if (autoFill) {
          const offset = item.direction === 'across' ? colIndex - item.col : rowIndex - item.row;
          const letter = normalize(item.answer)[offset];
          if (letter) return { letter, preview: true };
        }
        continue;
      }
      const offset = item.direction === 'across' ? colIndex - item.col : rowIndex - item.row;
      const letter = normalize(solved)[offset];
      if (letter) return { letter, preview: false };
    }

    return { letter: '', preview: false };
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
  const hasActiveSlot = selectedSlot !== null && slot !== undefined;
  const activeStartY = (slot?.row || 0) * cellSize;
  const activeEndY = slot?.direction === 'down'
    ? activeStartY + (slot.length - 1) * cellSize
    : activeStartY;
  const activeCenterY = (activeStartY + activeEndY) / 2;
  const gridHeight = crosswordMap.grid.length * cellSize;
  const layerBelow = activeCenterY < gridHeight / 2;

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
    <ImageBackground
      source={BG_IMAGE}
      resizeMode="cover"
      style={[styles.safeArea, Platform.OS === 'web' && styles.webSafeArea]}
    >
      <StatusBar barStyle="dark-content" />
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
              {(masterMode || isMasterMode) && (
                <View style={styles.autoFillBox}>
                  <Text style={styles.autoFillLabel}>정답 보기</Text>
                  <Switch
                    value={autoFill}
                    onValueChange={toggleAutoFill}
                    trackColor={{ false: '#e0d8c8', true: '#c8b898' }}
                    thumbColor={autoFill ? '#7a5c3a' : '#fdfbf6'}
                    accessibilityLabel="정답 자동 채우기"
                  />
                </View>
              )}
            </View>
          )}

          <Pressable
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}
            onPress={() => {
              if (selectedSlot !== null) {
                setSelectedSlot(null);
                setInput('');
                setIsCorrect(false);
                setIsWrong(false);
                inputRef.current?.blur();
              }
            }}
          >
          <View
            style={[
              styles.boardArea,
              {
                width: exactBoardWidth,
                height: boardHeight,
                justifyContent: 'flex-start',
                position: 'relative',
              },
            ]}
          >
            <View style={[styles.boardClip, { width: exactBoardWidth, height: boardHeight, boxSizing: 'border-box' }]}>
              <View style={styles.board}>
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
                            (() => {
                              const { letter, preview } = getCellText(rowIndex, colIndex);
                              if (!letter) return null;
                              return (
                                <Text style={[styles.cellText, { fontSize: Math.max(12, Math.floor(cellSize * 0.55)) }, preview && styles.previewText]}>
                                  {letter}
                                </Text>
                              );
                            })()
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {hasActiveSlot && (
              <View
                style={[
                  styles.answerCardContainer,
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    [layerBelow ? 'bottom' : 'top']: 0,
                  },
                  isKeyboardVisible && {
                    [layerBelow ? 'bottom' : 'top']: Platform.OS === 'web'
                      ? Math.max(0, (windowHeight || window.innerHeight) - (webViewportHeight || windowHeight || window.innerHeight))
                      : keyboardHeight,
                  },
                ]}
                pointerEvents="auto"
                onLayout={(e) => setAnswerCardHeight(e.nativeEvent.layout.height)}
              >
                <AnswerCard
                  slot={slot}
                  selectedSlot={selectedSlot}
                  answers={answers}
                  input={input}
                  setInput={(text) => {
                    setInput(text);
                    setIsCorrect(false);
                    setIsWrong(false);
                  }}
                  inputKey={inputKey}
                  isCorrect={isCorrect}
                  isWrong={isWrong}
                  isHinted={isHinted}
                  clue={clue}
                  hintReferences={hintReferences}
                  hintPoints={hintPoints}
                  shakeAnim={shakeAnim}
                  fadeAnim={fadeAnim}
                  translateYAnim={translateYAnim}
                  onUseHint={(slotIndex) => onUseHint?.(crosswordMap.id, slotIndex)}
                  onSubmit={submitAnswer}
                  onClearInput={() => {
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
                  onFocusInput={() => {
                    if (Platform.OS !== 'web') setIsKeyboardVisible(true);
                    if (Platform.OS === 'web') {
                      const resetScroll = () => window.scrollTo(0, 0);
                      resetScroll();
                      setTimeout(resetScroll, 100);
                      setTimeout(resetScroll, 300);
                      setTimeout(resetScroll, 500);
                    }
                  }}
                  onBlurInput={() => {
                    if (Platform.OS !== 'web') setIsKeyboardVisible(false);
                  }}
                  inputRef={inputRef}
                />
              </View>
            )}
          </View>
          </Pressable>
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  webSafeArea: { maxWidth: 480, alignSelf: 'center', width: '100%' },
  flex: { flex: 1 },
  container: { flex: 1, padding: 16, position: 'relative' },
  answerCardContainer: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  backButton: { backgroundColor: '#f0ebe0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  backButtonText: { color: '#7a6450', fontSize: 12, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mapTitle: { flex: 1, color: '#2e2418', fontSize: 16, fontWeight: '800', marginHorizontal: 10 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { backgroundColor: '#ece6d8', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#7a5c3a', fontSize: 12, fontWeight: '700' },
  hintBadge: { backgroundColor: '#fdf0e3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  hintBadgeText: { color: '#e08a3c', fontSize: 12, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdfbf6', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e0d8c8' },
  progressColumn: { flex: 1, paddingRight: 12 },
  autoFillBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoFillLabel: { color: '#8a7560', fontSize: 12, fontWeight: '700' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#8a7560', fontSize: 13, fontWeight: '600' },
  progressValue: { color: '#7a5c3a', fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: '#e8e0d0', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#a8845a', borderRadius: 8 },
  boardArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  boardClip: { overflow: 'hidden', height: '100%' },
  board: {
    backgroundColor: '#fdfbf6',
  },
  boardClip: {
    overflow: 'hidden',
    height: '100%',
    borderWidth: 2,
    borderColor: '#7a5c3a',
    borderRadius: 8,
    shadowColor: '#3a2e1f',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  gridRow: { flexDirection: 'row' },
  cell: { width: 36, height: 36, borderWidth: 0.5, borderColor: '#d8cdb8', backgroundColor: '#fdfbf6', alignItems: 'center', justifyContent: 'center' },
  blockedCell: { backgroundColor: '#3a2e1f', borderColor: '#3a2e1f' },
  selectedCell: { backgroundColor: '#f0e8d8', borderColor: '#a8845a', borderWidth: 2 },
  cellText: { color: '#3a2e1f', fontSize: 20, fontWeight: '800' },
  previewText: { color: '#c8bba8' },
  clue: { color: '#34485d', fontSize: 13, lineHeight: 19 },
  check: { color: '#3c9a72', fontSize: 11, fontWeight: '800', marginLeft: 8 },
  clearModalOverlay: { flex: 1, backgroundColor: 'rgba(23, 37, 54, 0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  clearModalCard: { width: '100%', maxWidth: 360, backgroundColor: '#fdfbf6', borderRadius: 20, padding: 24, alignItems: 'center' },
  clearModalCloseButton: { position: 'absolute', top: 8, right: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clearModalCloseText: { color: '#8b98a5', fontSize: 24, lineHeight: 26, fontWeight: '500' },
  clearModalTitle: { color: '#7a5c3a', fontSize: 22, fontWeight: '800' },
  clearModalText: { color: '#8a7560', fontSize: 14, marginTop: 8, marginBottom: 20 },
  clearModalButton: { backgroundColor: '#7a5c3a', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  clearModalButtonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
});

export default PuzzleScreen;
