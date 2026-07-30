import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getBrands } from '@/api/phones';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { colors, radius, space } from '@/theme';

export default function BrandsScreen() {
  const query = useQuery({ queryKey: ['brands'], queryFn: getBrands, staleTime: 10 * 60_000 });
  if (query.isLoading) return <LoadingState label="Loading brands…" />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  return (
    <FlatList
      data={query.data}
      numColumns={2}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={<Text style={styles.heading}>Phone brands</Text>}
      ListEmptyComponent={<EmptyState title="No brands found" message="Published brands will appear here." />}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/phones', params: { brand: item.slug } }} asChild>
          <Pressable style={styles.card} accessibilityLabel={`Browse ${item.name} phones`}>
            <View style={styles.logoArea}>
              {item.logo ? <Image source={item.logo} style={styles.logo} contentFit="contain" cachePolicy="memory-disk" /> : <Text style={styles.initial}>{item.name.slice(0, 1)}</Text>}
            </View>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.count}>{item.phoneCount !== undefined ? `${item.phoneCount} phones` : 'View phones'}</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xl },
  row: { gap: space.sm },
  heading: { color: colors.ink, fontSize: 26, fontWeight: '900', marginBottom: space.md },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flex: 1, marginBottom: space.sm, minHeight: 180, padding: space.lg },
  logoArea: { alignItems: 'center', backgroundColor: '#f7f9fc', borderRadius: radius.md, height: 72, justifyContent: 'center', width: 72 },
  logo: { height: 54, width: 54 },
  initial: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  name: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: space.md },
  count: { color: colors.muted, fontSize: 12, marginTop: space.xs },
});
