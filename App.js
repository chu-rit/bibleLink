import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import crosswordMaps from './data/maps/crosswordMaps';
import MapSelectScreen from './screens/MapSelectScreen';
import WordSearchScreen from './screens/WordSearchScreen';
import PuzzleScreen from './screens/PuzzleScreen';
import { getFilledCellCount, getOpenCellCount } from './utils';

const isLocalhost = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const isWordSearchPath = Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.pathname.endsWith('/word') ||
  window.location.pathname.endsWith('/word/');

export default function App() {
  const [screen, setScreen] = useState(isWordSearchPath && isLocalhost ? 'wordSearch' : 'mapSelect');
  const [selectedMap, setSelectedMap] = useState(null);
  const [answersByMap, setAnswersByMap] = useState({});
  const [hintPointsByMap, setHintPointsByMap] = useState({});
  const [hintedSlotsByMap, setHintedSlotsByMap] = useState({});
  const [loaded, setLoaded] = useState(false);

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
    setHintPointsByMap((prev) => {
      const current = prev[mapId] ?? 3;
      if (current <= 0) return prev;
      const next = { ...prev, [mapId]: current - 1 };
      AsyncStorage.setItem('hintPointsByMap', JSON.stringify(next)).catch(() => {});
      return next;
    });
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

  if (!loaded) return null;

  if (screen === 'wordSearch') {
    return (
      <WordSearchScreen
        onBack={() => {
          if (Platform.OS === 'web') {
            window.location.assign(window.location.pathname.replace(/\/word\/?$/, '') || '/');
            return;
          }
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
        onSelect={(map) => {
          setSelectedMap(map);
          setScreen('puzzle');
        }}
        onWordSearch={isLocalhost ? () => {
          const basePath = window.location.pathname.replace(/\/?$/, '');
          window.location.assign(`${basePath}/word/`);
        } : undefined}
        onResetProgress={() => {
          setAnswersByMap({});
          setHintPointsByMap({});
          setHintedSlotsByMap({});
          AsyncStorage.removeItem('answersByMap').catch(() => {});
          AsyncStorage.removeItem('hintPointsByMap').catch(() => {});
          AsyncStorage.removeItem('hintedSlotsByMap').catch(() => {});
        }}
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
      onBack={() => {
        setSelectedMap(null);
        setScreen('mapSelect');
      }}
    />
  );
}
