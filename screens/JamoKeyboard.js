import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const KEY_ROWS = [
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', '←'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', ''],
];

const STATE_RANK = { gray: 0, yellow: 1, green: 2 };

export default function JamoKeyboard({ onKey, onBackspace, keyStates, disabled }) {
  const press = (key) => {
    if (disabled) return;
    if (key === '←') return onBackspace();
    onKey(key);
  };

  return (
    <View style={styles.keyboard}>
      {KEY_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, keyIndex) => {
            if (!key) return <View key={`spacer-${keyIndex}`} style={styles.keySpacer} />;
            const state = keyStates?.[key];
            const stateStyle = state ? styles[`key_${state}`] : null;
            const textStyle = state ? styles[`keyText_${state}`] : null;
            return (
              <Pressable
                key={key}
                onPress={() => press(key)}
                style={({ pressed }) => [styles.key, stateStyle, pressed && styles.keyPressed]}
              >
                {key === '←' ? (
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#3a2e1f" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
                    <Path d="M18 9l-6 6" />
                    <Path d="M12 9l6 6" />
                  </Svg>
                ) : (
                  <Text style={[styles.keyText, textStyle]}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function buildKeyStates(guesses) {
  const states = {};
  for (const guess of guesses) {
    guess.values.forEach((jamo, i) => {
      const state = guess.states[i];
      if (!states[jamo] || STATE_RANK[state] > STATE_RANK[states[jamo]]) states[jamo] = state;
    });
  }
  return states;
}

const styles = StyleSheet.create({
  keyboard: { paddingHorizontal: 10, paddingBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 6, gap: 4 },
  key: { flex: 1, height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdfbf6', borderWidth: 1, borderColor: '#d8cdb8' },
  keySpacer: { flex: 1 },
  keyPressed: { opacity: 0.5 },
  keyText: { color: '#3a2e1f', fontSize: 20, fontWeight: '400', fontFamily: 'NotoSansKR' },
  key_green: { backgroundColor: '#3c9a72', borderColor: '#3c9a72' },
  key_yellow: { backgroundColor: '#e08a3c', borderColor: '#e08a3c' },
  key_gray: { backgroundColor: '#b8a88f', borderColor: '#b8a88f' },
  keyText_green: { color: '#fdfbf6' },
  keyText_yellow: { color: '#fdfbf6' },
  keyText_gray: { color: '#fdfbf6' },
});
