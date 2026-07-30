import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMobileConfig, type MobileConfig } from '@/api/config';
import { colors, radius, space } from '@/theme';

const ConfigContext = createContext<MobileConfig | null>(null);

function compareVersions(current: string, required: string) {
  const normalize = (value: string) => value.split('.').map(part => Number.parseInt(part, 10) || 0);
  const left = normalize(current); const right = normalize(required);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return 1;
    if ((left[index] || 0) < (right[index] || 0)) return -1;
  }
  return 0;
}

export function MobileConfigProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['mobile-config'],
    queryFn: getMobileConfig,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 2,
  });
  if (query.isLoading) return <Gate title="Preparing PhoneDock" message="Loading the latest configuration…" loading />;

  // Network/config failures do not brick an installed app. It continues with its bundled safe defaults.
  if (!query.data) return <ConfigContext.Provider value={null}>{children}</ConfigContext.Provider>;
  const config = query.data;
  const currentVersion = Constants.expoConfig?.version || '0.0.0';
  const updateRequired = config.forceUpdate && compareVersions(currentVersion, config.minimumVersion) < 0;
  if (!config.enabled || config.maintenanceMode) {
    return <Gate title={config.maintenanceTitle} message={config.maintenanceMessage} action="Try again" onAction={() => void query.refetch()} />;
  }
  if (updateRequired) {
    const url = Platform.OS === 'ios' ? config.updateUrlIos : config.updateUrlAndroid;
    return <Gate title="A PhoneDock update is required" message={`Version ${config.minimumVersion} or newer is required for security and compatibility.`} action={url ? 'Update app' : 'Try again'} onAction={() => url ? void Linking.openURL(url) : void query.refetch()} />;
  }
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useMobileConfig = () => useContext(ConfigContext);

function Gate({ title, message, loading = false, action, onAction }: { title: string; message: string; loading?: boolean; action?: string; onAction?: () => void }) {
  return <SafeAreaView style={styles.safe}><View style={styles.card}>
    <View style={styles.mark}><Text style={styles.markText}>PD</Text></View>
    <Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text>
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
    {action && onAction ? <Pressable onPress={onAction} style={styles.button}><Text style={styles.buttonText}>{action}</Text></Pressable> : null}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', padding: space.lg },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, maxWidth: 420, padding: space.xl, width: '100%' },
  mark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, height: 58, justifyContent: 'center', width: 58 },
  markText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 23, fontWeight: '900', marginTop: space.lg, textAlign: 'center' },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: space.sm, textAlign: 'center' },
  loader: { marginTop: space.lg },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, marginTop: space.lg, paddingHorizontal: 22, paddingVertical: 13 },
  buttonText: { color: '#fff', fontWeight: '900' },
});
