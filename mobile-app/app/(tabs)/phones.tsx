import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { getPhones } from '@/api/phones';
import { PhoneCard } from '@/components/PhoneCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { colors, space } from '@/theme';

export default function PhonesScreen() {
  const { brand, priceMin, priceMax, pta, fiveG } = useLocalSearchParams<{
    brand?: string;
    priceMin?: string;
    priceMax?: string;
    pta?: 'approved' | 'pending';
    fiveG?: 'yes' | 'no';
  }>();
  const min = priceMin ? Number(priceMin) : undefined;
  const max = priceMax ? Number(priceMax) : undefined;
  const query = useInfiniteQuery({
    queryKey: ['phones', 'all', brand || '', min || 0, max || 0, pta || '', fiveG || ''],
    queryFn: ({ pageParam }) => getPhones({ page: pageParam, limit: 20, brand, priceMin: min, priceMax: max, pta, fiveG }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.page * last.limit < last.total ? last.page + 1 : undefined,
  });
  if (query.isLoading) return <LoadingState label="Loading phones…" />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  const phones = query.data?.pages.flatMap((page) => page.items) || [];
  return (
    <FlatList
      data={phones}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <View style={styles.cell}><PhoneCard phone={item} /></View>}
      onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={<Text style={styles.heading}>{brand ? `${brand} phones` : min || max ? 'Phones by price' : pta ? 'PTA phones' : fiveG ? '5G phones' : 'All phones'}</Text>}
      ListEmptyComponent={<EmptyState title="No phones found" message="Published phones will appear here." />}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xl },
  row: { gap: space.sm },
  cell: { flex: 1, marginBottom: space.sm },
  heading: { color: colors.ink, fontSize: 26, fontWeight: '900', marginBottom: space.md },
  loader: { margin: space.lg },
});
