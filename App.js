import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import bundledMaps from './data/maps/crosswordMaps';
import MapSelectScreen from './screens/MapSelectScreen';
import WordSearchScreen from './screens/WordSearchScreen';
import PuzzleScreen from './screens/PuzzleScreen';
import { getFilledCellCount, getOpenCellCount, setWordData } from './utils';
import { loadAppData } from './utils/dataLoader';

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

export default function App() {
  const [fontsLoaded] = useFonts({
    UhBeeGmin2: require('./assets/fonts/UhBeeGmin2.ttf'),
    UhBeeGmin2Bold: require('./assets/fonts/UhBeeGmin2Bold.ttf'),
  });
  const [masterMode, setMasterMode] = useState(isMasterModeByUrl || getMasterModeFromStorage());
  const [screen, setScreen] = useState(isWordSearchPath && (isMasterModeByUrl || getMasterModeFromStorage()) ? 'wordSearch' : 'loading');
  const [appMaps, setAppMaps] = useState(bundledMaps);
  const [appWords, setAppWords] = useState(null);
  const [dataStatus, setDataStatus] = useState('loading');
  const [dataLoaded, setDataLoaded] = useState(false);

  const toggleMasterMode = () => {
    setMasterMode((prev) => {
      const next = !prev;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try { localStorage.setItem('masterMode', next ? '1' : '0'); } catch {}
      }
      return next;
    });
  };
  const [selectedMap, setSelectedMap] = useState(null);
  const [answersByMap, setAnswersByMap] = useState({});
  const [hintPointsByMap, setHintPointsByMap] = useState({});
  const [hintedSlotsByMap, setHintedSlotsByMap] = useState({});
  const [loaded, setLoaded] = useState(false);

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
    }).catch(() => {
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

  // 로딩 완료 시 맵 선택 페이지로 전환
  useEffect(() => {
    if (!dataLoaded) return;
    setScreen((prev) => (prev === 'loading' ? 'mapSelect' : prev));
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.__removeLoadingScreen) {
      window.__removeLoadingScreen();
      window.__removeLoadingScreen = null;
    }
  }, [dataLoaded]);

  if (!loaded || !fontsLoaded || screen === 'loading') {
    return (
      <View style={styles.loadingPage}>
        <Image source={BG_ASSET} style={styles.loadingBackground} />
        <View style={styles.loadingContent}>
          <Image source={ICON_NOBG_ASSET} style={styles.loadingIcon} />
          <Text style={styles.loadingText}>{LOADING_STATUS_TEXT[dataStatus] || LOADING_STATUS_TEXT.loading}</Text>
        </View>
      </View>
    );
  }

  if (screen === 'wordSearch' && dataLoaded) {
    return <WordSearchScreen maps={appMaps} words={appWords} onBack={() => setScreen('mapSelect')} />;
  }

  if (screen === 'puzzle' && selectedMap) {
    return (
      <>
        <PuzzleScreen
          crosswordMap={selectedMap}
          initialAnswers={answersByMap[selectedMap.id]}
          onAnswersChange={handleAnswersChange}
          hintPoints={hintPointsByMap[selectedMap.id] ?? 3}
          hintedSlots={hintedSlotsByMap[selectedMap.id] || {}}
          onUseHint={handleUseHint}
          masterMode={masterMode}
          onToggleMasterMode={toggleMasterMode}
          onBack={() => setScreen('mapSelect')}
        />
        <AdBanner />
      </>
    );
  }

  return (
    <>
      <MapSelectScreen
        maps={appMaps}
        progressByMap={progressByMap}
        masterMode={masterMode}
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
      <AdBanner />
    </>
  );
}

const styles = StyleSheet.create({
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f8fb' },
  loadingBackground: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', resizeMode: 'cover' },
  loadingContent: { alignItems: 'center', justifyContent: 'center' },
  loadingIcon: { width: 280, height: 280, resizeMode: 'contain', marginBottom: 24 },
  loadingText: { fontSize: 20, color: '#7a5c3a', fontFamily: 'UhBeeGmin2' },
  adContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
});

function AdBanner() {
  const adRef = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname))) return undefined;
    let ins;
    let script;
    const timer = setTimeout(() => {
      if (!adRef.current) return;
      if (document.querySelector('.kakao_ad_area')) return;
      ins = document.createElement('ins');
      ins.className = 'kakao_ad_area';
      ins.style.display = 'block';
      ins.style.width = '320px';
      ins.style.height = '50px';
      ins.style.margin = '0 auto';
      ins.setAttribute('data-ad-unit', 'DAN-kILk8DoW0wkoyavP');
      ins.setAttribute('data-ad-width', '320');
      ins.setAttribute('data-ad-height', '50');
      adRef.current.appendChild(ins);
      if (!document.querySelector('script[src*="ba.min.js"]')) {
        script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
        script.async = true;
        document.body.appendChild(script);
      } else {
        if (typeof window !== 'undefined' && window.adfit) {
          window.adfit.render();
        }
      }
    }, 100);
    return () => { clearTimeout(timer); };
  }, []);
  return <View ref={adRef} style={styles.adContainer} />;
}
