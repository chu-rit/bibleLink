import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import AppHeader from '../components/AppHeader';
import DailyWordSettingsScreen from './DailyWordSettingsScreen';
import JamoKeyboard, { buildKeyStates } from './JamoKeyboard';
import RankingScreen from './RankingScreen';
import { clearGameState, fetchRankings, fetchStreakBeforeToday, getDailyStreak, getOrCreateUser, getTodayWord, getUser, loadGameState, overrideDailyStreak, recordDailyResult, saveGameState, submitResult, todayKey } from '../utils/dailyWord';
import { PAGE_ASPECT_RATIO, getPageWidth } from '../utils';
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

// 자모 수별 유효 추측 사전 (5word/6word.txt + Lib1 합본, buildValidWords.js 생성)
// 키보드 입력은 자모 단위라, 사전도 자모로 분해해 비교한다
const VALID_WORD_SETS = {
  5: new Set(validWordsData['5'].map((w) => decomposeInput(w).join(''))),
  6: new Set(validWordsData['6'].map((w) => decomposeInput(w).join(''))),
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

// 페이지 플리퍼가 같은 페이지를 여러 인스턴스로 렌더링하므로
// 인스턴스 간 단어가 달라지는 깜빡임을 막기 위해 선택 단어를 공유한다
// 여러 인스턴스가 동시에 마운트되어도 닉네임 유도 모달은 한 번만 뜬다
let nicknamePromptShown = false;

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

export default function DailyWordScreen({ onBack, masterMode, isActive }) {
  const [entry, setEntry] = useState(currentEntry);
  const [guesses, setGuesses] = useState([]);
  const [input, setInput] = useState('');
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [showRankings, setShowRankings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [settingsPrompt, setSettingsPrompt] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [rankingDate, setRankingDate] = useState(null);
  const [streak, setStreak] = useState(0);
  const inputRef = useRef(null);
  const startedAtRef = useRef(Date.now());
  const toastTimerRef = useRef(null);
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
        setMessage(saved.over && !saved.won ? saved.message || '' : '');
        if (saved.startedAt) startedAtRef.current = saved.startedAt;
      }
      const currentStreak = await getDailyStreak();
      if (mounted) setStreak(currentStreak);
    });
    return () => { mounted = false; };
  }, []);

  // 닉네임 미설정(NONAME)이면 화면 진입 시 닉네임 설정부터 유도
  // PageFlipper가 모든 페이지를 미리 마운트하므로 실제 활성화된 경우에만 검사한다
  useEffect(() => {
    if (!isActive) {
      nicknamePromptShown = false;
      return undefined;
    }
    if (nicknamePromptShown) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      getUser().then((user) => {
        if (cancelled || nicknamePromptShown) return;
        if (!user?.nickname || user.nickname === 'NONAME') {
          nicknamePromptShown = true;
          setSettingsPrompt(true);
          setShowSettings(true);
        }
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isActive]);

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

  // 입력 검증 실패 등은 토스트로 띄워 확실히 눈에 띄게 한다
  const showToast = (text) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1600);
  };

  const submitGuess = () => {
    if (over) return;
    // 합용 자모(U+1100대)는 NFC 정규화로 완성형으로 조합하고, 공백·제로폭 문자는 제거
    const word = input.replace(/[\s\u200B-\u200D\uFEFF]/g, '').normalize('NFC');
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
    const nextMessage = done && !success ? `정답은 ${entry.name}입니다.` : '';
    setGuesses(next);
    setInput('');
    setOver(done);
    setWon(success);
    setMessage(nextMessage);
    saveGameState(todayKey(), { wordId: entry.id, guesses: next, over: done, won: success, message: nextMessage, startedAt: startedAtRef.current });
    if (done) finishGame(next.length, success);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // 게임 종료 시 연승 갱신 후, 정답이면 랭킹 등록 후 순위판 표시
  const finishGame = async (attempts, success) => {
    const dateKey = todayKey();
    const nextStreak = await recordDailyResult(dateKey, success);
    setStreak(await getDailyStreak(dateKey));
    if (!success) return;
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
    const user = await getOrCreateUser();
    const nickname = user?.nickname || 'NONAME';
    // 테스트용 MASTER 닉네임은 랭킹에 등록하지 않는다
    if (nickname !== 'MASTER') {
      // 랭킹에 등록하는 연승은 서버 이력으로 계산 — 과거 날짜 소급이 불가능해 조작보다 신뢰할 수 있다
      // 조회 실패 시 로컬 연승으로 폴백
      const priorStreak = await fetchStreakBeforeToday(user.userId);
      const streakToSubmit = priorStreak !== null ? priorStreak + 1 : nextStreak;
      if (priorStreak !== null) {
        await overrideDailyStreak(dateKey, streakToSubmit);
        setStreak(streakToSubmit);
      }
      const registered = await submitResult(dateKey, { userId: user.userId, nickname, attempts, success, duration, streak: streakToSubmit });
      if (!registered.ok) {
        setMessage(`랭킹 등록에 실패했습니다. (${registered.error})`);
        return;
      }
    }
    const result = await fetchRankings(dateKey, user.userId);
    setRankings(result.rankings);
    setMyRank(result.myRank);
    setRankingDate(dateKey);
    setShowRankings(true);
  };

  const loadRankings = async (dateKey) => {
    setRankings(null);
    setMyRank(null);
    const user = await getUser();
    const result = await fetchRankings(dateKey, user?.userId);
    setRankings(result.rankings);
    setMyRank(result.myRank);
  };

  const openRankings = () => {
    const dateKey = todayKey();
    setRankingDate(dateKey);
    setShowRankings(true);
    loadRankings(dateKey);
  };

  const selectRankingDate = (dateKey) => {
    setRankingDate(dateKey);
    loadRankings(dateKey);
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
    <ImageBackground
      source={BG_IMAGE}
      resizeMode="cover"
      style={[styles.container, isWeb && { height: viewportHeight, width: '100%', maxWidth: effectiveWidth, alignSelf: 'center' }]}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader onBack={onBack} onHelp={() => setShowHelp(true)} onSettings={() => { setSettingsPrompt(false); setShowSettings(true); }} />

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
                {streak > 0 && <Text style={styles.streak}>{streak}번째 연승중!</Text>}
              </View>
              <View style={styles.actionButtons}>
                {masterMode && (
                  <Pressable onPress={resetGame} style={styles.resetButton}>
                    <Text style={styles.resetButtonText}>초기화</Text>
                  </Pressable>
                )}
                {!over && (
                  <Pressable onPress={submitGuess} style={styles.button}>
                    <Text style={styles.buttonText}>입력</Text>
                  </Pressable>
                )}
                <Pressable onPress={openRankings} style={styles.button}>
                  <Text style={styles.buttonText}>랭킹</Text>
                </Pressable>
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

        <RankingScreen
          visible={showRankings}
          rankings={rankings}
          myRank={myRank}
          dateKey={rankingDate}
          onSelectDate={selectRankingDate}
          onClose={() => setShowRankings(false)}
        />
        <DailyWordSettingsScreen
          visible={showSettings}
          prompt={settingsPrompt}
          onClose={() => setShowSettings(false)}
        />
        <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
          <View style={styles.helpOverlay}>
            <View style={styles.helpCard}>
              <View style={styles.helpHeader}>
                <View>
                  <Text style={styles.helpEyebrow}>DAILY WORD</Text>
                  <Text style={styles.helpTitle}>게임 방법</Text>
                </View>
                <Pressable style={styles.helpCloseIcon} onPress={() => setShowHelp(false)} hitSlop={8}>
                  <Text style={styles.helpCloseIconText}>×</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.helpList} contentContainerStyle={styles.helpListContent}>
                <View style={styles.helpItem}>
                  <Text style={styles.helpItemTitle}>색상의 의미</Text>
                  <View style={styles.helpLegendItem}>
                    <View style={[styles.helpDot, styles.cell_green]} />
                    <Text style={styles.helpItemText}>자모와 위치가 모두 맞음</Text>
                  </View>
                  <View style={styles.helpLegendItem}>
                    <View style={[styles.helpDot, styles.cell_yellow]} />
                    <Text style={styles.helpItemText}>자모는 맞지만 위치가 다름</Text>
                  </View>
                  <View style={styles.helpLegendItem}>
                    <View style={[styles.helpDot, styles.cell_gray]} />
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
                  <Text style={styles.helpItemTitle}>연속 정답</Text>
                  <Text style={styles.helpItemText}>매일 정답을 맞히면 연속 기록이 쌓입니다. 하루를 건너뛰거나 맞히지 못하면 초기화됩니다.</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  cellText: { fontSize: 24, fontWeight: '700', color: '#3a2e1f', fontFamily: 'UhBeeGmin2' },
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
  streak: { color: '#e08a3c', fontSize: 12, fontWeight: '800' },
  resetButton: { borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f0ebe0' },
  resetButtonText: { color: '#7a6450', fontSize: 14, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#7a5c3a' },
  buttonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
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

});
