import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useSessionsStore, DEFAULT_DRAFT, SessionDraft } from '../state/sessionsStore';
import { StepperCard } from '../components/StepperCard';
import { CtaButton } from '../components/CtaButton';
import { STEPPER_CONFIGS } from '../utils/steppers';
import { totalDurationSec, formatDuration } from '../utils/session';
import { totalPhaseChangeEvents } from '../state/tabataStateMachine';
import { MAX_SCHEDULED_NOTIFICATIONS } from '../state/phaseNotifications';
import { colors, fonts, spacing, layout, radii } from '../theme/tokens';

const NAME_MAX_LENGTH = 30;

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation, route }: Props) {
  const sessionId = route.params?.sessionId;
  const existing = useSessionsStore((s) => (sessionId ? s.getById(sessionId) : undefined));
  const upsert = useSessionsStore((s) => s.upsert);

  const [draft, setDraft] = useState<SessionDraft>(() =>
    existing
      ? {
          name: existing.name,
          workSec: existing.workSec,
          restSec: existing.restSec,
          rounds: existing.rounds,
          cycles: existing.cycles,
          restBetweenCyclesSec: existing.restBetweenCyclesSec,
        }
      : DEFAULT_DRAFT
  );

  const trimmedName = draft.name.trim();
  const canStart = trimmedName.length > 0;

  const total = useMemo(() => totalDurationSec(draft), [draft]);
  const phaseChangeEvents = useMemo(() => totalPhaseChangeEvents(draft), [draft.rounds, draft.cycles]);
  const exceedsNotificationCap = phaseChangeEvents > MAX_SCHEDULED_NOTIFICATIONS;

  const setField = <K extends keyof SessionDraft>(field: K, value: SessionDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const onStart = () => {
    if (!canStart) return;
    const saved = upsert(sessionId, { ...draft, name: trimmedName });
    if (route.params?.fromTimer) {
      navigation.goBack();
    } else {
      navigation.replace('Timer', { sessionId: saved.id });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>НАСТРОЙКА СЕССИИ</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.nameCard}>
            <Text style={styles.nameLabel}>НАЗВАНИЕ СЕССИИ</Text>
            <TextInput
              value={draft.name}
              onChangeText={(text) => setField('name', text)}
              placeholder="Введите название"
              placeholderTextColor={colors.dimGray}
              maxLength={NAME_MAX_LENGTH}
              style={styles.nameInput}
              accessibilityLabel="Название сессии"
            />
          </View>

          {STEPPER_CONFIGS.map((config) => (
            <StepperCard
              key={config.field}
              config={config}
              value={draft[config.field]}
              onChange={(value) => setField(config.field, value)}
            />
          ))}

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Общая длительность</Text>
            <Text style={styles.totalValue}>{formatDuration(total)}</Text>
          </View>

          {exceedsNotificationCap && (
            <View style={styles.warningCard} accessibilityRole="text">
              <Text style={styles.warningText}>
                ⚠ В этой сессии {phaseChangeEvents} смен фазы — больше, чем помещается в разовое
                расписание фоновых уведомлений ({MAX_SCHEDULED_NOTIFICATIONS}). Если держать
                приложение открытым, уведомления будут пополняться сами. Но если свернуть
                приложение надолго и не открывать его — уведомления придут только для первых
                ~{MAX_SCHEDULED_NOTIFICATIONS} смен фазы, а дальше молча прекратятся. Сам таймер
                при этом продолжит работать корректно — пострадают только фоновые уведомления.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <CtaButton label="НАЧАТЬ" onPress={onStart} disabled={!canStart} />
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  headerTitle: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: 24,
    gap: spacing.cardGap,
  },
  nameCard: {
    width: layout.cardWidth,
    minHeight: 92,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.orange,
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  nameLabel: {
    color: colors.orange,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  nameInput: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 20,
    padding: 0,
  },
  totalCard: {
    width: layout.cardWidth,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.track,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    color: colors.gray,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  totalValue: {
    color: colors.orange,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  warningCard: {
    width: layout.cardWidth,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.orange,
    backgroundColor: colors.cardSelected,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
  warningText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: 16,
    alignItems: 'center',
  },
});
