'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Phone } from '@/components/shared/types';
import {
  addRecentlyViewed,
  clearRecentlyViewed,
  clearWishlist,
  getRecentlyViewed,
  getWishlist,
  isWishlisted,
  subscribePersonalization,
  toggleWishlist,
} from './storage';

export function useWishlist() {
  const [items, setItems] = useState<Phone[]>([]);
  const refresh = useCallback(() => setItems(getWishlist() as Phone[]), []);
  useEffect(() => { refresh(); return subscribePersonalization(refresh); }, [refresh]);
  return {
    items,
    has: (slug: string) => isWishlisted(slug),
    toggle: (phone: Phone) => { const active = toggleWishlist(phone); refresh(); return active; },
    clear: () => { clearWishlist(); refresh(); },
  };
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<Phone[]>([]);
  const refresh = useCallback(() => setItems(getRecentlyViewed() as Phone[]), []);
  useEffect(() => { refresh(); return subscribePersonalization(refresh); }, [refresh]);
  return {
    items,
    add: (phone: Phone) => { addRecentlyViewed(phone); refresh(); },
    clear: () => { clearRecentlyViewed(); refresh(); },
  };
}
