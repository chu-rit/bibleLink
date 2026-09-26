import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Path, Svg, G } from 'react-native-svg';
import glyphPaths from '../data/glyphPaths.json';

const FONT_SIZE = 72;

function CharGlyph({ glyph, delay, color, scale, offsetX, fontSize, animate }) {
  const pop = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      delay,
      speed: 14,
      bounciness: 12,
      useNativeDriver: false,
    }).start();
  }, [animate, delay]);

  const bb = glyph.bb;
  const glyphW = (bb.x2 - bb.x1) * scale;
  const glyphH = (bb.y2 - bb.y1) * scale;
  const tx = (fontSize - glyphW) / 2 - bb.x1 * scale;
  const ty = (fontSize - glyphH) / 2 - bb.y1 * scale;
  const subs = glyph.subs || [glyph];

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: offsetX,
        width: fontSize,
        height: fontSize,
        opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
      }}
    >
      <Svg width={fontSize} height={fontSize} viewBox={`0 0 ${fontSize} ${fontSize}`}>
        <G transform={`translate(${tx}, ${ty}) scale(${scale}, ${scale})`}>
          {subs.map((sub, si) => (
            <Path key={si} d={sub.d} fill={color} fillRule="evenodd" />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

function HandwrittenText({ text, color = '#3a2e1f', fontSize = 20, duration = 250, stagger = 0, delay = 0, strokeWidth = 1.5, animate = false, style }) {
  const chars = [...text];
  const scale = fontSize / FONT_SIZE;
  const charWidth = fontSize;

  return (
    <View style={[styles.container, { width: chars.length * charWidth, height: fontSize }, style]} pointerEvents="none">
      {chars.map((ch, i) => {
        const glyph = glyphPaths[ch];
        if (!glyph) return null;
        return (
          <CharGlyph
            key={`${ch}-${i}`}
            glyph={glyph}
            delay={delay + i * stagger}
            color={color}
            scale={scale}
            offsetX={i * charWidth}
            fontSize={fontSize}
            animate={animate}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});

export default HandwrittenText;
