import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Phone } from '@/api/types';
import { colors, radius, space } from '@/theme';
import { useSavedPhones } from '@/state/SavedPhonesProvider';

const placeholder = 'https://phonedock-pi.vercel.app/phone-placeholder.svg';

export function formatPrice(price?: number) {
  return price && price > 0 ? `PKR ${price.toLocaleString('en-PK')}` : 'Price not available';
}

export function PhoneCard({ phone }: { phone: Phone }) {
  const router = useRouter();
  const { isWishlisted, isCompared, toggleWishlist, toggleCompare } = useSavedPhones();
  const wished = isWishlisted(phone);
  const compared = isCompared(phone);
  return (
      <Pressable
        onPress={() => router.push({ pathname: '/phones/[slug]', params: { slug: phone.slug } })}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityLabel={`View ${phone.brand?.name || ''} ${phone.modelName}`}
      >
        <View style={styles.imageArea}>
          <Image
            source={phone.thumbnail || phone.heroImage || placeholder}
            style={styles.image}
            contentFit="contain"
            transition={180}
            cachePolicy="memory-disk"
            accessibilityLabel={`${phone.modelName} image`}
          />
          {phone.ptaApproved ? <Text style={styles.pta}>PTA</Text> : null}
          {phone.overallRating && phone.overallRating > 0 ? (
            <Text style={styles.rating}>★ {phone.overallRating.toFixed(1)}</Text>
          ) : null}
        </View>
        <Text style={styles.brand} numberOfLines={1}>{phone.brand?.name || 'PhoneDock'}</Text>
        <Text style={styles.title} numberOfLines={2}>{phone.modelName}</Text>
        <Text style={styles.price} numberOfLines={1}>{formatPrice(phone.pricePKR)}</Text>
        <View style={styles.actions}>
          <View style={styles.action}><Text style={styles.actionText}>View →</Text></View>
          <Pressable
            accessibilityLabel={wished ? `Remove ${phone.modelName} from wishlist` : `Add ${phone.modelName} to wishlist`}
            accessibilityRole="button"
            onPress={(event) => { event.stopPropagation(); toggleWishlist(phone); }}
            style={[styles.iconAction, wished && styles.iconActionActive]}
          >
            <Text style={[styles.iconText, wished && styles.iconTextActive]}>{wished ? '♥' : '♡'}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={compared ? `Remove ${phone.modelName} from comparison` : `Add ${phone.modelName} to comparison`}
            accessibilityRole="button"
            onPress={(event) => { event.stopPropagation(); toggleCompare(phone); }}
            style={[styles.iconAction, compared && styles.iconActionActive]}
          >
            <Text style={[styles.iconText, compared && styles.iconTextActive]}>⇄</Text>
          </Pressable>
        </View>
      </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flex: 1, minHeight: 330, padding: space.md },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  imageArea: { backgroundColor: '#f7f9fc', borderRadius: radius.md, height: 170, overflow: 'hidden', position: 'relative' },
  image: { height: '100%', width: '100%' },
  pta: { backgroundColor: '#e8fff7', borderRadius: 999, color: colors.success, fontSize: 11, fontWeight: '700', left: 8, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 8 },
  rating: { backgroundColor: '#fffbea', borderRadius: 999, color: '#8a6200', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', right: 8, top: 8 },
  brand: { color: colors.muted, fontSize: 12, height: 18, marginTop: space.md },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 22, minHeight: 44 },
  price: { color: colors.primary, fontSize: 15, fontWeight: '800', height: 24, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: 6, marginTop: 'auto' },
  action: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, flex: 1, justifyContent: 'center', paddingVertical: 12 },
  actionText: { color: '#fff', fontWeight: '800' },
  iconAction: { alignItems: 'center', backgroundColor: '#f7f9fc', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, height: 43, justifyContent: 'center', width: 43 },
  iconActionActive: { backgroundColor: '#e9f1ff', borderColor: colors.primary },
  iconText: { color: colors.muted, fontSize: 19, fontWeight: '800' },
  iconTextActive: { color: colors.primary },
});
