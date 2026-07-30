import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PhoneCard } from '@/components/PhoneCard';
import { EmptyState, LoadingState } from '@/components/ScreenState';
import { useSavedPhones } from '@/state/SavedPhonesProvider';
import { colors, radius, space } from '@/theme';

export default function SavedScreen() {
  const { wishlist, compare, recent, hydrated } = useSavedPhones();
  if (!hydrated) return <LoadingState label="Loading saved phones…" />;
  return (
    <FlatList
      data={wishlist}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <View style={styles.cell}><PhoneCard phone={item} /></View>}
      ListHeaderComponent={
        <>
          <Text style={styles.heading}>Saved phones</Text>
          <Link href="/compare" asChild>
            <Pressable style={styles.compareButton}>
              <View>
                <Text style={styles.compareTitle}>Compare phones</Text>
                <Text style={styles.compareCopy}>{compare.length}/6 selected</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
          </Link>
          {wishlist.length ? <Text style={styles.sectionTitle}>Wishlist</Text> : null}
        </>
      }
      ListEmptyComponent={<EmptyState title="Your wishlist is empty" message="Tap the heart on any phone to save it here." />}
      ListFooterComponent={
        recent.length ? (
          <View style={styles.recent}>
            <Text style={styles.sectionTitle}>Recently viewed</Text>
            <FlatList
              horizontal
              data={recent}
              keyExtractor={(item) => `recent-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
              renderItem={({ item }) => <View style={styles.recentCard}><PhoneCard phone={item} /></View>}
            />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xl },
  row: { gap: space.sm },
  cell: { flex: 1, marginBottom: space.sm },
  heading: { color: colors.ink, fontSize: 26, fontWeight: '900', marginBottom: space.md },
  compareButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.lg, flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.lg, padding: space.lg },
  compareTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  compareCopy: { color: '#b9c7da', marginTop: 3 },
  arrow: { color: '#fff', fontSize: 26 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: space.md },
  recent: { marginTop: space.xl },
  recentRow: { gap: space.sm, paddingRight: space.md },
  recentCard: { width: 190 },
});
