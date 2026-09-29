import React, { useEffect, useRef, useState } from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AppHeader from '../components/AppHeader';
import WordHelpModal from '../components/WordHelpModal';
import { drawHeadsUpWord } from '../utils/headsUp';

const BG_IMAGE = require('../assets/BG.png');
const POPULARITY_LEVELS = [1, 2, 3];
const CATEGORIES = [
  { id: '인물', label: '인물' },
  { id: '지명', label: '지명' },
];

export default function HeadsUpSetupScreen({ onBack }) {
  const [selectedPopularityLevels, setSelectedPopularityLevels] = useState([1]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [gameStage, setGameStage] = useState('setup');
  const [countdown, setCountdown] = useState(5);
  const [currentWord, setCurrentWord] = useState(null);
  const keepAwakeActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const effectiveWidth = windowWidth || 375;
  const pageHeight = isWeb ? (windowHeight || undefined) : undefined;
  const isLandscape = windowWidth > windowHeight;
  const canStart = selectedPopularityLevels.length > 0 && selectedCategories.length > 0;

  useEffect(() => {
    if (gameStage !== 'countdown') return undefined;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setGameStage('word');
      } else {
        setCountdown((previous) => previous - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, gameStage]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (keepAwakeActiveRef.current) {
        keepAwakeActiveRef.current = false;
        deactivateKeepAwake('heads-up-word').catch(() => {});
      }
    };
  }, []);

  const togglePopularityLevel = (level) => {
    setMessage('');
    setSelectedPopularityLevels((previous) => previous.includes(level)
      ? previous.filter((selected) => selected !== level)
      : [...previous, level]);
  };

  const toggleCategory = (categoryId) => {
    setMessage('');
    setSelectedCategories((previous) => previous.includes(categoryId)
      ? previous.filter((selected) => selected !== categoryId)
      : [...previous, categoryId]);
  };

  const releaseKeepAwake = () => {
    if (!keepAwakeActiveRef.current) return;
    keepAwakeActiveRef.current = false;
    deactivateKeepAwake('heads-up-word').catch(() => {});
  };

  const handleStart = async () => {
    if (!canStart || isStarting) return;
    setIsStarting(true);
    setMessage('');
    const keepAwakeRequest = activateKeepAwakeAsync('heads-up-word')
      .then(async () => {
        if (!isMountedRef.current) {
          await deactivateKeepAwake('heads-up-word');
          return false;
        }
        keepAwakeActiveRef.current = true;
        return true;
      })
      .catch(() => false);
    try {
      const entry = await drawHeadsUpWord(selectedPopularityLevels, selectedCategories);
      const keepAwakeActive = await keepAwakeRequest;
      if (!isMountedRef.current) return;
      if (!entry) {
        if (keepAwakeActive) releaseKeepAwake();
        setMessage('선택한 조건에 맞는 단어가 아직 없어요.');
        return;
      }
      setCurrentWord(entry);
      setCountdown(5);
      setGameStage('countdown');
    } catch {
      const keepAwakeActive = await keepAwakeRequest;
      if (keepAwakeActive) releaseKeepAwake();
      if (isMountedRef.current) setMessage('서버에 연결할 수 없어요. 네트워크를 확인해 주세요.');
    } finally {
      if (isMountedRef.current) setIsStarting(false);
    }
  };

  return (
    <ImageBackground
      source={BG_IMAGE}
      resizeMode="cover"
      style={[styles.container, { paddingTop: insets.top }, isWeb && { height: pageHeight, width: '100%', maxWidth: effectiveWidth, alignSelf: 'center' }]}
    >
      <StatusBar barStyle="dark-content" />
      <AppHeader onBack={onBack} onHelp={gameStage === 'setup' ? () => setShowHelp(true) : undefined} />
      {gameStage === 'setup' ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, isLandscape && styles.landscapeContent]}>
          <View style={[styles.titleWrap, isLandscape && styles.landscapeTitleWrap]}>
            <Text style={styles.eyebrow}>HEADS UP</Text>
            <Text style={styles.title}>헤드업 설정</Text>
            <Text style={styles.description}>인지도 단계와 카테고리를 하나 이상 선택하세요.</Text>
          </View>

          <View style={isLandscape ? styles.landscapeSections : undefined}>
            <View style={[styles.section, isLandscape && styles.landscapeSection]}>
              <Text style={styles.sectionTitle}>인지도 단계</Text>
              <View style={styles.optionRow}>
                {POPULARITY_LEVELS.map((level) => {
                  const selected = selectedPopularityLevels.includes(level);
                  return (
                    <Pressable
                      key={level}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => togglePopularityLevel(level)}
                      style={({ pressed }) => [styles.option, styles.levelOption, selected && styles.optionSelected, pressed && styles.optionPressed]}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{level}단계</Text>
                      <Text style={[styles.selectionText, selected && styles.selectionTextSelected]}>{selected ? '선택됨' : '선택'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.section, isLandscape && styles.landscapeSection]}>
              <Text style={styles.sectionTitle}>카테고리</Text>
              <View style={styles.optionRow}>
                {CATEGORIES.map((category) => {
                  const selected = selectedCategories.includes(category.id);
                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleCategory(category.id)}
                      style={({ pressed }) => [styles.option, styles.categoryOption, selected && styles.optionSelected, pressed && styles.optionPressed]}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{category.label}</Text>
                      <Text style={[styles.selectionText, selected && styles.selectionTextSelected]}>{selected ? '선택됨' : '선택'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canStart || isStarting}
            onPress={handleStart}
            style={({ pressed }) => [styles.startButton, (!canStart || isStarting) && styles.startButtonDisabled, pressed && canStart && styles.startButtonPressed]}
          >
            <Text style={styles.startButtonText}>{isStarting ? '단어를 불러오는 중...' : '게임 시작'}</Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      ) : (
        <View style={[styles.gameStage, isWeb && { paddingBottom: 50 + insets.bottom }]}>
          <Text
            style={gameStage === 'countdown'
              ? styles.countdownText
              : [styles.gameWord, { fontSize: Math.min(effectiveWidth * 0.2, 72) }]}
          >
            {gameStage === 'countdown' ? countdown : currentWord?.name}
          </Text>
        </View>
      )}
      <WordHelpModal visible={showHelp} onClose={() => setShowHelp(false)} eyebrow="HEADS UP" variant="headsUp" />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: '100%' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 90 },
  landscapeContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  titleWrap: { alignItems: 'center', marginBottom: 30 },
  landscapeTitleWrap: { marginBottom: 12 },
  eyebrow: { color: '#e08a3c', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#3a2e1f', fontSize: 25, fontWeight: '800', marginTop: 7 },
  description: { color: '#7a6450', fontSize: 13, marginTop: 8 },
  section: { marginBottom: 24 },
  landscapeSections: { flexDirection: 'row', gap: 16 },
  landscapeSection: { flex: 1, marginBottom: 12 },
  sectionTitle: { color: '#3a2e1f', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  optionRow: { flexDirection: 'row', gap: 9 },
  option: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#d8cdb8', borderRadius: 12, backgroundColor: 'rgba(253, 251, 246, 0.9)', paddingHorizontal: 8, paddingVertical: 9 },
  levelOption: { minHeight: 68, gap: 4 },
  categoryOption: { minHeight: 68, gap: 4 },
  optionSelected: { borderColor: '#7a5c3a', backgroundColor: '#f0ebe0' },
  optionPressed: { opacity: 0.75 },
  optionText: { color: '#7a6450', fontSize: 15, fontWeight: '700' },
  optionTextSelected: { color: '#3a2e1f' },
  selectionText: { color: '#a89880', fontSize: 11, fontWeight: '600' },
  selectionTextSelected: { color: '#7a5c3a' },
  startButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: '#7a5c3a', marginTop: 8 },
  startButtonDisabled: { opacity: 0.45 },
  startButtonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  startButtonText: { color: '#fdfbf6', fontSize: 16, fontWeight: '800' },
  message: { color: '#7a6450', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  gameStage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 50 },
  countdownText: { color: '#3a2e1f', fontSize: 160, fontWeight: '900', fontFamily: 'NotoSansKR' },
  gameWord: { color: '#3a2e1f', fontWeight: '900', fontFamily: 'NotoSansKR', textAlign: 'center' },
});
