import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Path, Svg, G, Rect, Defs, ClipPath } from 'react-native-svg';
import glyphPaths from '../data/glyphPaths.json';

const FONT_SIZE = 72;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

let clipCounter = 0;

function SubPath({ sub, bb, delay, duration, color, scale, offsetX, fontSize, animate }) {
  const revealAnim = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const clipId = useRef(`sp-${clipCounter++}`).current;

  useEffect(() => {
    if (!animate) {
      revealAnim.setValue(1);
      return;
    }
    revealAnim.setValue(0);
    Animated.timing(revealAnim, {
      toValue: 1,
      delay,
      duration,
      useNativeDriver: false,
    }).start();
  }, [animate, delay, duration]);

  const glyphW = (bb.x2 - bb.x1) * scale;
  const glyphH = (bb.y2 - bb.y1) * scale;
  const tx = offsetX + (fontSize - glyphW) / 2 - bb.x1 * scale;
  const ty = (fontSize - glyphH) / 2 - bb.y1 * scale;

  // sub-path의 x 범위에 맞춰 클립
  const subX1 = offsetX + (fontSize - glyphW) / 2 + (sub.x1 - bb.x1) * scale;
  const subW = (sub.x2 - sub.x1) * scale;

  return (
    <G>
      <Defs>
        <ClipPath id={clipId}>
          <AnimatedRect
            x={subX1}
            y={0}
            width={revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0, subW + 2] })}
            height={fontSize}
          />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <G transform={`translate(${tx}, ${ty}) scale(${scale}, ${scale})`}>
          <Path d={sub.d} fill={color} />
        </G>
      </G>
    </G>
  );
}

function HandwrittenText({ text, color = '#3a2e1f', fontSize = 20, duration = 400, stagger = 80, delay = 0, strokeWidth = 1.5, animate = false, style }) {
  const chars = useMemo(() => [...text], [text]);
  const scale = fontSize / FONT_SIZE;
  const charWidth = fontSize;

  return (
    <View style={[styles.container, { width: chars.length * charWidth, height: fontSize }, style]} pointerEvents="none">
      <Svg width={chars.length * charWidth} height={fontSize} viewBox={`0 0 ${chars.length * charWidth} ${fontSize}`}>
        {chars.map((ch, i) => {
          const glyph = glyphPaths[ch];
          if (!glyph) return null;
          const subs = glyph.subs || [glyph];
          return subs.map((sub, si) => (
            <SubPath
              key={`${ch}-${i}-${si}`}
              sub={sub}
              bb={glyph.bb}
              delay={delay + i * stagger + si * (duration / 2)}
              duration={duration}
              color={color}
              scale={scale}
              offsetX={i * charWidth}
              fontSize={fontSize}
              animate={animate}
            />
          ));
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});

export default HandwrittenText;
