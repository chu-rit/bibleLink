import React, { useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import JamoKeyboard, { buildKeyStates } from './JamoKeyboard';
import { PAGE_ASPECT_RATIO, getPageWidth } from '../utils';
import challengeWordsData from '../data/words2/challengeWords.json';
import validWordsData from '../data/words2/validWords.json';

const BG_IMAGE = require('../assets/BG.png');
const MAX_ATTEMPTS = 4;
// 웹 하단 카카오 광고 배너(320x50)와 겹치지 않게 키보드를 올린다
const AD_BANNER_HEIGHT = 50;

const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VOWELS = ['ㅏ','ㅏㅣ','ㅑ','ㅑㅣ','ㅓ','ㅓㅣ','ㅕ','ㅕㅣ','ㅗ','ㅗㅏ','ㅗㅏㅣ','ㅗㅣ','ㅛ','ㅜ','ㅜㅓ','ㅜㅓㅣ','ㅜㅣ','ㅠ','ㅡ','ㅡㅣ','ㅣ'];
const FINALS = ['','ㄱ','ㄱㄱ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅅㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const INITIAL_EXPANSION = { 'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ' };
const ATOMIC_JAMO = /^[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ]$/;

function decomposeInput(text) {
  const result = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      const initial = INITIALS[Math.floor(code / 588)];
      result.push(...(INITIAL_EXPANSION[initial] || initial), ...VOWELS[Math.floor((code % 588) / 28)], ...FINALS[code % 28]);
    } else if (ATOMIC_JAMO.test(ch)) {
      result.push(ch);
    }
  }
  return result;
}

// 자모 수별 유효 추측 사전 (7~10자모, Lib1 합본 — buildValidWords.js 생성)
// 키보드 입력은 자모 단위라, 사전도 자모로 분해해 비교한다
const VALID_WORD_SETS = {
  7: new Set(validWordsData['7'].map((w) => decomposeInput(w).join(''))),
  8: new Set(validWordsData['8'].map((w) => decomposeInput(w).join(''))),
  9: new Set(validWordsData['9'].map((w) => decomposeInput(w).join(''))),
  10: new Set(validWordsData['10'].map((w) => decomposeInput(w).join(''))),
};

function getFeedback(guess, target) {
  const feedback = Array(guess.length).fill('gray');
  const usedTarget = Array(target.length).fill(false);
  guess.forEach((jamo, index) => {
    if (jamo === target[index]) {
      feedback[index] = 'green';
      usedTarget[index] = true;
    }
  });
  guess.forEach((jamo, index) => {
    if (feedback[index] === 'green') return;
    const targetIndex = target.findIndex((targetJamo, i) => !usedTarget[i] && targetJamo === jamo);
    if (targetIndex !== -1) {
      feedback[index] = 'yellow';
      usedTarget[targetIndex] = true;
    }
  });
  return feedback;
}

// 테스트용 하드코딩 단어 — 서버 출제 연동 전까지 임시로 사용한다
// KST 23시(하루 경계) 기준으로 번갈아 출제해 날짜 전환을 테스트할 수 있다
const TEST_WORDS = ['게하시', '므깃도'];
const TEST_ENTRIES = TEST_WORDS.map((name) => challengeWordsData.find((w) => w.name === name)).filter(Boolean);

function getTestEntry() {
  // 하루 경계를 KST 23시로 맞추기 위해 +10시간 시프트 후 UTC 날짜 번호를 구한다
  const shifted = new Date(Date.now() + 10 * 60 * 60 * 1000);
  const dayIndex = Math.floor(shifted.getTime() / (24 * 60 * 60 * 1000));
  return TEST_ENTRIES[dayIndex % TEST_ENTRIES.length] || challengeWordsData[0];
}

export default function ChallengeWordScreen({ onBack }) {
  const [entry] = useState(getTestEntry);
  const [guesses, setGuesses] = useState([]);
  const [input, setInput] = useState('');
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const inputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const effectiveWidth = isWeb ? getPageWidth(windowWidth, windowHeight) : windowWidth;
  const viewportHeight = isWeb ? Math.min(Math.round(effectiveWidth * PAGE_ASPECT_RATIO), windowHeight) : windowHeight;

  const target = useMemo(() => decomposeInput(entry.name), [entry]);
  const inputJamo = useMemo(() => decomposeInput(input.normalize('NFC')), [input]);
  const solved = guesses.length > 0 && guesses[guesses.length - 1].states.every((s) => s === 'green');
  const visibleHints = Math.min(guesses.length - (solved ? 1 : 0), 3);
  const hints = [entry.hint1, entry.hint2, entry.hint3];

  // 입력 검증 실패 등은 토스트로 띄워 확실히 눈에 띄게 한다
  const showToast = (text) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1600);
  };

  const submitGuess = () => {
    if (over) return;
    // 합용 자모(U+1100대)는 NFC 정규화로 완성형으로 조합하고, 공백·제로폭 문자는 제거
    const word = input.replace(/[\s​-‍﻿]/g, '').normalize('NFC');
    if (!word) return;
    if (!/^[가-힣ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ]+$/.test(word)) {
      showToast('한글로 입력하세요.');
      return;
    }
    const values = decomposeInput(word);
    if (values.length !== target.length) {
      showToast(`자모 ${target.length}개인 단어를 입력하세요.`);
      return;
    }
    if (!VALID_WORD_SETS[target.length]?.has(values.join(''))) {
      showToast('사전에 없는 단어입니다.');
      return;
    }
    const feedback = getFeedback(values, target);
    const next = [...guesses, { values, states: feedback }];
    const success = feedback.every((s) => s === 'green');
    const done = success || next.length >= MAX_ATTEMPTS;
    const nextMessage = done ? (success ? '정답입니다!' : `정답은 ${entry.name}입니다.`) : '';
    setGuesses(next);
    setInput('');
    setOver(done);
    setWon(success);
    setMessage(nextMessage);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const renderCell = (jamo, state, key, active) => (
    <View key={key} style={[styles.cell, styles[`cell_${state}`], active && styles.cellActive]}>
      <Text style={[styles.cellText, styles[`cellText_${state}`]]}>{jamo}</Text>
    </View>
  );

  // 커스텀 자모 키보드: 자모 1개씩 추가/삭제 (시스템 키보드는 띄우지 않는다)
  const pressJamo = (jamo) => {
    if (over || inputJamo.length >= target.length) return;
    setInput((prev) => prev + jamo);
  };

  const backspace = () => {
    if (over || !inputJamo.length) return;
    setInput(inputJamo.slice(0, -1).join(''));
  };

  const renderBoard = () => (
    <View style={styles.inputRowWrap}>
      <View style={styles.history}>
        {guesses.map((guess, r) => (
          <View key={r} style={styles.row}>
            {target.map((_, c) => renderCell(guess.values[c], guess.states[c], c))}
          </View>
        ))}
        {!over && (
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View style={styles.row}>
              {target.map((_, c) => {
                const jamo = inputJamo[c] || '';
                const active = c === Math.min(inputJamo.length, target.length - 1);
                return renderCell(jamo, 'empty', c, active && !jamo);
              })}
            </View>
          </Pressable>
        )}
      </View>
      {!over && (
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          caretHidden
          inputMode="none"
          showSoftInputOnFocus={false}
          returnKeyType="done"
          onSubmitEditing={submitGuess}
          style={styles.hiddenInput}
        />
      )}
    </View>
  );

  return (
    <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
    <ImageBackground
      source={BG_IMAGE}
      resizeMode="cover"
      style={[styles.container, { paddingTop: insets.top }, isWeb && { height: viewportHeight, width: '100%', maxWidth: effectiveWidth, alignSelf: 'center' }]}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader onBack={onBack} />

        <View style={styles.centerWrap}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.panel}>
            <Text style={styles.modeLabel}>오늘의 단어 챌린지 (테스트)</Text>
            {renderBoard()}

            {hints.slice(0, visibleHints).map((hint, i) => (
              <View key={i} style={styles.hintCard}>
                <Text style={styles.hintLabel}>힌트 {i + 1}</Text>
                <Text style={styles.hintText}>{hint}</Text>
              </View>
            ))}

            <View style={styles.actions}>
              <View style={styles.statusWrap}>
                {message ? <Text style={styles.status}>{message}</Text> : null}
                <Text style={styles.attempts}>
                  <Text style={styles.attemptsCount}>{guesses.length}</Text>
                  {`/${MAX_ATTEMPTS}회 시도`}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                {!over && (
                  <Pressable onPress={submitGuess} style={styles.button}>
                    <Text style={styles.buttonText}>입력</Text>
                  </Pressable>
                )}
              </View>
            </View>
            </View>
          </ScrollView>
        </View>

        {!over && (
          <View style={[styles.keyboardWrap, isWeb && { marginBottom: AD_BANNER_HEIGHT }]}>
            {toast ? (
              <View style={styles.toast} pointerEvents="none">
                <Text style={styles.toastText}>{toast}</Text>
              </View>
            ) : null}
            <JamoKeyboard
              keyStates={buildKeyStates(guesses)}
              onKey={pressJamo}
              onBackspace={backspace}
              disabled={over}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  centerWrap: { flex: 1, justifyContent: 'center' },
  modeLabel: { color: '#e08a3c', fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 16, paddingBottom: 20 },
  panel: { backgroundColor: 'rgba(253, 251, 246, 0.88)', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 20, padding: 20, shadowColor: '#3a2e1f', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  history: { marginBottom: 8 },
  row: { flexDirection: 'row', marginBottom: 8 },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 56, marginHorizontal: 4, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cell_empty: { borderColor: '#d8cdb8', backgroundColor: '#fdfbf6' },
  cellActive: { borderColor: '#7a5c3a' },
  cell_green: { borderColor: '#3c9a72', backgroundColor: '#3c9a72' },
  cell_yellow: { borderColor: '#e08a3c', backgroundColor: '#e08a3c' },
  cell_gray: { borderColor: '#b8a88f', backgroundColor: '#b8a88f' },
  cellText: { fontSize: 24, fontWeight: '400', color: '#3a2e1f', fontFamily: 'NotoSansKR' },
  cellText_empty: { color: '#3a2e1f' },
  cellText_green: { color: '#fdfbf6' },
  cellText_yellow: { color: '#fdfbf6' },
  cellText_gray: { color: '#fdfbf6' },
  inputRowWrap: { position: 'relative' },
  keyboardWrap: { position: 'relative' },
  toast: { position: 'absolute', bottom: '100%', marginBottom: 8, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  toastText: { backgroundColor: '#3a2e1f', color: '#fdfbf6', fontSize: 14, fontWeight: '800', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, overflow: 'hidden', shadowColor: '#3a2e1f', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  hintCard: { backgroundColor: '#f7f2e8', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 10, padding: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  hintLabel: { color: '#e08a3c', fontSize: 11, fontWeight: '800', marginRight: 8 },
  hintText: { color: '#3a2e1f', fontSize: 14, fontWeight: '700', lineHeight: 20, flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 },
  statusWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  status: { color: '#7a6450', fontSize: 13 },
  attempts: { color: '#7a6450', fontSize: 15, fontWeight: '700' },
  attemptsCount: { color: '#7a5c3a', fontSize: 26, fontWeight: '800' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#7a5c3a' },
  buttonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
});
