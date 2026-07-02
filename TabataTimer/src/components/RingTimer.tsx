import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens';

const SIZE = 260;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  remainingSec: number;
  progress: number; // 0..1, fraction of phase remaining (1 = full ring, 0 = empty)
  color: string;
  label: string;
}

export function RingTimer({ remainingSec, progress, color, label }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = CIRCUMFERENCE * (1 - clamped);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.track}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
          rotation={-90}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.number}>{Math.max(0, Math.ceil(remainingSec))}</Text>
        <Text style={styles.unit}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  number: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 76,
  },
  unit: {
    color: colors.gray,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: 2,
    marginTop: -8,
  },
});
