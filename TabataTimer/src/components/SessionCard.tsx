import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radii, layout } from '../theme/tokens';
import { summaryLine } from '../utils/session';
import type { TabataSession } from '../types';

interface Props {
  session: TabataSession;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export function SessionCard({ session, selected, onPress, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Сессия ${session.name}`}
      accessibilityState={{ selected }}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={[styles.accent, { backgroundColor: session.accentColor }]} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {session.name}
        </Text>
        <Text style={styles.summary} numberOfLines={1}>
          {summaryLine(session)}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: selected ? colors.orange : colors.dimGray }]}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: layout.cardWidth,
    height: 76,
    borderRadius: radii.card,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cardSelected: {
    backgroundColor: colors.cardSelected,
    borderColor: colors.orange,
  },
  accent: {
    width: 4,
    height: 44,
    borderRadius: 2,
    marginRight: 16,
  },
  info: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 16,
    marginBottom: 4,
  },
  summary: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  chevron: {
    fontFamily: fonts.bold,
    fontSize: 22,
  },
});
