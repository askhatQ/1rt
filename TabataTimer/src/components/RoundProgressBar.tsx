import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { colors, fonts, layout } from '../theme/tokens';

interface Props {
  currentRound: number; // 1-indexed
  totalRounds: number;
  fraction: number; // (completedRounds + currentRoundProgress) / totalRounds, 0..1
}

export function RoundProgressBar({ currentRound, totalRounds, fraction }: Props) {
  const [width, setWidth] = React.useState<number>(layout.cardWidth);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const clamped = Math.max(0, Math.min(1, fraction));

  const dividers = Array.from({ length: Math.max(0, totalRounds - 1) }, (_, i) => i + 1);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>РАУНД</Text>
        <Text style={styles.count}>
          {Math.min(currentRound, totalRounds)} / {totalRounds}
        </Text>
      </View>
      <View style={styles.track} onLayout={onLayout}>
        <View style={[styles.fill, { width: width * clamped }]} />
        {dividers.map((i) => (
          <View
            key={i}
            style={[styles.divider, { left: (width * i) / totalRounds - 1 }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: layout.cardWidth,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: colors.gray,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  count: {
    color: colors.orange,
    fontFamily: fonts.extraBold,
    fontSize: 12,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.orange,
    borderRadius: 4,
  },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.bg,
  },
});
