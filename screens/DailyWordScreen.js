import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import AppHeader from '../components/AppHeader';
import { clearGameState, ensureAuthUser, fetchRankings, getTodayWord, getUser, loadGameState, saveGameState, saveUser, submitResult, todayKey } from '../utils/dailyWord';
import { PAGE_ASPECT_RATIO, getPageWidth } from '../utils';

const BG_IMAGE = require('../assets/BG.png');
const MAX_ATTEMPTS = 4;

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

// 페이지 플리퍼가 같은 페이지를 여러 인스턴스로 렌더링하므로
// 인스턴스 간 단어가 달라지는 깜빡임을 막기 위해 선택 단어를 공유한다
let currentEntry = null;
let entryPromise = null;
function getCurrentEntry() {
  if (!entryPromise) {
    entryPromise = getTodayWord().then(({ entry }) => {
      currentEntry = entry;
      return entry;
    });
  }
  return entryPromise;
}

export default function DailyWordScreen({ onBack, masterMode }) {
  const [entry, setEntry] = useState(currentEntry);
  const [guesses, setGuesses] = useState([]);
  const [input, setInput] = useState('');
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState('');
  const [showNickname, setShowNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [showRankings, setShowRankings] = useState(false);
  const [rankings, setRankings] = useState([]);
  const inputRef = useRef(null);
  const startedAtRef = useRef(Date.now());
  const pendingSubmitRef = useRef(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const effectiveWidth = isWeb ? getPageWidth(windowWidth, windowHeight) : windowWidth;
  const viewportHeight = isWeb ? Math.min(Math.round(effectiveWidth * PAGE_ASPECT_RATIO), windowHeight) : windowHeight;

  useEffect(() => {
    let mounted = true;
    getCurrentEntry().then(async (loaded) => {
      if (!mounted) return;
      setEntry(loaded);
      const saved = await loadGameState(todayKey(), loaded.id);
      if (mounted && saved) {
        setGuesses(saved.guesses || []);
        setOver(Boolean(saved.over));
        setWon(Boolean(saved.won));
        setMessage(saved.message || '');
        if (saved.startedAt) startedAtRef.current = saved.startedAt;
      }
    });
    return () => { mounted = false; };
  }, []);

  const target = useMemo(() => (entry ? decomposeInput(entry.name) : []), [entry]);
  const inputJamo = useMemo(() => decomposeInput(input.normalize('NFC')), [input]);
  const solved = guesses.length > 0 && guesses[guesses.length - 1].states.every((s) => s === 'green');
  const visibleHints = Math.min(guesses.length - (solved ? 1 : 0), 3);

  if (!entry) {
    return (
      <ImageBackground
        source={BG_IMAGE}
        resizeMode="cover"
        style={[styles.container, isWeb && { height: viewportHeight, width: '100%', maxWidth: effectiveWidth, alignSelf: 'center' }]}
      >
        <AppHeader onBack={onBack} />
        <View style={styles.loadingWrap}>
          <Text style={styles.status}>불러오는 중...</Text>
        </View>
      </ImageBackground>
    );
  }

  const hints = [entry.hint1, entry.hint2, entry.hint3];

  const submitGuess = () => {
    if (over) return;
    // 합용 자모(U+1100대)는 NFC 정규화로 완성형으로 조합하고, 공백·제로폭 문자는 제거
    const word = input.replace(/[\s\u200B-\u200D\uFEFF]/g, '').normalize('NFC');
    if (!word) return;
    if (!/^[가-힣ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ]+$/.test(word)) {
      setMessage('한글로 입력하세요.');
      return;
    }
    const values = decomposeInput(word);
    if (values.length !== target.length) {
      setMessage(`자모 ${target.length}개인 단어를 입력하세요. (입력한 단어: ${values.length}개)`);
      return;
    }
    const feedback = getFeedback(values, target);
    const next = [...guesses, { values, states: feedback }];
    const success = feedback.every((s) => s === 'green');
    const done = success || next.length >= MAX_ATTEMPTS;
    const nextMessage = success
      ? `정답입니다! ${next.length}번 만에 맞혔습니다.`
      : done ? `정답은 ${entry.name}입니다.` : '';
    setGuesses(next);
    setInput('');
    setOver(done);
    setWon(success);
    setMessage(nextMessage);
    saveGameState(todayKey(), { wordId: entry.id, guesses: next, over: done, won: success, message: nextMessage, startedAt: startedAtRef.current });
    if (done) finishGame(next.length, success);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // 게임 종료 시 랭킹 제출 — 닉네임이 없으면 먼저 묻는다
  const finishGame = async (attempts, success) => {
    const userId = await ensureAuthUser();
    if (!userId) return;
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
    const submit = (nickname) =>
      submitResult(todayKey(), { userId, nickname, attempts, success, duration });
    const user = await getUser();
    if (user?.userId === userId && user?.nickname) {
      submit(user.nickname);
    } else {
      pendingSubmitRef.current = submit;
      setShowNickname(true);
    }
  };

  const confirmNickname = async () => {
    const nickname = nicknameInput.trim();
    if (!nickname) return;
    const userId = await ensureAuthUser();
    if (userId) await saveUser({ userId, nickname });
    setShowNickname(false);
    await pendingSubmitRef.current?.(nickname);
    pendingSubmitRef.current = null;
  };

  const openRankings = async () => {
    setRankings(null);
    setShowRankings(true);
    setRankings(await fetchRankings(todayKey()));
  };

  // 마스터 모드 전용: 같은 단어로 다시 시작
  const resetGame = () => {
    clearGameState(todayKey());
    startedAtRef.current = Date.now();
    setGuesses([]);
    setInput('');
    setOver(false);
    setWon(false);
    setMessage('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const renderCell = (jamo, state, key, active) => (
    <View key={key} style={[styles.cell, styles[`cell_${state}`], active && styles.cellActive]}>
      <Text style={[styles.cellText, styles[`cellText_${state}`]]}>{jamo}</Text>
    </View>
  );

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
          returnKeyType="done"
          onSubmitEditing={submitGuess}
          style={styles.hiddenInput}
        />
      )}
    </View>
  );

  return (
    <ImageBackground
      source={BG_IMAGE}
      resizeMode="cover"
      style={[styles.container, isWeb && { height: viewportHeight, width: '100%', maxWidth: effectiveWidth, alignSelf: 'center' }]}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader onBack={onBack} />

        <View style={styles.centerWrap}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.panel}>
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
              {!over ? (
                <View style={styles.actionButtons}>
                  {masterMode && (
                    <Pressable onPress={resetGame} style={styles.resetButton}>
                      <Text style={styles.resetButtonText}>초기화</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={submitGuess} style={styles.button}>
                    <Text style={styles.buttonText}>입력</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actionButtons}>
                  <Pressable onPress={openRankings} style={styles.button}>
                    <Text style={styles.buttonText}>랭킹</Text>
                  </Pressable>
                </View>
              )}
            </View>
            </View>
          </ScrollView>
        </View>

        {showNickname && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>닉네임 입력</Text>
              <Text style={styles.modalDesc}>랭킹에 표시할 이름을 입력하세요.</Text>
              <TextInput
                style={styles.modalInput}
                value={nicknameInput}
                onChangeText={setNicknameInput}
                placeholder="닉네임"
                maxLength={12}
                autoFocus
                onSubmitEditing={confirmNickname}
              />
              <Pressable onPress={confirmNickname} style={styles.button}>
                <Text style={styles.buttonText}>확인</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        )}
        {showRankings && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>오늘의 랭킹</Text>
              <ScrollView style={styles.rankList}>
                {rankings === null ? (
                  <Text style={styles.modalDesc}>불러오는 중...</Text>
                ) : rankings.length === 0 ? (
                  <Text style={styles.modalDesc}>아직 기록이 없습니다.</Text>
                ) : (
                  rankings.map((r, i) => (
                    <View key={i} style={styles.rankRow}>
                      <Text style={styles.rankNum}>{i + 1}</Text>
                      <Text style={styles.rankName} numberOfLines={1}>{r.nickname}</Text>
                      <Text style={styles.rankInfo}>{r.success ? `${r.attempts}회` : '실패'} · {r.duration}초</Text>
                    </View>
                  ))
                )}
              </ScrollView>
              <Pressable onPress={() => setShowRankings(false)} style={styles.button}>
                <Text style={styles.buttonText}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        )}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  centerWrap: { flex: 1, justifyContent: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  cellText: { fontSize: 24, fontWeight: '700', color: '#3a2e1f' },
  cellText_empty: { color: '#3a2e1f' },
  cellText_green: { color: '#fdfbf6' },
  cellText_yellow: { color: '#fdfbf6' },
  cellText_gray: { color: '#fdfbf6' },
  inputRowWrap: { position: 'relative' },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  hintCard: { backgroundColor: '#f7f2e8', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 10, padding: 12, marginTop: 8 },
  hintLabel: { color: '#e08a3c', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  hintText: { color: '#3a2e1f', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 },
  statusWrap: { flex: 1 },
  status: { color: '#7a6450', fontSize: 13 },
  attempts: { color: '#7a6450', fontSize: 15, fontWeight: '700', marginTop: 4 },
  attemptsCount: { color: '#7a5c3a', fontSize: 26, fontWeight: '800' },
  resetButton: { borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f0ebe0' },
  resetButtonText: { color: '#7a6450', fontSize: 14, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#7a5c3a' },
  buttonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 340, backgroundColor: '#fdfbf6', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { color: '#3a2e1f', fontSize: 17, fontWeight: '800' },
  modalDesc: { color: '#7a6450', fontSize: 13 },
  modalInput: { borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#3a2e1f', fontSize: 15 },
  rankList: { maxHeight: 300 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rankNum: { width: 24, color: '#7a5c3a', fontSize: 14, fontWeight: '800' },
  rankName: { flex: 1, color: '#3a2e1f', fontSize: 14, fontWeight: '700' },
  rankInfo: { color: '#7a6450', fontSize: 13 },
});
