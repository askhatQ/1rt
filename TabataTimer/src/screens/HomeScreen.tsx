import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useSessionsStore } from '../state/sessionsStore';
import { SessionCard } from '../components/SessionCard';
import { CtaButton } from '../components/CtaButton';
import { colors, fonts, spacing, layout } from '../theme/tokens';
import type { TabataSession } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const sessions = useSessionsStore((s) => s.sessions);
  const selectedId = useSessionsStore((s) => s.selectedId);
  const select = useSessionsStore((s) => s.select);
  const remove = useSessionsStore((s) => s.remove);

  const openNewSession = useCallback(() => {
    navigation.navigate('Settings', {});
  }, [navigation]);

  const startSelected = useCallback(() => {
    if (!selectedId) return;
    navigation.navigate('Timer', { sessionId: selectedId });
  }, [navigation, selectedId]);

  const onLongPressCard = useCallback(
    (session: TabataSession) => {
      Alert.alert(session.name, undefined, [
        {
          text: 'Редактировать',
          onPress: () => navigation.navigate('Settings', { sessionId: session.id }),
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Удалить сессию?', session.name, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Удалить', style: 'destructive', onPress: () => remove(session.id) },
            ]),
        },
        { text: 'Отмена', style: 'cancel' },
      ]);
    },
    [navigation, remove]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>МОИ СЕССИИ</Text>
          <Text style={styles.subtitle}>{sessions.length} сохранённых</Text>
        </View>
        <Pressable
          onPress={openNewSession}
          accessibilityRole="button"
          accessibilityLabel="Создать новую сессию"
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>⏱️</Text>
            </View>
            <Text style={styles.emptyTitle}>Пока нет сессий</Text>
            <Text style={styles.emptyText}>
              Создайте первую сессию Табата, чтобы начать тренировку
            </Text>
            <CtaButton
              label="СОЗДАТЬ ПЕРВУЮ СЕССИЮ"
              onPress={openNewSession}
              style={styles.emptyCta}
            />
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            selected={item.id === selectedId}
            onPress={() => select(item.id)}
            onLongPress={() => onLongPressCard(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.cardGap }} />}
        ListFooterComponent={
          sessions.length > 0 ? (
            <Pressable
              onPress={openNewSession}
              style={styles.newCard}
              accessibilityRole="button"
              accessibilityLabel="Новая сессия"
            >
              <Text style={styles.newCardText}>+ Новая сессия</Text>
            </Pressable>
          ) : null
        }
      />

      <View style={styles.footer}>
        <CtaButton
          label="НАЧАТЬ ВЫБРАННУЮ"
          onPress={startSelected}
          disabled={!selectedId}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 12,
    paddingBottom: 20,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 18,
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: 4,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 24,
  },
  listContent: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: 24,
    flexGrow: 1,
  },
  newCard: {
    width: layout.cardWidth,
    height: 76,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.track,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.cardGap,
  },
  newCardText: {
    color: colors.gray,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  empty: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyCta: {
    marginTop: 28,
  },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 18,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
  },
  footer: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: 16,
    alignItems: 'center',
  },
});
