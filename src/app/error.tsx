'use client';

import { PageErrorState } from '@/components/shared/PageErrorState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageErrorState error={error} reset={reset} />;
}
