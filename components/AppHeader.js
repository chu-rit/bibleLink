import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const LOGO_IMAGE = require('../assets/LOGO.png');

export default function AppHeader({ onBack, onSettings, onHelp }) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.sideButton, pressed && styles.iconButtonPressed]} hitSlop={8}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#7a6450" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </Pressable>
      </View>
      <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
      <View style={[styles.side, styles.sideRight]}>
        {onHelp && (
          <Pressable onPress={onHelp} style={({ pressed }) => [styles.sideButton, pressed && styles.iconButtonPressed]} hitSlop={8}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#7a6450" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
              <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <Path d="M12 17h.01" />
            </Svg>
          </Pressable>
        )}
        <Pressable onPress={onSettings} disabled={!onSettings} style={({ pressed }) => [styles.sideButton, pressed && styles.iconButtonPressed]} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#7a6450" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 },
  side: { width: 80, alignItems: 'flex-start' },
  sideRight: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  logo: { width: 140, height: 32 },
  sideButton: { padding: 6, borderRadius: 10, backgroundColor: '#f0ebe0', borderWidth: 1.5, borderColor: '#d8cdb8', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center', shadowColor: '#3a2e1f', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  iconButtonPressed: { opacity: 0.5 },
});
