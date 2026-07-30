import { Image } from 'expo-image';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '@/components/PhoneCard';
import { EmptyState, LoadingState } from '@/components/ScreenState';
import { useSavedPhones } from '@/state/SavedPhonesProvider';
import { colors, radius, space } from '@/theme';

const fields: Array<{ label: string; keys: string[] }> = [
  { label: 'Price', keys: ['pricePKR'] },
  { label: 'RAM', keys: ['ram', 'ramGB'] },
  { label: 'Storage', keys: ['storage', 'storageGB'] },
  { label: 'Display', keys: ['display', 'screenSize', 'screenSizeInch'] },
  { label: 'Chipset', keys: ['chipset'] },
  { label: 'Battery', keys: ['battery', 'batteryMAh'] },
  { label: 'Release', keys: ['releaseDate'] },
];

function valueFor(phone: ReturnType<typeof useSavedPhones>['compare'][number], keys: string[]) {
  if (keys[0] === 'pricePKR') return formatPrice(phone.pricePKR);
  if (keys[0] === 'releaseDate') return phone.releaseDate || 'Not available';
  const specs = phone.specs || {};
  const value = keys.map(key => specs[key]).find(item => item !== undefined && item !== null && item !== '');
  return value === undefined ? 'Not available' : String(value);
}

export default function CompareScreen() {
  const { compare, hydrated, removeCompare, clearCompare } = useSavedPhones();
  if (!hydrated) return <LoadingState label="Loading comparison…" />;
  if (!compare.length) return <EmptyState title="No phones selected" message="Use the compare button on phone cards to add up to six phones." />;
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <View><Text style={styles.heading}>Compare</Text><Text style={styles.copy}>{compare.length}/6 phones selected</Text></View>
        <Pressable onPress={clearCompare} accessibilityRole="button"><Text style={styles.clear}>Clear all</Text></Pressable>
      </View>
      {compare.length < 2 ? <Text style={styles.tip}>Add one more phone to begin a meaningful comparison.</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.phoneRow}>
            <View style={styles.labelCell} />
            {compare.map(phone => (
              <View style={styles.phoneCell} key={phone.id}>
                <Image source={phone.thumbnail || phone.heroImage} style={styles.image} contentFit="contain" cachePolicy="memory-disk" />
                <Text style={styles.phoneName} numberOfLines={2}>{phone.modelName}</Text>
                <Pressable onPress={() => removeCompare(phone.id)}><Text style={styles.remove}>Remove</Text></Pressable>
              </View>
            ))}
          </View>
          {fields.map((field, index) => (
            <View style={[styles.dataRow, index % 2 === 0 && styles.altRow]} key={field.label}>
              <View style={styles.labelCell}><Text style={styles.label}>{field.label}</Text></View>
              {compare.map(phone => <View style={styles.valueCell} key={`${field.label}-${phone.id}`}><Text style={styles.value}>{valueFor(phone, field.keys)}</Text></View>)}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.md, paddingBottom: space.xl },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md },
  heading: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  copy: { color: colors.muted, marginTop: 2 },
  clear: { color: colors.danger, fontWeight: '700' },
  tip: { backgroundColor: '#fff8df', borderRadius: radius.md, color: '#795b00', marginBottom: space.md, padding: space.md },
  phoneRow: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, flexDirection: 'row', minHeight: 190, paddingVertical: space.md },
  labelCell: { justifyContent: 'center', padding: space.sm, width: 110 },
  phoneCell: { alignItems: 'center', paddingHorizontal: space.sm, width: 170 },
  image: { height: 110, width: 120 },
  phoneName: { color: colors.ink, fontWeight: '800', minHeight: 42, textAlign: 'center' },
  remove: { color: colors.danger, fontSize: 12, marginTop: space.xs },
  dataRow: { backgroundColor: colors.surface, flexDirection: 'row', minHeight: 64 },
  altRow: { backgroundColor: '#f5f8fc' },
  label: { color: colors.muted, fontWeight: '700' },
  valueCell: { justifyContent: 'center', padding: space.sm, width: 170 },
  value: { color: colors.ink, fontWeight: '600', textAlign: 'center' },
});
