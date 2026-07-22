# PhoneDock Loading Screen Fix

## Problem
The global and route-level loading states used the theme `accent` color for skeletons. Because the active accent is yellow, every navigation displayed a large yellow placeholder layout that looked like a broken page.

## Changes
- Replaced the full-page yellow skeleton with a compact branded PhoneDock loader.
- Added a slim route progress indicator below the sticky header.
- Changed the shared Skeleton component to use neutral light/dark shimmer colors.
- Updated phone-card loading placeholders to support both light and dark themes.
- Added reduced-motion accessibility support.
- Preserved all route `loading.tsx` files and their Next.js loading behavior.

## Modified Files
- `src/components/ui/skeleton.tsx`
- `src/components/shared/PageLoading.tsx`
- `src/components/shared/PhoneCard.tsx`
- `src/app/globals.css`
