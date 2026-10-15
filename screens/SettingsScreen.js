import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import appConfig from '../app.json';
import { scaleFont, useUiScale } from '../utils/responsive';

export default function SettingsScreen({ visible, onClose, title, description, children }) {
  const uiScale = useUiScale();
  const sf = (n) => scaleFont(n, uiScale);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
            <Text style={[styles.closeButtonText, { fontSize: sf(22) }]}>×</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { fontSize: sf(11) }]}>Biblink</Text>
          <Text style={[styles.title, { fontSize: sf(17) }]}>{title}</Text>
          {description ? <Text style={[styles.description, { fontSize: sf(13) }]}>{description}</Text> : null}
          <View style={styles.content}>{children}</View>
          <View style={styles.footer}>
            <Text style={[styles.credit, { fontSize: sf(12) }]} onPress={() => Linking.openURL('https://chu-rit.github.io/').catch(() => {})}>Created by ChuRit</Text>
            <Text style={[styles.version, { fontSize: sf(12) }]}>v{appConfig.expo.version}-d</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, backgroundColor: '#fdfbf6', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 16, padding: 20, gap: 12 },
  eyebrow: { color: '#e08a3c', fontSize: 11, fontWeight: '800' },
  title: { color: '#3a2e1f', fontSize: 17, fontWeight: '800' },
  description: { color: '#7a6450', fontSize: 13 },
  content: { gap: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  credit: { color: '#4a6fa5', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  version: { color: '#7a6450', fontSize: 12, fontWeight: '600', textAlign: 'right' },
  closeButton: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d8cdb8', borderRadius: 8, backgroundColor: '#f0ebe0', zIndex: 1 },
  closeButtonText: { color: '#7a6450', fontSize: 22, lineHeight: 24, fontWeight: '500' },
});
