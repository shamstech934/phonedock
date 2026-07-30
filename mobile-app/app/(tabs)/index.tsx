import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBrands, getPhones } from '@/api/phones';
import type { Brand, Phone } from '@/api/types';
import { PhoneCard } from '@/components/PhoneCard';
import { ErrorState, LoadingState } from '@/components/ScreenState';
import { colors, radius, space } from '@/theme';
import { useMobileConfig } from '@/state/MobileConfigProvider';

const priceGroups = [
  { label: 'Entry', caption: 'Under 25K', max: 25000, tone: '#e8f5ff' },
  { label: 'Budget', caption: '25K – 50K', min: 25000, max: 50000, tone: '#edf0ff' },
  { label: 'Mid Range', caption: '50K – 100K', min: 50000, max: 100000, tone: '#f2ecff' },
  { label: 'Upper Mid', caption: '100K – 150K', min: 100000, max: 150000, tone: '#e8fbf6' },
  { label: 'Premium', caption: '150K – 250K', min: 150000, max: 250000, tone: '#fff4df' },
  { label: 'Flagship', caption: '250K+', min: 250000, tone: '#ffecef' },
];

const discoveries = [
  { label: 'PTA Approved', caption: 'Verified phones', symbol: '✓', params: { pta: 'approved' } },
  { label: '5G Phones', caption: 'Future ready', symbol: '5G', params: { fiveG: 'yes' } },
  { label: 'Compare', caption: 'Side by side', symbol: '⇄', route: '/compare' },
  { label: 'Saved', caption: 'Your shortlist', symbol: '♡', route: '/saved' },
];

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Pressable onPress={onPress} accessibilityRole="button"><Text style={styles.sectionAction}>{action} →</Text></Pressable> : null}
    </View>
  );
}

function CompactPhone({ phone }: { phone: Phone }) {
  return <View style={styles.phoneWidth}><PhoneCard phone={phone} /></View>;
}

function BrandTile({ brand, onPress }: { brand: Brand; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.brandTile, pressed && styles.pressed]} accessibilityLabel={`Browse ${brand.name} phones`}>
      <View style={styles.brandLogo}>
        {brand.logo ? <Image source={brand.logo} style={styles.brandImage} contentFit="contain" cachePolicy="memory-disk" /> : <Text style={styles.brandInitial}>{brand.name.slice(0, 1)}</Text>}
      </View>
      <Text style={styles.brandName} numberOfLines={1}>{brand.name}</Text>
      <Text style={styles.brandCount}>{brand.phoneCount !== undefined ? `${brand.phoneCount} phones` : 'Explore'}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const config = useMobileConfig();
  const latest = useQuery({ queryKey: ['phones', 'latest'], queryFn: () => getPhones({ collection: 'latest', limit: 8 }) });
  const brands = useQuery({ queryKey: ['brands'], queryFn: getBrands, staleTime: 10 * 60_000 });
  if (latest.isLoading || brands.isLoading) return <LoadingState label="Preparing PhoneDock…" />;
  if (latest.isError) return <ErrorState message={latest.error.message} onRetry={() => latest.refetch()} />;
  if (brands.isError) return <ErrorState message={brands.error.message} onRetry={() => brands.refetch()} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={styles.logoMark}><Text style={styles.logoGlyph}>▯</Text></View>
        <View style={styles.brandBlock}>
          <Text style={styles.wordmark}>{config?.branding?.siteName || 'PhoneDock'}</Text>
          <Text style={styles.tagline}>{config?.branding?.tagline || 'Pakistan’s phone guide'}</Text>
        </View>
        <Pressable onPress={() => router.push('/search')} style={styles.topIcon} accessibilityLabel="Search phones"><Text style={styles.topIconText}>⌕</Text></Pressable>
        <Pressable onPress={() => router.push('/saved')} style={styles.topIcon} accessibilityLabel="Open saved phones"><Text style={styles.topIconText}>♡</Text></Pressable>
      </View>

      <Pressable onPress={() => router.push('/search')} style={styles.search} accessibilityRole="search">
        <Text style={styles.searchIcon}>⌕</Text>
        <View style={styles.searchCopy}>
          <Text style={styles.searchTitle}>Which phone are you looking for?</Text>
          <Text style={styles.searchHint}>Search model, brand or chipset</Text>
        </View>
        <Text style={styles.searchArrow}>→</Text>
      </Pressable>

      {config?.campaign?.enabled && (config.campaign.title || config.campaign.image) ? <Pressable
        style={styles.campaign}
        onPress={() => {
          const url = config.campaign.actionUrl;
          if (!url) return;
          if (url.startsWith('/')) router.push(url as '/phones');
          else void Linking.openURL(url);
        }}
        accessibilityRole={config.campaign.actionUrl ? 'button' : undefined}
      >
        {config.campaign.image ? <Image source={config.campaign.image} style={styles.campaignImage} contentFit="cover" cachePolicy="memory-disk" /> : null}
        <View style={styles.campaignOverlay}>
          <Text style={styles.campaignTitle}>{config.campaign.title}</Text>
          {config.campaign.message ? <Text style={styles.campaignMessage} numberOfLines={2}>{config.campaign.message}</Text> : null}
          {config.campaign.actionLabel ? <Text style={styles.campaignAction}>{config.campaign.actionLabel} →</Text> : null}
        </View>
      </Pressable> : null}

      <View style={styles.hero}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <Text style={styles.heroEyebrow}>SMART PHONE DISCOVERY</Text>
        <Text style={styles.heroTitle}>Pakistan’s phones,{'\n'}sorted <Text style={styles.heroAccent}>your way.</Text></Text>
        <Text style={styles.heroCopy}>Reliable specs, PKR prices and practical comparisons without the clutter.</Text>
        <View style={styles.heroActions}>
          <Pressable onPress={() => router.push('/phones')} style={styles.heroPrimary}><Text style={styles.heroPrimaryText}>Browse phones</Text></Pressable>
          {config?.features?.compare !== false ? <Pressable onPress={() => router.push('/compare')} style={styles.heroSecondary}><Text style={styles.heroSecondaryText}>Compare</Text></Pressable> : null}
        </View>
        <View style={styles.heroStats}>
          <View><Text style={styles.statValue}>{latest.data?.total || '—'}</Text><Text style={styles.statLabel}>Published phones</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={styles.statValue}>{brands.data?.length || '—'}</Text><Text style={styles.statLabel}>Brands covered</Text></View>
        </View>
      </View>

      <SectionHeader title="Latest phones" action="See all" onPress={() => router.push('/phones')} />
      <FlatList
        horizontal
        data={latest.data?.items || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CompactPhone phone={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />

      <SectionHeader title="Browse by brand" action="All brands" onPress={() => router.push('/brands')} />
      <FlatList
        horizontal
        data={(brands.data || []).slice(0, 12)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BrandTile brand={item} onPress={() => router.push({ pathname: '/phones', params: { brand: item.slug } })} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />

      <SectionHeader title="Find your shortcut" />
      <View style={styles.discoveryGrid}>
        {discoveries.map(item => (
          <Pressable
            key={item.label}
            onPress={() => item.route ? router.push(item.route as '/compare') : router.push({ pathname: '/phones', params: item.params })}
            style={({ pressed }) => [styles.discoveryCard, pressed && styles.pressed]}
          >
            <View style={styles.discoveryIcon}><Text style={styles.discoverySymbol}>{item.symbol}</Text></View>
            <Text style={styles.discoveryTitle}>{item.label}</Text>
            <Text style={styles.discoveryCaption}>{item.caption}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Shop by budget" />
      <View style={styles.priceGrid}>
        {priceGroups.map(group => (
          <Pressable
            key={group.label}
            onPress={() => router.push({ pathname: '/phones', params: { priceMin: group.min ? String(group.min) : '', priceMax: group.max ? String(group.max) : '' } })}
            style={({ pressed }) => [styles.priceCard, { backgroundColor: group.tone }, pressed && styles.pressed]}
          >
            <Text style={styles.priceLabel}>{group.label}</Text>
            <Text style={styles.priceCaption}>{group.caption}</Text>
            <Text style={styles.priceArrow}>→</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.trustStrip}>
        <Text style={styles.trustMark}>✓</Text>
        <View style={styles.trustCopy}><Text style={styles.trustTitle}>Built for Pakistan</Text><Text style={styles.trustText}>PKR pricing · PTA context · Clean comparisons</Text></View>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface, flex: 1 },
  screen: { backgroundColor: colors.background },
  content: { paddingBottom: space.xl },
  topbar: { alignItems: 'center', backgroundColor: colors.surface, flexDirection: 'row', paddingHorizontal: space.md, paddingVertical: 13 },
  logoMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 13, height: 44, justifyContent: 'center', width: 44 },
  logoGlyph: { color: '#fff', fontSize: 25, fontWeight: '800', transform: [{ rotate: '90deg' }] },
  brandBlock: { flex: 1, marginLeft: 11 },
  wordmark: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  wordmarkBlue: { color: colors.primary },
  tagline: { color: colors.muted, fontSize: 10, marginTop: 1 },
  topIcon: { alignItems: 'center', backgroundColor: '#f3f7fc', borderRadius: 999, height: 40, justifyContent: 'center', marginLeft: 7, width: 40 },
  topIconText: { color: colors.ink, fontSize: 22 },
  search: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', margin: space.md, marginBottom: 0, padding: 14 },
  searchIcon: { color: colors.primary, fontSize: 25, marginRight: 10 },
  searchCopy: { flex: 1 },
  searchTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  searchHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  searchArrow: { color: colors.primary, fontSize: 22 },
  campaign: { backgroundColor: '#10264d', borderRadius: radius.lg, margin: space.md, marginBottom: 0, minHeight: 150, overflow: 'hidden', position: 'relative' },
  campaignImage: { ...StyleSheet.absoluteFillObject },
  campaignOverlay: { backgroundColor: 'rgba(5,18,45,0.58)', flex: 1, justifyContent: 'flex-end', minHeight: 150, padding: space.md },
  campaignTitle: { color: '#fff', fontSize: 21, fontWeight: '900' },
  campaignMessage: { color: '#dbeafe', fontSize: 12, lineHeight: 18, marginTop: 4 },
  campaignAction: { color: '#7dd3fc', fontSize: 13, fontWeight: '900', marginTop: 9 },
  hero: { backgroundColor: '#10264d', borderRadius: 28, margin: space.md, minHeight: 350, overflow: 'hidden', padding: space.lg, position: 'relative' },
  heroGlowOne: { backgroundColor: '#1769ff', borderRadius: 999, height: 260, opacity: 0.24, position: 'absolute', right: -90, top: -80, width: 260 },
  heroGlowTwo: { backgroundColor: '#00bfd8', borderRadius: 999, bottom: -100, height: 220, opacity: 0.16, position: 'absolute', right: 30, width: 220 },
  heroEyebrow: { color: '#8fb6ff', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 40, marginTop: space.md },
  heroAccent: { color: '#5ba5ff' },
  heroCopy: { color: '#c4d0e2', fontSize: 14, lineHeight: 21, marginTop: space.md, maxWidth: 310 },
  heroActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  heroPrimary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 17, paddingVertical: 13 },
  heroPrimaryText: { color: '#fff', fontWeight: '900' },
  heroSecondary: { borderColor: '#6880a3', borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 17, paddingVertical: 13 },
  heroSecondaryText: { color: '#fff', fontWeight: '800' },
  heroStats: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, flexDirection: 'row', marginTop: space.lg, padding: 13 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#9eafc7', fontSize: 10, marginTop: 2 },
  statDivider: { backgroundColor: '#4b607f', height: 34, marginHorizontal: 22, width: 1 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.md, paddingTop: space.lg },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  sectionAction: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  horizontalList: { gap: space.sm, padding: space.md },
  phoneWidth: { width: 210 },
  brandTile: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, padding: 14, width: 132 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  brandLogo: { alignItems: 'center', backgroundColor: '#f5f8fc', borderRadius: radius.md, height: 70, justifyContent: 'center', width: 70 },
  brandImage: { height: 52, width: 58 },
  brandInitial: { color: colors.primary, fontSize: 27, fontWeight: '900' },
  brandName: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 10 },
  brandCount: { color: colors.muted, fontSize: 10, marginTop: 3 },
  discoveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md },
  discoveryCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, padding: space.md, width: '48.7%' },
  discoveryIcon: { alignItems: 'center', backgroundColor: '#eaf2ff', borderRadius: 13, height: 42, justifyContent: 'center', width: 42 },
  discoverySymbol: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  discoveryTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 13 },
  discoveryCaption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md },
  priceCard: { borderRadius: radius.lg, minHeight: 105, padding: space.md, position: 'relative', width: '48.7%' },
  priceLabel: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  priceCaption: { color: colors.muted, fontSize: 11, marginTop: 5 },
  priceArrow: { bottom: 12, color: colors.primary, fontSize: 19, position: 'absolute', right: 14 },
  trustStrip: { alignItems: 'center', backgroundColor: '#e8fbf5', borderColor: '#c8eee2', borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', margin: space.md, padding: space.md },
  trustMark: { color: colors.success, fontSize: 25, fontWeight: '900', marginRight: 13 },
  trustCopy: { flex: 1 },
  trustTitle: { color: colors.ink, fontWeight: '900' },
  trustText: { color: colors.muted, fontSize: 11, marginTop: 3 },
});
