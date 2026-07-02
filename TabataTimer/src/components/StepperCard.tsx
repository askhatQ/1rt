import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radii, layout } from '../theme/tokens';
import type { StepperConfig } from '../types';

interface Props {
  config: StepperConfig;
  value: number;
  onChange: (value: number) => void;
}

export function StepperCard({ config, value, onChange }: Props) {
  const atMin = value <= config.min;
  const atMax = value >= config.max;

  const decrement = () => {
    if (atMin) return;
    onChange(Math.max(config.min, value - config.step));
  };

  const increment = () => {
    if (atMax) return;
    onChange(Math.min(config.max, value + config.step));
  };

  return (
    <View style={styles.card}>
      <View style={styles.labels}>
        <Text style={styles.label}>{config.label}</Text>
        <Text style={styles.hint}>{config.hint}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={decrement}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel={`Уменьшить: ${config.label}`}
          accessibilityState={{ disabled: atMin }}
          style={[styles.circleBtn, { backgroundColor: colors.track }, atMin && styles.disabled]}
        >
          <Text style={styles.circleBtnText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          onPress={increment}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityLabel={`Увеличить: ${config.label}`}
          accessibilityState={{ disabled: atMax }}
          style={[styles.circleBtn, { backgroundColor: colors.orange }, atMax && styles.disabled]}
        >
          <Text style={styles.circleBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: layout.cardWidth,
    minHeight: 88,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labels: {
    flexShrink: 1,
    paddingRight: 12,
  },
  label: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 16,
    marginBottom: 4,
  },
  hint: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 22,
  },
  value: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 20,
    minWidth: 32,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
