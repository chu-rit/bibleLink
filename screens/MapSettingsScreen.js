import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import SettingsScreen from './SettingsScreen';

export default function MapSettingsScreen({ visible, onClose, onResetProgress }) {
  const confirmResetProgress = () => {
    const reset = () => {
      onResetProgress?.();
      onClose();
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('모든 진행 데이터를 초기화하시겠습니까?')) reset();
    } else {
      Alert.alert(
        '진행 데이터 초기화',
        '모든 퍼즐의 진행 데이터가 삭제됩니다. 계속하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '초기화', style: 'destructive', onPress: reset },
        ]
      );
    }
  };

  return (
    <SettingsScreen
      visible={visible}
      onClose={onClose}
      title="가로세로 퍼즐 설정"
    >
      <Pressable style={styles.resetButton} onPress={confirmResetProgress}>
        <Text style={styles.resetButtonText}>진행 데이터 초기화</Text>
      </Pressable>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  resetButton: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#d64545' },
  resetButtonText: { color: '#fdfbf6', fontSize: 14, fontWeight: '800' },
});
