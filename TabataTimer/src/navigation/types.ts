export type RootStackParamList = {
  Home: undefined;
  Settings: { sessionId?: string; fromTimer?: boolean };
  Timer: { sessionId: string };
};
