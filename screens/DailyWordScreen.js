import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import AppHeader from '../components/AppHeader';
import WordHelpModal from '../components/WordHelpModal';
import DailyWordSettingsScreen from './DailyWordSettingsScreen';
import ChallengeWordScreen from './ChallengeWordScreen';
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
const COMPATIBILITY_JAMO = {
  'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ',
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
  'ㅐ': 'ㅏㅣ', 'ㅒ': 'ㅑㅣ', 'ㅔ': 'ㅓㅣ', 'ㅖ': 'ㅕㅣ', 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅏㅣ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅓㅣ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ',
};

function decomposeInput(text) {
  const result = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      const initial = INITIALS[Math.floor(code / 588)];
      result.push(...(COMPATIBILITY_JAMO[initial] || initial), ...VOWELS[Math.floor((code % 588) / 28)], ...FINALS[code % 28]);
    } else if (/^[ㄱ-ㅎㅏ-ㅣ]$/.test(ch)) {
      result.push(...(COMPATIBILITY_JAMO[ch] || ch));
    }
  }
  return result;
}

function normalizeInput(value) {
  return value.replace(/[\s\u200B-\u200D\uFEFF]/g, '').normalize('NFC');
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
    entryPromise = getTodayWord().then((result) => {
      currentEntry = result.entry;
      return result;
    });
  }
  return entryPromise;
}

export default function DailyWordScreen({ onBack, masterMode, isActive }) {
  const [entry, setEntry] = useState(currentEntry);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [guesses, setGuesses] = useState([]);
  const [input, setInput] = useState('');
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [showRankings, setShowRankings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [challengeMode, setChallengeMode] = useState(false);
  const [settingsPrompt, setSettingsPrompt] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [rankingDate, setRankingDate] = useState(null);
  const [streak, setStreak] = useState(0);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const startedAtRef = useRef(Date.now());
  const toastTimerRef = useRef(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const effectiveWidth = isWeb ? getPageWidth(windowWidth, windowHeight) : windowWidth;
  const viewportHeight = isWeb ? Math.min(Math.round(effectiveWidth * PAGE_ASPECT_RATIO), windowHeight) : windowHeight;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    let mounted = true;
    getCurrentEntry().then(async ({ entry: loaded }) => {
      if (!mounted) return;
      if (!loaded) {
        setLoadFailed(true);
        return;
      }
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

  // 화면 진입 때마다 서버 시간을 다시 맞추고, 서버 기준 오늘 단어와 다르면 새 문제로 교체한다
  // (PageFlipper가 페이지를 미리 마운트해두어 최초 로드 이후 날짜가 바뀔 수 있다)
  useEffect(() => {
    if (!isActive || !entry) return undefined;
    let mounted = true;
    getTodayWord().then(({ entry: fresh, source }) => {
      if (!mounted) return;
      // 서버가 이 버전에 없는 단어를 지정하면 다른 문제를 풀 수 없게 차단한다
      if (source === 'stale') {
        setEntry(null);
        setLoadFailed(true);
        return;
      }
      if (!fresh || fresh.id === entry.id) return;
      applyFreshEntry(fresh);
    });
    return () => { mounted = false; };
  }, [isActive]);

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
  const handleInputChange = (value) => {
    const normalized = normalizeInput(value);
    if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ]*$/.test(normalized)) {
      setInput(normalized);
      return;
    }
    const values = decomposeInput(normalized);
    setInput(values.length > target.length ? values.slice(0, target.length).join('') : normalized);
  };
  const solved = guesses.length > 0 && guesses[guesses.length - 1].states.every((s) => s === 'green');
  const visibleHints = Math.min(guesses.length - (solved ? 1 : 0), 3);

  // 업데이트 유도 화면의 새로고침 — OTA가 있으면 받아서 적용하고 재시작한다
  const reloadApp = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      if (Platform.OS === 'web') {
        window.location.reload();
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setReloading(false);
    }
  };

  if (!entry) {
    return (
      <ImageBackground
        source={BG_IMAGE}
        resizeMode="cover"
        style={[styles.container, isWeb && { height: viewportHeight, width: '100%', maxWidth: effectiveWidth, alignSelf: 'center' }]}
      >
        <AppHeader onBack={onBack} />
        <View style={styles.loadingWrap}>
          <Text style={styles.status}>{loadFailed ? '앱 업데이트가 필요합니다.' : '불러오는 중...'}</Text>
          {loadFailed && (
            <Pressable style={styles.reloadBtn} onPress={reloadApp} disabled={reloading}>
              <Text style={styles.reloadBtnText}>{reloading ? '업데이트 확인 중...' : '새로고침'}</Text>
            </Pressable>
          )}
        </View>
      </ImageBackground>
    );
  }

  // 서버 기준 오늘 단어가 바뀌었을 때 새 문제로 교체하고 진행 내역을 초기화한다
  const applyFreshEntry = async (fresh) => {
    currentEntry = fresh;
    entryPromise = Promise.resolve({ entry: fresh, source: 'remote' });
    setEntry(fresh);
    setGuesses([]);
    setOver(false);
    setWon(false);
    setMessage('');
    setInput('');
    startedAtRef.current = Date.now();
    const saved = await loadGameState(todayKey(), fresh.id);
    if (saved) {
      setGuesses(saved.guesses || []);
      setOver(Boolean(saved.over));
      setWon(Boolean(saved.won));
      setMessage(saved.over && !saved.won ? saved.message || '' : '');
      if (saved.startedAt) startedAtRef.current = saved.startedAt;
    }
    setStreak(await getDailyStreak());
  };

  // 챌린지 모드로 전환 — 뒤로 가면 일일 모드로 복귀한다
  if (challengeMode) {
    return <ChallengeWordScreen onBack={() => setChallengeMode(false)} masterMode={masterMode} />;
  }

  const hints = [entry.hint1, entry.hint2, entry.hint3];

  // 입력 검증 실패 등은 토스트로 띄워 확실히 눈에 띄게 한다
  const showToast = (text) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1600);
  };

  const submitGuess = async () => {
    if (over) return;
    // 시도할 때마다 서버 시간으로 오늘 문제가 맞는지 확인 — 날짜가 바뀌었으면 새 문제로 교체
    const { entry: fresh, source } = await getTodayWord();
    if (source === 'stale') {
      setEntry(null);
      setLoadFailed(true);
      return;
    }
    if (fresh && fresh.id !== entry.id) {
      showToast('오늘의 문제가 아닙니다. 다시 불러옵니다.');
      // 토스트가 보일 시간을 주고 서버 연결 상태로 앱을 새로고침한다
      setTimeout(() => reloadApp(), 900);
      return;
    }
    // 합용 자모(U+1100대)는 NFC 정규화로 완성형으로 조합하고, 공백·제로폭 문자는 제거
    const word = normalizeInput(input);
    if (!word) return;
    if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ]+$/.test(word)) {
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
    // 정답을 맞췄을 때 서버 기준으로 재검증 — 오늘 문제가 맞고 입력 정답과 서버 정답이
    // 일치할 때만 랭킹 등록·연승 갱신을 진행한다. 하나라도 다르면 새 문제로 교체
    if (success) {
      let serverEntry = fresh;
      // 조회가 순간 실패한 경우 한 번 더 시도 — 확인 불가와 문제 불일치를 섞지 않는다
      if (!serverEntry) ({ entry: serverEntry } = await getTodayWord());
      if (!serverEntry) {
        showToast('서버와 연결할 수 없습니다. 잠시 후 다시 시도하세요.');
        return;
      }
      // 자모 키보드 입력은 날자모(ㅂㅏㄹㄹㅏㅁ)라 문자열 비교가 안 되므로 자모 분해로 비교한다
      const serverWord = String(serverEntry.name).replace(/[\s​-‍﻿]/g, '').normalize('NFC');
      if (serverEntry.id !== entry.id || values.join('') !== decomposeInput(serverWord).join('')) {
        showToast('오늘의 문제가 아닙니다. 다시 불러옵니다.');
        setTimeout(() => reloadApp(), 900);
        return;
      }
    }
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
    if (over) return;
    setInput((prev) => (decomposeInput(prev.normalize('NFC')).length < target.length ? prev + jamo : prev));
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
          onChangeText={handleInputChange}
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

            {over && (
            <Pressable onPress={() => setChallengeMode(true)} style={({ pressed }) => [styles.challengeButton, pressed && styles.challengeButtonPressed]}>
              <View style={styles.challengeButtonInner}>
                <Text style={styles.challengeEyebrow}>CHALLENGE</Text>
                <Text style={styles.challengeTitle}>오늘의 단어 챌린지</Text>
              </View>
              <Text style={styles.challengeArrow}>›</Text>
            </Pressable>
            )}
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
        <WordHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
      </KeyboardAvoidingView>
    </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  centerWrap: { flex: 1, justifyContent: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reloadBtn: { marginTop: 16, backgroundColor: '#3a2e1f', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  reloadBtnText: { color: '#fdfbf6', fontSize: 15, fontWeight: '600' },
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
  streak: { color: '#e08a3c', fontSize: 12, fontWeight: '800' },
  resetButton: { borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f0ebe0' },
  resetButtonText: { color: '#7a6450', fontSize: 14, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#7a5c3a' },
  buttonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
  challengeButton: { marginTop: 14, backgroundColor: '#f0ebe0', borderRadius: 16, borderWidth: 1, borderColor: '#d8cdb8', paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#3a2e1f', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  challengeButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  challengeButtonInner: { flex: 1 },
  challengeEyebrow: { color: '#e08a3c', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  challengeTitle: { color: '#3a2e1f', fontSize: 17, fontWeight: '900', marginTop: 2 },

  challengeArrow: { color: '#e08a3c', fontSize: 26, fontWeight: '700', marginLeft: 10 },
});
