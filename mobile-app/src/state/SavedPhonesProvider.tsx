import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Phone } from '@/api/types';

const STORAGE_KEY = 'phonedock.mobile.saved.v1';
const MAX_COMPARE = 6;
const MAX_RECENT = 20;

type SavedState = {
  wishlist: Phone[];
  compare: Phone[];
  recent: Phone[];
};

type SavedPhonesContextValue = SavedState & {
  hydrated: boolean;
  isWishlisted: (phone: Phone) => boolean;
  isCompared: (phone: Phone) => boolean;
  toggleWishlist: (phone: Phone) => void;
  toggleCompare: (phone: Phone) => { ok: boolean; message?: string };
  recordViewed: (phone: Phone) => void;
  removeCompare: (id: string) => void;
  clearCompare: () => void;
};

const initialState: SavedState = { wishlist: [], compare: [], recent: [] };
const SavedPhonesContext = createContext<SavedPhonesContextValue | null>(null);

function samePhone(a: Phone, b: Phone) {
  return a.id === b.id || (Boolean(a.slug) && a.slug === b.slug);
}

function dedupe(phones: Phone[], limit: number) {
  return phones.filter((phone, index, list) => list.findIndex(item => samePhone(item, phone)) === index).slice(0, limit);
}

export function SavedPhonesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SavedState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw) as Partial<SavedState>;
        setState({
          wishlist: dedupe(Array.isArray(parsed.wishlist) ? parsed.wishlist : [], 100),
          compare: dedupe(Array.isArray(parsed.compare) ? parsed.compare : [], MAX_COMPARE),
          recent: dedupe(Array.isArray(parsed.recent) ? parsed.recent : [], MAX_RECENT),
        });
      })
      .catch(() => undefined)
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [hydrated, state]);

  const isWishlisted = useCallback((phone: Phone) => state.wishlist.some(item => samePhone(item, phone)), [state.wishlist]);
  const isCompared = useCallback((phone: Phone) => state.compare.some(item => samePhone(item, phone)), [state.compare]);

  const toggleWishlist = useCallback((phone: Phone) => {
    setState(current => ({
      ...current,
      wishlist: current.wishlist.some(item => samePhone(item, phone))
        ? current.wishlist.filter(item => !samePhone(item, phone))
        : [phone, ...current.wishlist],
    }));
  }, []);

  const toggleCompare = useCallback((phone: Phone) => {
    if (state.compare.some(item => samePhone(item, phone))) {
      setState(current => ({ ...current, compare: current.compare.filter(item => !samePhone(item, phone)) }));
      return { ok: true };
    }
    if (state.compare.length >= MAX_COMPARE) return { ok: false, message: 'You can compare up to 6 phones.' };
    setState(current => ({ ...current, compare: [...current.compare, phone] }));
    return { ok: true };
  }, [state.compare]);

  const recordViewed = useCallback((phone: Phone) => {
    setState(current => ({ ...current, recent: dedupe([phone, ...current.recent], MAX_RECENT) }));
  }, []);

  const removeCompare = useCallback((id: string) => {
    setState(current => ({ ...current, compare: current.compare.filter(phone => phone.id !== id) }));
  }, []);
  const clearCompare = useCallback(() => setState(current => ({ ...current, compare: [] })), []);

  const value = useMemo(() => ({
    ...state, hydrated, isWishlisted, isCompared, toggleWishlist, toggleCompare,
    recordViewed, removeCompare, clearCompare,
  }), [state, hydrated, isWishlisted, isCompared, toggleWishlist, toggleCompare, recordViewed, removeCompare, clearCompare]);

  return <SavedPhonesContext.Provider value={value}>{children}</SavedPhonesContext.Provider>;
}

export function useSavedPhones() {
  const value = useContext(SavedPhonesContext);
  if (!value) throw new Error('useSavedPhones must be used within SavedPhonesProvider');
  return value;
}
