import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

const BG_IMAGE = require('../assets/BG.png');

export default function DailyWordScreen({ onBack }) {
  return (
    <ImageBackground source={BG_IMAGE} resizeMode="cover" style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>게임 선택</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20 },
  backButton: { backgroundColor: '#f0ebe0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  backButtonText: { color: '#7a6450', fontSize: 12, fontWeight: '800' },
});
