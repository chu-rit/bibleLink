import React, { useRef } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

function AnswerCard({
  slot,
  selectedSlot,
  answers,
  input,
  setInput,
  inputKey,
  isCorrect,
  isWrong,
  isHinted,
  clue,
  hintReferences,
  hintPoints,
  shakeAnim,
  fadeAnim,
  translateYAnim,
  onUseHint,
  onSubmit,
  onClearInput,
  onFocusInput,
  onBlurInput,
  inputRef,
  crossSlots,
  onToggleDirection,
}) {
  if (!slot) {
    return (
      <View style={styles.answerCard} pointerEvents="none">
        <View style={styles.emptySelection}>
          <Text style={styles.emptySelectionTitle}>퍼즐판의 칸을 눌러 보세요</Text>
          <Text style={styles.emptySelectionText} numberOfLines={2}>선택한 단어의 문제와 정답 입력칸이 이곳에 나타납니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.answerCard}>
      <View style={styles.selectedHeader}>
        <View style={styles.selectedHeaderLeft}>
          <Text style={styles.selectedDirection}>{slot.direction === 'across' ? '가로' : '세로'} {slot.number}번</Text>
          {crossSlots && crossSlots.length > 1 && (
            <Pressable onPress={onToggleDirection} style={styles.toggleButton}>
              {slot.direction === 'across' ? (
                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a5c3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 4L12 20" />
                  <Path d="M8 16L12 20L16 16" />
                </Svg>
              ) : (
                <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a5c3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M4 12L20 12" />
                  <Path d="M16 8L20 12L16 16" />
                </Svg>
              )}
              <Text style={styles.toggleButtonText}>전환</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.selectedHeaderRight}>
          {!isCorrect && (
            isHinted ? (
              <Text style={styles.hintReference} numberOfLines={2}>{hintReferences}</Text>
            ) : (
              <Pressable
                onPress={() => onUseHint?.(selectedSlot)}
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
            )
          )}
          {answers[selectedSlot] && <Text style={styles.check}>완료</Text>}
        </View>
      </View>
      <Text style={styles.clue}>{clue}</Text>
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
            }}
            placeholder="정답을 입력하세요"
            placeholderTextColor="#a89880"
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
            onFocus={onFocusInput}
            onBlur={onBlurInput}
            onSubmitEditing={onSubmit}
          />
          {input && (
            <Pressable
              onPress={onClearInput}
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
          onPress={onSubmit}
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
  );
}

const styles = StyleSheet.create({
  answerCard: {
    width: '100%',
    backgroundColor: 'rgba(253, 251, 246, 0.88)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0d8c8',
    shadowColor: '#3a2e1f',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  hintBox: { position: 'absolute', top: 4, right: 4, zIndex: 1, maxWidth: 160 },
  hintButton: { backgroundColor: '#e08a3c', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  hintButtonText: { color: '#fdfbf6', fontSize: 11, fontWeight: '800' },
  hintReference: { color: '#e08a3c', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  selectedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleButton: { backgroundColor: '#e0d8c8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.5, borderColor: '#7a5c3a', flexDirection: 'row', alignItems: 'center', gap: 3 },
  toggleButtonText: { color: '#7a5c3a', fontSize: 11, fontWeight: '800' },
  selectedDirection: { color: '#7a6450', fontSize: 12, fontWeight: '800' },
  check: { color: '#3c9a72', fontSize: 11, fontWeight: '800', marginLeft: 8 },
  clue: { color: '#5a4a35', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  answerInputWrap: { flex: 1, position: 'relative' },
  answerInput: { borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 12, paddingHorizontal: 12, height: 42, color: '#3a2e1f', fontSize: 16, backgroundColor: '#fdfbf6' },
  answerInputWithClear: { paddingRight: 36 },
  clearInputButton: { position: 'absolute', top: 1, right: 1, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clearInputButtonText: { color: '#a89880', fontSize: 24, lineHeight: 26, fontWeight: '500' },
  answerInputHidden: { color: 'transparent' },
  answerInputCorrect: { borderColor: '#3c9a72', backgroundColor: '#ece8dc' },
  answerInputWrong: { borderColor: '#d64545', backgroundColor: '#fdeaea' },
  wrongTextOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 12 },
  wrongText: { fontSize: 16, fontWeight: '600', color: '#d64545' },
  primaryButton: { backgroundColor: '#7a5c3a', borderRadius: 12, paddingHorizontal: 16, height: 42, alignItems: 'center', justifyContent: 'center' },
  primaryButtonCorrect: { backgroundColor: '#3c9a72' },
  primaryButtonWrong: { backgroundColor: '#d64545' },
  primaryButtonDisabled: { backgroundColor: '#c8b898' },
  primaryButtonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
  emptySelection: { alignItems: 'center' },
  emptySelectionTitle: { color: '#7a5c3a', fontSize: 14, fontWeight: '800' },
  emptySelectionText: { color: '#8a7560', fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },
});

export default AnswerCard;
