import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import PageFlipper from './lib/pageFlipper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import bundledMaps from './data/maps/crosswordMaps';
import MapSelectScreen from './screens/MapSelectScreen';
import WordSearchScreen from './screens/WordSearchScreen';
import PuzzleScreen from './screens/PuzzleScreen';
import DailyWordScreen from './screens/DailyWordScreen';
import HeadsUpSetupScreen from './screens/HeadsUpSetupScreen';
import ChronologyScreen from './screens/ChronologyScreen';
import { MOBILE_MAX_WIDTH, PAGE_ASPECT_RATIO, getFilledCellCount, getOpenCellCount, getPageWidth, setWordData } from './utils';
import { loadAppData } from './utils/dataLoader';
import { lockOrientation } from './utils/orientation';

const ICON_ASSET = require('./assets/ICON.png');
const ICON_NOBG_ASSET = require('./assets/ICON_NOBG.png');
const BG_ASSET = require('./assets/BG.png');

const LOADING_STATUS_TEXT = {
  loading: '데이터를 불러오는 중...',
  checking: '최신 데이터를 확인하는 중...',
  downloading: '업데이트를 다운로드하는 중...',
};

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

const isMasterModeByUrl = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (isLocalhost || webPath.includes('/master'));

const isWordSearchPath = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (webPath.endsWith('/word') || webPath.endsWith('/word/'));

const SCREEN_BY_PAGE_INDEX = ['loading', 'mapSelect', 'puzzle', 'dailyWord', 'chronology'];
const EMPTY_MAP = {
  id: '__empty__',
  title: '',
  difficulty: 1,
  width: 8,
  height: 8,
  grid: Array.from({ length: 8 }, () => '########'),
  cells: [],
};

// 헤드업 진입처럼 화면이 통째로 바뀔 때 깜빡임을 없애는 페이드인 래퍼
function FadeInView({ children, style, duration = 240, onEnd }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start(() => onEndRef.current?.());
    return undefined;
  }, [duration, opacity]);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

class PageFlipperBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PageFlipperBoundary] ERROR');
    console.error('[PageFlipperBoundary] error.message', error?.message);
    console.error('[PageFlipperBoundary] error.stack', error?.stack);
    console.error('[PageFlipperBoundary] componentStack', errorInfo?.componentStack);
  }

  componentDidUpdate(previousProps, previousState) {
    if (!previousState.hasError && this.state.hasError) {
      console.log('[PageFlipperBoundary] FALLBACK RENDERED');
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, height: '100%' }}>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [fontsLoaded] = useFonts({
    UhBeeGmin2: require('./assets/fonts/UhBeeGmin2.ttf'),
    UhBeeGmin2Bold: require('./assets/fonts/UhBeeGmin2Bold.ttf'),
    NotoSansKR: require('./assets/fonts/NotoSansKR.ttf'),
  });
  const [masterMode, setMasterMode] = useState(isMasterModeByUrl || getMasterModeFromStorage());
  const [screen, setScreen] = useState(isWordSearchPath && (isMasterModeByUrl || getMasterModeFromStorage()) ? 'wordSearch' : 'loading');
  const [appMaps, setAppMaps] = useState(bundledMaps);
  const [appWords, setAppWords] = useState(null);
  const [dataStatus, setDataStatus] = useState('loading');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadingPageBackgroundLoaded, setLoadingPageBackgroundLoaded] = useState(false);
  const [loadingIconLoaded, setLoadingIconLoaded] = useState(false);
  const [loadingRootBackgroundLoaded, setLoadingRootBackgroundLoaded] = useState(false);
  const loadingImagesReady = loadingPageBackgroundLoaded && loadingIconLoaded && loadingRootBackgroundLoaded;
  const loadingReady = dataLoaded && fontsLoaded && loadingImagesReady;
  const htmlLoadingReady = dataLoaded && fontsLoaded && (screen !== 'loading' || loadingImagesReady);

  const toggleMasterMode = () => {
    setMasterMode((prev) => {
      const next = !prev;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try { localStorage.setItem('masterMode', next ? '1' : '0'); } catch {}
      }
      return next;
    });
  };
  // 헤드업: 빈 페이지 페이드인 완료 여부 — 이후에 가로 회전과 플립을 시작한다
  const [headsUpFadeDone, setHeadsUpFadeDone] = useState(false);
  const [selectedMap, setSelectedMap] = useState(null);
  const [answersByMap, setAnswersByMap] = useState({});
  const [hintPointsByMap, setHintPointsByMap] = useState({});
  const [hintedSlotsByMap, setHintedSlotsByMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const isLandscapeScreen = screen === 'headsUpSetup' || screen === 'chronology';
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.classList.toggle('landscape-allowed', isLandscapeScreen);
      document.body.classList.toggle('heads-up-active', isLandscapeScreen);
    }
    // 헤드업은 빈 페이지 페이드인이 끝난 뒤 가로 회전을 시작한다 (페이드와 회전이 겹치지 않게)
    lockOrientation(screen === 'headsUpSetup' && headsUpFadeDone ? 'LANDSCAPE' : 'PORTRAIT');
    if (screen === 'loading') {
      menuContentFade.setValue(1);
      setMenuHiding(false);
      setHeadsUpFadeDone(false);
    }
  }, [screen, headsUpFadeDone]);

  // 원격 데이터 로딩
  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();
    const MIN_LOADING_TIME = 3000;
    loadAppData((status) => {
      if (!cancelled) {
        setDataStatus(status);
      }
    }).then(({ words, maps }) => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const wait = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => {
        if (cancelled) return;
        setWordData(words);
        setAppWords(words);
        setAppMaps(maps);
        setDataLoaded(true);
      }, wait);
    }).catch((err) => {
      const elapsed = Date.now() - startTime;
      const wait = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => {
        if (!cancelled) setDataLoaded(true);
      }, wait);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const preventContextMenu = (event) => event.preventDefault();
    const body = document.body;
    const root = document.getElementById('root');
    const previous = {
      bodyUserSelect: body.style.userSelect,
      bodyWebkitUserSelect: body.style.webkitUserSelect,
      bodyWebkitTouchCallout: body.style.webkitTouchCallout,
      rootUserSelect: root?.style.userSelect || '',
      rootWebkitUserSelect: root?.style.webkitUserSelect || '',
      rootWebkitTouchCallout: root?.style.webkitTouchCallout || '',
    };
    body.style.userSelect = 'none';
    body.style.webkitUserSelect = 'none';
    body.style.webkitTouchCallout = 'none';
    if (root) {
      root.style.userSelect = 'none';
      root.style.webkitUserSelect = 'none';
      root.style.webkitTouchCallout = 'none';
    }
    document.addEventListener('contextmenu', preventContextMenu);
    return () => {
      body.style.userSelect = previous.bodyUserSelect;
      body.style.webkitUserSelect = previous.bodyWebkitUserSelect;
      body.style.webkitTouchCallout = previous.bodyWebkitTouchCallout;
      if (root) {
        root.style.userSelect = previous.rootUserSelect;
        root.style.webkitUserSelect = previous.rootWebkitUserSelect;
        root.style.webkitTouchCallout = previous.rootWebkitTouchCallout;
      }
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onHashChange = () => {
      const hash = window.location.hash || '';
      if (hash.includes('/word')) {
        setScreen('wordSearch');
      } else if (hash.includes('/master') || hash === '' || hash === '#' || hash === '#/') {
        setScreen('mapSelect');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
    if (!masterMode) {
      setHintPointsByMap((prev) => {
        const current = prev[mapId] ?? 3;
        if (current <= 0) return prev;
        const next = { ...prev, [mapId]: current - 1 };
        AsyncStorage.setItem('hintPointsByMap', JSON.stringify(next)).catch(() => {});
        return next;
      });
    }
    setHintedSlotsByMap((prev) => {
      const next = { ...prev, [mapId]: { ...(prev[mapId] || {}), [slotIndex]: true } };
      AsyncStorage.setItem('hintedSlotsByMap', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const progressByMap = useMemo(
    () =>
      Object.fromEntries(
        appMaps.map((map) => {
          const answers = answersByMap[map.id] || {};
          const filled = getFilledCellCount(map, answers);
          return [map.id, { filled, total: getOpenCellCount(map) }];
        })
      ),
    [answersByMap, appMaps]
  );

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const flipperRef = useRef(null);
  const animationActiveRef = useRef(false);
  const pageWidth = getPageWidth(windowWidth, windowHeight);
  const pageHeight = Math.min(Math.round(pageWidth * PAGE_ASPECT_RATIO), Math.round(windowHeight || pageWidth * PAGE_ASPECT_RATIO));
  const pageIndex = screen === 'loading' ? 0 : (screen === 'chronology' ? 4 : (screen === 'dailyWord' ? 3 : (screen === 'puzzle' && selectedMap ? 2 : 1)));
  const currentPageId = SCREEN_BY_PAGE_INDEX[pageIndex];
  const [flipPages, setFlipPages] = useState([currentPageId]);
  const [flipReversed, setFlipReversed] = useState(false);

  useEffect(() => {
    if (!loaded || !fontsLoaded || screen === 'headsUpSetup') return undefined;
    if (flipPages.length > 1 || flipPages[0] === currentPageId) return undefined;
    const forward = pageIndex > SCREEN_BY_PAGE_INDEX.indexOf(flipPages[0]);
    setFlipReversed(!forward);
    flipperRef.current?.goToPageDeferred?.(1);
    setFlipPages([flipPages[0], currentPageId]);
    return undefined;
  }, [loaded, fontsLoaded, screen, currentPageId, flipPages, pageIndex]);

  // 로딩 완료 시 HTML 오버레이만 제거하고 로딩 페이지에 머무름 (사용자 입력으로 진입)
  useEffect(() => {
    if (!htmlLoadingReady) return undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.__removeLoadingScreen) {
      window.__removeLoadingScreen();
      window.__removeLoadingScreen = null;
    }
    return undefined;
  }, [htmlLoadingReady]);

  const iconLiftAnim = useRef(new Animated.Value(0)).current;
  const menuFadeAnim = useRef(new Animated.Value(0)).current;
  const menuRiseAnim = useRef(new Animated.Value(16)).current;
  // 헤드업 진입 시 메뉴 요소를 먼저 페이드아웃시키는 값
  const menuContentFade = useRef(new Animated.Value(1)).current;
  const [menuHiding, setMenuHiding] = useState(false);

  // 회전이 필요한 화면 전환은 불투명 표지 커버 아래에서 처리해 OS 회전 애니메이션을 가린다
  const coverAnim = useRef(new Animated.Value(0)).current;
  const [coverVisible, setCoverVisible] = useState(false);
  const coverTimer = useRef(null);
  const coverDimSub = useRef(null);
  const transitionWithCover = (apply) => {
    if (coverTimer.current) clearTimeout(coverTimer.current);
    if (coverDimSub.current) { coverDimSub.current.remove?.(); coverDimSub.current = null; }
    setCoverVisible(true);
    coverAnim.stopAnimation();
    coverAnim.setValue(0);
    Animated.timing(coverAnim, { toValue: 1, duration: 140, useNativeDriver: true }).start(() => {
      apply();
      // 회전이 일어나면 화면 크기가 바뀌므로, 마지막 변경 후 잠시 정착될 때까지 커버를 유지한다
      const appliedAt = Date.now();
      let lastChange = Date.now();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        coverTimer.current = null;
        if (coverDimSub.current) { coverDimSub.current.remove?.(); coverDimSub.current = null; }
        Animated.timing(coverAnim, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => setCoverVisible(false));
      };
      const check = () => {
        const now = Date.now();
        const elapsed = now - appliedAt;
        if (elapsed >= 1500 || (elapsed >= 450 && now - lastChange >= 220)) return finish();
        coverTimer.current = setTimeout(check, 60);
      };
      coverDimSub.current = Dimensions.addEventListener('change', () => { lastChange = Date.now(); });
      check();
    });
  };

  // 헤드업: 빈 배경 페이지 위에서 가로 회전 → 정착 후 페이지 넘김으로 설정 화면 진입
  const headsUpFlipperRef = useRef(null);
  const [headsUpFlipPages, setHeadsUpFlipPages] = useState(['headsUpBlank']);
  const headsUpExitStartedRef = useRef(false);
  const headsUpExitDoneRef = useRef(false);

  useEffect(() => {
    if (screen !== 'headsUpSetup') return undefined;
    headsUpExitStartedRef.current = false;
    headsUpExitDoneRef.current = false;
    if (!headsUpFadeDone) {
      setHeadsUpFlipPages(['headsUpBlank']);
      return undefined;
    }
    const startedAt = Date.now();
    let lastChange = Date.now();
    let timer = null;
    const sub = Dimensions.addEventListener('change', () => { lastChange = Date.now(); });
    const check = () => {
      const now = Date.now();
      if ((now - lastChange >= 220 && now - startedAt >= 350) || now - startedAt >= 1500) {
        headsUpFlipperRef.current?.goToPageDeferred?.(1);
        setHeadsUpFlipPages(['headsUpBlank', 'headsUp']);
        return;
      }
      timer = setTimeout(check, 60);
    };
    check();
    return () => { sub?.remove?.(); if (timer) clearTimeout(timer); };
  }, [screen, headsUpFadeDone]);
  const exitHeadsUp = () => {
    if (headsUpExitDoneRef.current) return;
    headsUpExitDoneRef.current = true;
    // 플리퍼는 현재 리프 뒷면에 다음 페이지를 미리 그려 두므로, 회전 중 재렌더될 때 헤드업이 비치지 않게 빈 페이지만 남긴다
    setHeadsUpFlipPages(['headsUpBlank']);
    lockOrientation('PORTRAIT');
    const startedAt = Date.now();
    let lastChange = Date.now();
    const sub = Dimensions.addEventListener('change', () => { lastChange = Date.now(); });
    const check = () => {
      const now = Date.now();
      if ((now - lastChange >= 220 && now - startedAt >= 300) || now - startedAt >= 1500) {
        sub?.remove?.();
        setScreen('loading');
        return;
      }
      setTimeout(check, 60);
    };
    check();
  };

  const headsUpBack = () => {
    if (headsUpExitStartedRef.current) return;
    headsUpExitStartedRef.current = true;
    headsUpFlipperRef.current?.goToPage(0);
    // 플립이 시작되지 못했거나 끝나지 않는 경우 대비 안전장치
    setTimeout(exitHeadsUp, 1600);
  };

  const renderHeadsUpPage = (pageId) => (
    <View style={{ width: windowWidth, height: windowHeight }}>
      {pageId === 'headsUp'
        ? <HeadsUpSetupScreen onBack={headsUpBack} masterMode={masterMode} />
        : <Image source={BG_ASSET} style={StyleSheet.absoluteFill} resizeMode="cover" />}
    </View>
  );

  // OTA 업데이트가 내려받아져 있으면 로딩 페이지에 다시 시작 버튼만 표시해 즉시 적용을 유도한다
  const [updateReady, setUpdateReady] = useState(false);
  const restartForUpdate = () => {
    try { require('expo-updates').reloadAsync(); } catch {}
  };
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const Updates = require('expo-updates');
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!cancelled) setUpdateReady(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);


  useEffect(() => {
    if (!loadingReady) return undefined;
    Animated.parallel([
      Animated.timing(iconLiftAnim, { toValue: -36, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(menuFadeAnim, { toValue: 1, duration: 400, delay: 120, useNativeDriver: true }),
      Animated.timing(menuRiseAnim, { toValue: 0, duration: 400, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    return undefined;
  }, [loadingReady]);

  const mapPage = useMemo(() => (
    <MapSelectScreen
      maps={appMaps}
      progressByMap={progressByMap}
      masterMode={masterMode}
      onBack={() => setScreen('loading')}
      onSelect={(map) => {
        setSelectedMap(map);
        setScreen('puzzle');
      }}
      onWordSearch={masterMode ? () => {
        setScreen('wordSearch');
      } : undefined}
      onResetProgress={() => {
        setAnswersByMap({});
        setHintPointsByMap({});
        setHintedSlotsByMap({});
        AsyncStorage.removeItem('answersByMap').catch(() => {});
        AsyncStorage.removeItem('hintPointsByMap').catch(() => {});
        AsyncStorage.removeItem('hintedSlotsByMap').catch(() => {});
      }}
      onCompleteMap={masterMode ? (mapId) => {
        const map = appMaps.find((m) => m.id === mapId);
        if (!map) return;
        setAnswersByMap((prev) => {
          const next = { ...prev };
          const currentAnswers = prev[mapId] || {};
          const isComplete = getFilledCellCount(map, currentAnswers) === getOpenCellCount(map);
          if (isComplete) {
            delete next[mapId];
          } else {
            const answers = {};
            map.cells.forEach((cell, index) => {
              answers[index] = cell.answer;
            });
            next[mapId] = answers;
          }
          try { AsyncStorage.setItem('answersByMap', JSON.stringify(next)); } catch {}
          return next;
        });
      } : undefined}
      onResetMap={!masterMode ? (mapId) => {
        setAnswersByMap((prev) => {
          const next = { ...prev };
          delete next[mapId];
          AsyncStorage.setItem('answersByMap', JSON.stringify(next)).catch(() => {});
          return next;
        });
        setHintPointsByMap((prev) => {
          const next = { ...prev };
          delete next[mapId];
          AsyncStorage.setItem('hintPointsByMap', JSON.stringify(next)).catch(() => {});
          return next;
        });
        setHintedSlotsByMap((prev) => {
          const next = { ...prev };
          delete next[mapId];
          AsyncStorage.setItem('hintedSlotsByMap', JSON.stringify(next)).catch(() => {});
          return next;
        });
      } : undefined}
    />
  ), [appMaps, progressByMap, masterMode]);

  const puzzlePage = useMemo(() => (
    <PuzzleScreen
      crosswordMap={selectedMap || EMPTY_MAP}
      initialAnswers={selectedMap ? answersByMap[selectedMap.id] : {}}
      onAnswersChange={handleAnswersChange}
      hintPoints={selectedMap ? hintPointsByMap[selectedMap.id] ?? 3 : 0}
      hintedSlots={selectedMap ? hintedSlotsByMap[selectedMap.id] || {} : {}}
      onUseHint={handleUseHint}
      masterMode={masterMode}
      onToggleMasterMode={toggleMasterMode}
      onBack={() => {
        setScreen('mapSelect');
      }}
    />
  ), [selectedMap, answersByMap, hintPointsByMap, hintedSlotsByMap, masterMode]);

  const dailyWordPage = useMemo(() => (
    <DailyWordScreen onBack={() => setScreen('loading')} masterMode={masterMode} isActive={screen === 'dailyWord'} />
  ), [masterMode, screen]);

  // 가로 회전 상태로 나가면 OS 회전이 플립과 겹치므로 그때만 커버 전환 사용
  const chronologyPage = useMemo(() => (
    <ChronologyScreen onBack={(rotated) => (rotated ? transitionWithCover(() => setScreen('loading')) : setScreen('loading'))} />
  ), []);

  const loadingIconSize = windowWidth <= MOBILE_MAX_WIDTH ? Math.min(windowWidth * 0.7, 280) : 240;
  const loadingStatusText = Platform.OS === 'web' ? LOADING_STATUS_TEXT.loading : (LOADING_STATUS_TEXT[dataStatus] || LOADING_STATUS_TEXT.loading);
  const handleDailyWord = () => setScreen('dailyWord');
  const loadingPage = useMemo(() => (
    <View style={[styles.loadingPage, { width: pageWidth, height: pageHeight }]}>
      <Image
        source={BG_ASSET}
        style={styles.loadingBackground}
        onLoad={() => setLoadingPageBackgroundLoaded(true)}
        onError={() => setLoadingPageBackgroundLoaded(true)}
      />
      <Animated.View style={[styles.loadingContent, { opacity: menuContentFade }]} pointerEvents={menuHiding ? 'none' : 'auto'}>
        <Animated.Image
          source={ICON_NOBG_ASSET}
          style={[styles.loadingIcon, { width: loadingIconSize, height: loadingIconSize, transform: [{ translateY: Animated.add(-24, iconLiftAnim) }] }]}
          onLoad={() => setLoadingIconLoaded(true)}
          onError={() => setLoadingIconLoaded(true)}
        />
        {!loadingReady && <Text style={styles.loadingText}>{loadingStatusText}</Text>}
        <Animated.View
          style={[styles.menuButtons, { opacity: menuFadeAnim, transform: [{ translateY: menuRiseAnim }] }]}
          pointerEvents={loadingReady ? 'auto' : 'none'}
        >
          {updateReady ? (
            <Pressable style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]} onPress={restartForUpdate}>
              <Text style={styles.menuButtonText}>다시 시작</Text>
            </Pressable>
          ) : (
          <>
          <Pressable style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]} onPress={() => setScreen('mapSelect')}>
            <Text style={styles.menuButtonText}>가로세로퍼즐</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]} onPress={handleDailyWord}>
            <Text style={styles.menuButtonText}>오늘의 단어</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
            onPress={() => {
              // 메뉴 요소를 페이드아웃시켜 배경만 남긴 뒤 화면 전환 → 회전·플립 진행
              setMenuHiding(true);
              Animated.timing(menuContentFade, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })
                .start(() => setScreen('headsUpSetup'));
            }}
          >
            <Text style={styles.menuButtonText}>헤드업</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
            onPress={() => setScreen('chronology')}
          >
            <Text style={styles.menuButtonText}>연대기</Text>
          </Pressable>
          </>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  ), [pageWidth, pageHeight, loadingIconSize, loadingReady, loadingStatusText, updateReady, menuHiding]);

  const transitionCover = coverVisible ? (
    <Animated.View pointerEvents="auto" style={[styles.transitionCover, { opacity: coverAnim }]}>
      <Image source={BG_ASSET} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {loadingPage}
    </Animated.View>
  ) : null;

  if (screen === 'headsUpSetup') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <Image source={BG_ASSET} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <FadeInView key="headsUp" style={StyleSheet.absoluteFill} duration={900} onEnd={() => setHeadsUpFadeDone(true)}>
          <PageFlipperBoundary fallback={<HeadsUpSetupScreen onBack={headsUpBack} masterMode={masterMode} />}>
            <PageFlipper
              ref={headsUpFlipperRef}
              data={headsUpFlipPages}
              pageSize={{ width: windowWidth, height: windowHeight }}
              portrait
              singleImageMode
              pressable={false}
              enabled={false}
              contentContainerStyle={styles.flipperContainer}
              onFlippedEnd={(index) => {
                if (!headsUpExitStartedRef.current) return;
                if (index === 0) exitHeadsUp();
                else headsUpFlipperRef.current?.goToPage(0);
              }}
              renderPage={renderHeadsUpPage}
              // 나가는 동안 리프 뒤에 깔리는 페이지는 빈 배경으로 — 리렌더 틈에 헤드업이 비치는 깜빡임 방지
              renderPageBack={(page) => renderHeadsUpPage(headsUpExitStartedRef.current ? 'headsUpBlank' : page)}
            />
          </PageFlipperBoundary>
        </FadeInView>
        <AdBanner />
      </GestureHandlerRootView>
    );
  }

  if (screen === 'wordSearch' && dataLoaded) {
    return <WordSearchScreen maps={appMaps} words={appWords} onBack={() => setScreen('mapSelect')} />;
  }

  const currentPage = pageIndex === 0 ? loadingPage : (pageIndex === 4 ? chronologyPage : (pageIndex === 3 ? dailyWordPage : (pageIndex === 2 ? puzzlePage : mapPage)));

  const renderPageContent = (pageId) => (
    <View style={{ width: pageWidth, height: pageHeight, transform: flipReversed ? [{ scaleX: -1 }] : [] }}>
      {pageId === 'loading' ? loadingPage : (pageId === 'chronology' ? chronologyPage : (pageId === 'dailyWord' ? dailyWordPage : (pageId === 'puzzle' ? puzzlePage : mapPage)))}
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <Image
        source={BG_ASSET}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setLoadingRootBackgroundLoaded(true)}
        onError={() => setLoadingRootBackgroundLoaded(true)}
      />
      <FadeInView key="main" style={StyleSheet.absoluteFill}>
      <PageFlipperBoundary fallback={currentPage}>
        <View style={[styles.flipperFrame, { width: pageWidth, height: pageHeight, transform: flipReversed ? [{ scaleX: -1 }] : [] }]}>
          <PageFlipper
          ref={flipperRef}
          data={flipPages}
          pageSize={{ width: pageWidth, height: pageHeight }}
          portrait
          singleImageMode
          pressable={false}
          enabled={false}
          contentContainerStyle={styles.flipperContainer}
          onFlipStart={(direction) => {
            animationActiveRef.current = true;
          }}
          onFlippedEnd={(index) => {
            animationActiveRef.current = false;
            setFlipReversed(false);
            setFlipPages([flipPages[index]]);
          }}
          renderPage={renderPageContent}
          />
        </View>
        </PageFlipperBoundary>
      </FadeInView>
      <AdBanner />
      {transitionCover}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100%', backgroundColor: '#f6f1e6' },
  flipperContainer: { flex: 1, width: '100%', height: '100%' },
  flipperFrame: { flex: 1 },
  adContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  transitionCover: { ...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 999, alignItems: 'center', justifyContent: 'center' },

  loadingPage: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  loadingBackground: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', resizeMode: 'cover' },
  loadingContent: { alignItems: 'center', justifyContent: 'center' },
  loadingIcon: { resizeMode: 'contain', marginBottom: 24 },
  loadingText: { fontSize: 20, color: '#7a5c3a', fontFamily: 'NotoSansKR' },
  menuButtons: { marginTop: 32, alignItems: 'center' },
  menuButton: { width: 240, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12, borderWidth: 1.5, borderColor: '#7a5c3a' },
  menuButtonPressed: { backgroundColor: 'rgba(122, 92, 58, 0.12)', transform: [{ scale: 0.97 }] },
  menuButtonText: { color: '#7a5c3a', fontSize: 16, fontWeight: '800' },
});

function AdBanner() {
  const adRef = useRef(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || ['localhost', '127.0.0.1'].includes(window.location.hostname)) return undefined;
    const container = adRef.current;
    if (!container) return undefined;
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (standalone) sessionStorage.setItem('adfit.test', '1');
    } catch (e) {}
    window.kakaoAdOnFail = () => { window.__adfitNoAdAt = Date.now(); };
    let ins = container.querySelector('.kakao_ad_area');
    if (!ins) {
      ins = document.createElement('ins');
      ins.className = 'kakao_ad_area';
      ins.style.display = 'none';
      ins.style.width = '100%';
      ins.setAttribute('data-ad-unit', 'DAN-kILk8DoW0wkoyavP');
      ins.setAttribute('data-ad-width', '320');
      ins.setAttribute('data-ad-height', '50');
      ins.setAttribute('data-ad-onfail', 'kakaoAdOnFail');
      container.appendChild(ins);
    }

    let script;
    const renderAd = () => {
      if (ins.querySelector('iframe')) return;
      if (typeof window.adfit?.render === 'function') window.adfit.render();
    };
    const handleScriptError = () => {
      if (script?.parentNode) script.parentNode.removeChild(script);
      script = null;
    };
    const loadAdfit = () => {
      if (typeof window.adfit?.render === 'function') {
        renderAd();
        return;
      }
      script = document.querySelector('script[src*="ba.min.js"]');
      if (script) {
        script.addEventListener('load', renderAd, { once: true });
        script.addEventListener('error', handleScriptError, { once: true });
        return;
      }
      script = document.createElement('script');
      script.type = 'text/javascript';
      script.charset = 'utf-8';
      script.src = 'https://t1.kakaocdn.net/kas/static/ba.min.js';
      script.async = true;
      script.addEventListener('load', renderAd, { once: true });
      script.addEventListener('error', handleScriptError, { once: true });
      document.body.appendChild(script);
    };
    const refreshAd = () => {
      if (!document.hidden) loadAdfit();
    };

    loadAdfit();
    document.addEventListener('visibilitychange', refreshAd);
    window.addEventListener('pageshow', refreshAd);
    return () => {
      document.removeEventListener('visibilitychange', refreshAd);
      window.removeEventListener('pageshow', refreshAd);
      if (script) {
        script.removeEventListener('load', renderAd);
        script.removeEventListener('error', handleScriptError);
      }
    };
  }, []);
  const showAdDebug = async () => {
    const ins = adRef.current?.querySelector?.('.kakao_ad_area');
    let notif = '-'; let perm = '-';
    try { notif = String(Notification.permission); } catch (e) { notif = 'n/a'; }
    try { perm = String((await navigator.permissions.query({ name: 'notifications' })).state); } catch (e) { perm = 'n/a'; }
    window.alert([
      `standalone: ${window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true}`,
      `adfit: ${typeof window.adfit?.render}`,
      `ins: ${ins ? `yes iframe=${ins.querySelectorAll('iframe').length} disp=${getComputedStyle(ins).display}` : 'no'}`,
      `notif: ${notif} / query: ${perm}`,
      `webdriver: ${navigator.webdriver}`,
      `langs: ${(navigator.languages || []).join(',') || 'none'}`,
      `suspend: ${localStorage.getItem('adfit.ba.adUnitSuspendItems') || 'none'}`,
      `testFlag: ${sessionStorage.getItem('adfit.test') || 'none'}`,
      `noAd: ${window.__adfitNoAdAt ? 'yes' : 'no'}`,
    ].join('\n'));
  };

  return (
    <Pressable
      ref={adRef}
      onLongPress={Platform.OS === 'web' ? showAdDebug : undefined}
      delayLongPress={1200}
      style={[styles.adContainer, Platform.OS === 'web' && { bottom: Math.max(insets.bottom - 12, 0) }]}
    />
  );
}

