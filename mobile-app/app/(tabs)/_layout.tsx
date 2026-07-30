import { Tabs } from 'expo-router';
import { type ColorValue, Text } from 'react-native';
import { colors } from '@/theme';
import { useMobileConfig } from '@/state/MobileConfigProvider';

const TabIcon = ({ value, color }: { value: string; color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{value}</Text>;

export default function TabsLayout() {
  const config = useMobileConfig();
  const visible = (key: string) => config?.navigation?.[key] !== false;
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { color: colors.ink, fontWeight: '800' },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { height: 66, paddingBottom: 8, paddingTop: 6 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', href: visible('home') ? undefined : null, headerShown: false, tabBarIcon: ({ color }) => <TabIcon value="⌂" color={color} /> }} />
      <Tabs.Screen name="phones" options={{ title: 'Phones', href: visible('phones') ? undefined : null, tabBarIcon: ({ color }) => <TabIcon value="▣" color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', href: visible('search') ? undefined : null, tabBarIcon: ({ color }) => <TabIcon value="⌕" color={color} /> }} />
      <Tabs.Screen name="brands" options={{ title: 'Brands', href: visible('brands') ? undefined : null, tabBarIcon: ({ color }) => <TabIcon value="◇" color={color} /> }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', href: visible('saved') && config?.features?.savedPhones !== false ? undefined : null, tabBarIcon: ({ color }) => <TabIcon value="♡" color={color} /> }} />
    </Tabs>
  );
}
