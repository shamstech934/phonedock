import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme';

export function LoadingState({ label = 'Loading PhoneDock…' }: { label?: string }) {
  return (
    <View style={styles.state} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.state}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.state} accessibilityRole="alert">
      <Text style={styles.title}>Couldn’t load this page</Text>
      <Text style={styles.muted}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', gap: space.sm, justifyContent: 'center', padding: space.xl },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  muted: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 999, marginTop: space.sm, paddingHorizontal: 22, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
