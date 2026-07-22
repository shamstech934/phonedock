'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Phone } from '@/components/shared/types';
import { useUser } from '@/lib/useUser';
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
  const { user } = useUser();
  const [items, setItems] = useState<Phone[]>([]);
  const refresh = useCallback(() => setItems(getWishlist() as Phone[]), []);
  useEffect(() => { refresh(); return subscribePersonalization(refresh); }, [refresh]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetch('/api/account/features?resource=wishlist', { cache: 'no-store' }).then(res => res.ok ? res.json() : null).then(data => {
      if (!active || !data?.items) return;
      setItems(data.items.map((item: { phoneId: Record<string, unknown> }) => ({ ...item.phoneId, id: String(item.phoneId._id || '') })) as Phone[]);
    }).catch(() => null);
    return () => { active = false; };
  }, [user]);
  return {
    items,
    has: (slug: string) => isWishlisted(slug),
    toggle: (phone: Phone) => { const enabled = toggleWishlist(phone); refresh(); if (user && phone.id) void fetch(`/api/account/features?resource=wishlist&id=${encodeURIComponent(phone.id)}`, enabled ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'wishlist', phoneId: phone.id }) } : { method: 'DELETE' }).catch(() => null); return enabled; },
    clear: () => { clearWishlist(); refresh(); },
  };
}

export function useRecentlyViewed() {
  const { user } = useUser();
  const [items, setItems] = useState<Phone[]>([]);
  const refresh = useCallback(() => setItems(getRecentlyViewed() as Phone[]), []);
  useEffect(() => { refresh(); return subscribePersonalization(refresh); }, [refresh]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetch('/api/account/features?resource=recent', { cache: 'no-store' }).then(res => res.ok ? res.json() : null).then(data => {
      if (!active || !data?.items) return;
      setItems(data.items.map((item: { phoneId: Record<string, unknown> }) => ({ ...item.phoneId, id: String(item.phoneId._id || '') })) as Phone[]);
    }).catch(() => null);
    return () => { active = false; };
  }, [user]);
  return {
    items,
    add: (phone: Phone) => { addRecentlyViewed(phone); refresh(); if (user && phone.id) void fetch('/api/account/features', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource: 'recent', phoneId: phone.id }) }).catch(() => null); },
    clear: () => { clearRecentlyViewed(); refresh(); },
  };
}
