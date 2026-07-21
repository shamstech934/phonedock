export type AnalyticsEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
};

type AnalyticsDispatcher = (...args: unknown[]) => void; // eslint-disable-line no-unused-vars

declare global {
  interface Window {
    gtag?: AnalyticsDispatcher;
    clarity?: AnalyticsDispatcher;
  }
}

export function trackEvent(event: AnalyticsEvent) {
  if (typeof window === 'undefined') return;
  const { action, category, label, value, ...extra } = event;
  window.gtag?.('event', action, {
    event_category: category,
    event_label: label,
    value,
    ...extra,
  });
  window.clarity?.('event', action);
}

export function trackAffiliateClick(partner: string, destination: string, phoneSlug?: string) {
  trackEvent({
    action: 'affiliate_click',
    category: 'monetization',
    label: partner,
    partner,
    destination,
    phone_slug: phoneSlug,
  });
}
