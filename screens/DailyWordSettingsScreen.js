import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import SettingsScreen from './SettingsScreen';
import { getOrCreateUser, getUser, saveUser } from '../utils/dailyWord';

export default function DailyWordSettingsScreen({ visible, prompt, onClose }) {
  const [nickname, setNickname] = useState('NONAME');
  const [isFocused, setIsFocused] = useState(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!visible) return undefined;
    focusedRef.current = false;
    setIsFocused(false);
    let mounted = true;
    getUser().then((user) => {
      if (mounted && !focusedRef.current) setNickname(user?.nickname || 'NONAME');
    });
    return () => { mounted = false; };
  }, [visible]);

  const saveNickname = async () => {
    const nextNickname = nickname.trim();
    if (!nextNickname) return;
    const user = await getOrCreateUser();
    await saveUser({ ...user, nickname: nextNickname });
    onClose();
  };

  const handleFocus = () => {
    focusedRef.current = true;
    setIsFocused(true);
    if (nickname === 'NONAME') setNickname('');
  };

  const handleBlur = () => {
    focusedRef.current = false;
    setIsFocused(false);
    if (!nickname.trim()) setNickname('NONAME');
  };

  return (
    <SettingsScreen
      visible={visible}
      onClose={onClose}
      title={prompt ? '닉네임 설정' : '오늘의 단어 설정'}
    >
      {prompt && <Text style={styles.promptText}>랭킹에 표시될 닉네임을 설정해주세요</Text>}
      <Text style={styles.label}>닉네임</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder={isFocused ? '' : 'NONAME'}
        maxLength={12}
        returnKeyType="done"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={saveNickname}
      />
      <Pressable style={styles.saveButton} onPress={saveNickname}>
        <Text style={styles.saveButtonText}>저장</Text>
      </Pressable>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  promptText: { color: '#3a2e1f', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  label: { color: '#7a6450', fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: '#3a2e1f', fontSize: 15 },
  saveButton: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#7a5c3a' },
  saveButtonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
});
