import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useSessionsStore } from '../state/sessionsStore';
import { useTabataTimer } from '../state/useTabataTimer';
import { RingTimer } from '../components/RingTimer';
import { RoundProgressBar } from '../components/RoundProgressBar';
import { CtaButton } from '../components/CtaButton';
import { colors, fonts, spacing } from '../theme/tokens';
import { phaseLabel, isWorkPhase, roundProgressFraction } from '../utils/timerDisplay';
import type { TabataSession } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Timer'>;

export function TimerScreen({ navigation, route }: Props) {
  const session = useSessionsStore((s) => s.getById(route.params.sessionId));

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.missing}>
          <Text style={styles.missingText}>Сессия не найдена</Text>
          <CtaButton label="НА ГЛАВНУЮ" onPress={() => navigation.navigate('Home')} />
        </View>
      </SafeAreaView>
    );
  }

  return <TimerScreenBody key={session.updatedAt} session={session} navigation={navigation} />;
}

function TimerScreenBody({
  session,
  navigation,
}: {
  session: TabataSession;
  navigation: Props['navigation'];
}) {
  const engine = useTabataTimer(session);

  const close = useCallback(() => {
    if (engine.isRunning) {
      Alert.alert('Завершить тренировку?', 'Таймер сейчас идёт.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Выйти', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  }, [engine.isRunning, navigation]);

  const openSettings = useCallback(() => {
    navigation.navigate('Settings', { sessionId: session.id, fromTimer: true });
  }, [navigation, session.id]);

  const hasStarted = engine.isRunning || engine.remainingSec < engine.phaseDurationSec;

  const onReset = useCallback(() => {
    if (hasStarted && engine.phase !== 'finished') {
      Alert.alert('Сбросить таймер?', 'Прогресс текущей тренировки будет потерян.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Сбросить', style: 'destructive', onPress: engine.reset },
      ]);
    } else {
      engine.reset();
    }
  }, [hasStarted, engine]);

  const ringColor = isWorkPhase(engine.phase) ? colors.orange : colors.green;
  const phaseColor = isWorkPhase(engine.phase) ? colors.orange : colors.green;
  const ringProgress = engine.phaseDurationSec > 0 ? engine.remainingSec / engine.phaseDurationSec : 0;
  const roundFraction = roundProgressFraction(session, engine);
  const isFinished = engine.phase === 'finished';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Закрыть тренировку"
          style={styles.iconButton}
        >
          <Text style={styles.iconButtonText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {session.name.toUpperCase()}
        </Text>
        <Pressable
          onPress={openSettings}
          accessibilityRole="button"
          accessibilityLabel="Настройки сессии"
          style={styles.iconButton}
        >
          <Text style={styles.iconButtonText}>⚙</Text>
        </Pressable>
      </View>

      {isFinished ? (
        <View style={styles.finishedWrap}>
          <Text style={styles.finishedTitle}>ТРЕНИРОВКА ЗАВЕРШЕНА 🎉</Text>
          <Text style={styles.finishedSubtitle}>{session.name}</Text>
          <CtaButton
            label="НА ГЛАВНУЮ"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 32 }}
          />
        </View>
      ) : (
        <>
          <View style={styles.progressWrap}>
            <RoundProgressBar
              currentRound={engine.currentRound}
              totalRounds={session.rounds}
              fraction={roundFraction}
            />
          </View>

          <Text style={[styles.phase, { color: phaseColor }]}>
            {phaseLabel(engine.phase).toUpperCase()}
          </Text>

          <View style={styles.ringWrap}>
            <RingTimer
              remainingSec={engine.remainingSec}
              progress={ringProgress}
              color={ringColor}
              label="СЕКУНД"
            />
          </View>

          <Text style={styles.nextLine}>
            Далее: {phaseLabel(engine.nextPhase)} · {engine.nextPhaseDurationSec} сек
          </Text>

          <View style={styles.controls}>
            <Pressable
              onPress={onReset}
              accessibilityRole="button"
              accessibilityLabel="Сбросить таймер"
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>RESET</Text>
            </Pressable>
            <Pressable
              onPress={engine.toggleRunning}
              accessibilityRole="button"
              accessibilityLabel={engine.isRunning ? 'Пауза' : 'Начать'}
              style={styles.playButton}
            >
              <Text style={styles.playButtonText}>{engine.isRunning ? 'PAUSE' : 'PLAY'}</Text>
            </Pressable>
            <Pressable
              onPress={engine.skip}
              accessibilityRole="button"
              accessibilityLabel="Пропустить фазу"
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>SKIP</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  missingText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 12,
    paddingBottom: 16,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    color: colors.white,
    fontSize: 16,
  },
  headerTitle: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 18,
    flexShrink: 1,
    marginHorizontal: 12,
  },
  progressWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  phase: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 24,
  },
  ringWrap: {
    alignItems: 'center',
  },
  nextLine: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 'auto',
    marginBottom: 24,
  },
  smallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: colors.gray,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    color: colors.white,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  finishedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenHorizontal,
  },
  finishedTitle: {
    color: colors.orange,
    fontFamily: fonts.extraBold,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  finishedSubtitle: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: 'center',
  },
});
