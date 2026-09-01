import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import crosswordMaps from './data/maps/crosswordMaps';
import MapSelectScreen from './screens/MapSelectScreen';
import WordSearchScreen from './screens/WordSearchScreen';
import PuzzleScreen from './screens/PuzzleScreen';
import { getFilledCellCount, getOpenCellCount } from './utils';

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
  const [screen, setScreen] = useState(isWordSearchPath && (isMasterModeByUrl || getMasterModeFromStorage()) ? 'wordSearch' : 'mapSelect');
  const [selectedMap, setSelectedMap] = useState(null);
  const [answersByMap, setAnswersByMap] = useState({});
  const [hintPointsByMap, setHintPointsByMap] = useState({});
  const [hintedSlotsByMap, setHintedSlotsByMap] = useState({});
  const [loaded, setLoaded] = useState(false);

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
        crosswordMaps.map((map) => {
          const answers = answersByMap[map.id] || {};
          const filled = getFilledCellCount(map, answers);
          return [map.id, { filled, total: getOpenCellCount(map) }];
        })
      ),
    [answersByMap]
  );

  if (!loaded || !fontsLoaded) return null;

  if (screen === 'wordSearch') {
    return (
      <WordSearchScreen
        onBack={() => {
          setScreen('mapSelect');
        }}
      />
    );
  }

  if (screen !== 'puzzle' || !selectedMap) {
    return (
      <MapSelectScreen
        maps={crosswordMaps}
        progressByMap={progressByMap}
        masterMode={masterMode}
        onSelect={(map) => {
          setSelectedMap(map);
          setScreen('puzzle');
        }}
        onWordSearch={masterMode ? () => {
          setScreen('wordSearch');
        } : undefined}
        onResetProgress={(hideSolvedOff) => {
          setAnswersByMap({});
          setHintPointsByMap({});
          setHintedSlotsByMap({});
          AsyncStorage.removeItem('answersByMap').catch(() => {});
          AsyncStorage.removeItem('hintPointsByMap').catch(() => {});
          AsyncStorage.removeItem('hintedSlotsByMap').catch(() => {});
          if (hideSolvedOff) {
            const next = !masterMode;
            setMasterMode(next);
            try { localStorage.setItem('masterMode', next ? '1' : '0'); } catch {}
          }
        }}
        onCompleteMap={masterMode ? (mapId) => {
          const map = crosswordMaps.find((m) => m.id === mapId);
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
    );
  }

  return (
    <PuzzleScreen
      crosswordMap={selectedMap}
      initialAnswers={answersByMap[selectedMap.id]}
      onAnswersChange={handleAnswersChange}
      hintPoints={hintPointsByMap[selectedMap.id] ?? 3}
      hintedSlots={hintedSlotsByMap[selectedMap.id] || {}}
      onUseHint={handleUseHint}
      masterMode={masterMode}
      onBack={() => {
        setSelectedMap(null);
        setScreen('mapSelect');
      }}
    />
  );
}
