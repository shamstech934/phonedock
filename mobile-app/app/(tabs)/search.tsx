import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPhones } from '@/api/phones';
import { PhoneCard } from '@/components/PhoneCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { colors, radius, space } from '@/theme';

export default function SearchScreen() {
  const [value, setValue] = useState('');
  const query = useDeferredValue(value.trim());
  const results = useQuery({
    queryKey: ['phone-search', query],
    queryFn: () => searchPhones(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Search PhoneDock</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Phone or brand name…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
        accessibilityLabel="Search phones"
      />
      {query.length < 2 ? <EmptyState title="Find any phone" message="Type at least two characters to search." /> : null}
      {results.isFetching ? <LoadingState label="Searching…" /> : null}
      {results.isError ? <ErrorState message={results.error.message} onRetry={() => results.refetch()} /> : null}
      {results.data && !results.isFetching ? (
        <FlatList
          data={results.data}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.results}
          renderItem={({ item }) => <View style={styles.cell}><PhoneCard phone={item} /></View>}
          ListEmptyComponent={<EmptyState title="No matching phones" message="Try a different model or brand." />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.md },
  heading: { color: colors.ink, fontSize: 26, fontWeight: '900', marginBottom: space.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.ink, fontSize: 16, padding: space.md },
  results: { paddingTop: space.md, paddingBottom: 120 },
  row: { gap: space.sm },
  cell: { flex: 1, marginBottom: space.sm },
});
