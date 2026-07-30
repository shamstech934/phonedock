import type { ReactNode } from 'react';

export type PhoneGridPage =
  | 'home'
  | 'phones'
  | 'brands'
  | 'search'
  | 'rankings'
  | 'related'
  | 'guides';

export function PhoneGrid({
  page,
  children,
  className = '',
  testId,
}: {
  page: PhoneGridPage;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={`phone-grid items-stretch gap-3 ${className}`}
      data-page={page}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
