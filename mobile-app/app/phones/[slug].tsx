import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getPhone } from '@/api/phones';
import { formatPrice } from '@/components/PhoneCard';
import { ErrorState, LoadingState } from '@/components/ScreenState';
import { colors, radius, space } from '@/theme';
import { useSavedPhones } from '@/state/SavedPhonesProvider';

function Spec({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return <View style={styles.spec}><Text style={styles.specLabel}>{label}</Text><Text style={styles.specValue}>{String(value)}</Text></View>;
}

export default function PhoneDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { recordViewed, isWishlisted, isCompared, toggleWishlist, toggleCompare } = useSavedPhones();
  const query = useQuery({ queryKey: ['phone', slug], queryFn: () => getPhone(slug), enabled: Boolean(slug) });
  useEffect(() => { if (query.data) recordViewed(query.data); }, [query.data, recordViewed]);
  if (query.isLoading) return <LoadingState label="Loading phone details…" />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const phone = query.data;
  if (!phone) return null;
  const specs = phone.specs || {};
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Image source={phone.heroImage || phone.thumbnail} style={styles.image} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={`${phone.modelName} image`} />
      </View>
      <Text style={styles.brand}>{phone.brand?.name || 'PhoneDock'}</Text>
      <Text style={styles.title}>{phone.modelName}</Text>
      <Text style={styles.price}>{formatPrice(phone.pricePKR)}</Text>
      <View style={styles.actions}>
        <Text onPress={() => toggleWishlist(phone)} accessibilityRole="button" style={styles.actionButton}>
          {isWishlisted(phone) ? '♥ Saved' : '♡ Save'}
        </Text>
        <Text onPress={() => toggleCompare(phone)} accessibilityRole="button" style={styles.actionButton}>
          {isCompared(phone) ? '✓ Comparing' : '⇄ Compare'}
        </Text>
      </View>
      {phone.description ? <Text style={styles.description}>{phone.description}</Text> : null}
      <Text style={styles.heading}>Key specifications</Text>
      <View style={styles.specs}>
        <Spec label="RAM" value={specs.ram || specs.ramGB} />
        <Spec label="Storage" value={specs.storage || specs.storageGB} />
        <Spec label="Display" value={specs.display || specs.screenSize || specs.screenSizeInch} />
        <Spec label="Chipset" value={specs.chipset} />
        <Spec label="Battery" value={specs.battery || specs.batteryMAh} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xl },
  hero: { backgroundColor: colors.surface, borderRadius: radius.lg, height: 360, padding: space.md },
  image: { height: '100%', width: '100%' },
  brand: { color: colors.muted, fontWeight: '600', marginTop: space.lg },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginTop: space.xs },
  price: { color: colors.primary, fontSize: 21, fontWeight: '900', marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  actionButton: { backgroundColor: '#e9f1ff', borderColor: '#bdd2ff', borderRadius: radius.md, borderWidth: 1, color: colors.primary, flex: 1, fontWeight: '800', overflow: 'hidden', padding: 13, textAlign: 'center' },
  description: { color: colors.muted, lineHeight: 23, marginTop: space.md },
  heading: { color: colors.ink, fontSize: 21, fontWeight: '900', marginBottom: space.sm, marginTop: space.lg },
  specs: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  spec: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space.md, justifyContent: 'space-between', paddingVertical: 13 },
  specLabel: { color: colors.muted, flex: 1 },
  specValue: { color: colors.ink, flex: 2, fontWeight: '700', textAlign: 'right' },
});
