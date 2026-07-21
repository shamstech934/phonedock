export type IntegrationCheck = {
  key: string;
  label: string;
  category: 'Core' | 'Monetization' | 'Analytics' | 'SEO' | 'Email' | 'Media' | 'Security';
  configured: boolean;
  required: boolean;
  hint: string;
};

const has = (name: string) => Boolean(process.env[name]?.trim());

export function getIntegrationChecks(): IntegrationCheck[] {
  return [
    { key: 'MONGODB_URI', label: 'MongoDB Atlas', category: 'Core', configured: has('MONGODB_URI'), required: true, hint: 'MongoDB Atlas connection string' },
    { key: 'JWT_SECRET', label: 'Admin session security', category: 'Security', configured: has('JWT_SECRET'), required: true, hint: 'Random secret, minimum 32 characters' },
    { key: 'NEXT_PUBLIC_BASE_URL', label: 'Public website URL', category: 'SEO', configured: has('NEXT_PUBLIC_BASE_URL'), required: true, hint: 'Example: https://phonedock.pk' },
    { key: 'NEXT_PUBLIC_ADSENSE_CLIENT', label: 'Google AdSense', category: 'Monetization', configured: has('NEXT_PUBLIC_ADSENSE_CLIENT'), required: false, hint: 'Publisher ID, for example ca-pub-123...' },
    { key: 'NEXT_PUBLIC_ADSENSE_HOME_TOP_SLOT', label: 'Homepage top ad', category: 'Monetization', configured: has('NEXT_PUBLIC_ADSENSE_HOME_TOP_SLOT'), required: false, hint: 'Responsive AdSense slot ID' },
    { key: 'NEXT_PUBLIC_ADSENSE_HOME_MIDDLE_SLOT', label: 'Homepage middle ad', category: 'Monetization', configured: has('NEXT_PUBLIC_ADSENSE_HOME_MIDDLE_SLOT'), required: false, hint: 'Responsive AdSense slot ID' },
    { key: 'NEXT_PUBLIC_ADSENSE_PHONE_SLOT', label: 'Phone page ad', category: 'Monetization', configured: has('NEXT_PUBLIC_ADSENSE_PHONE_SLOT'), required: false, hint: 'Responsive AdSense slot ID' },
    { key: 'NEXT_PUBLIC_GA_MEASUREMENT_ID', label: 'Google Analytics 4', category: 'Analytics', configured: has('NEXT_PUBLIC_GA_MEASUREMENT_ID'), required: false, hint: 'Measurement ID beginning with G-' },
    { key: 'NEXT_PUBLIC_CLARITY_PROJECT_ID', label: 'Microsoft Clarity', category: 'Analytics', configured: has('NEXT_PUBLIC_CLARITY_PROJECT_ID'), required: false, hint: 'Clarity project ID' },
    { key: 'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', label: 'Google Search Console', category: 'SEO', configured: has('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION'), required: false, hint: 'HTML verification token only' },
    { key: 'NEXT_PUBLIC_BING_SITE_VERIFICATION', label: 'Bing Webmaster Tools', category: 'SEO', configured: has('NEXT_PUBLIC_BING_SITE_VERIFICATION'), required: false, hint: 'msvalidate.01 token' },
    { key: 'EMAIL_HOST', label: 'SMTP email', category: 'Email', configured: has('EMAIL_HOST') && has('EMAIL_USER') && has('EMAIL_PASS'), required: false, hint: 'Host, username and password are required together' },
    { key: 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', label: 'Cloudinary uploads', category: 'Media', configured: has('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') && has('CLOUDINARY_API_KEY') && has('CLOUDINARY_API_SECRET'), required: false, hint: 'Cloud name and API credentials' },
    { key: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', label: 'Cloudflare Turnstile', category: 'Security', configured: has('NEXT_PUBLIC_TURNSTILE_SITE_KEY') && has('TURNSTILE_SECRET_KEY'), required: false, hint: 'Public site key and server secret' },
    { key: 'NEXT_PUBLIC_AFFILIATE_DARAZ_URL', label: 'Daraz affiliate', category: 'Monetization', configured: has('NEXT_PUBLIC_AFFILIATE_DARAZ_URL'), required: false, hint: 'Full approved affiliate URL' },
    { key: 'NEXT_PUBLIC_AFFILIATE_PRICEOYE_URL', label: 'PriceOye affiliate', category: 'Monetization', configured: has('NEXT_PUBLIC_AFFILIATE_PRICEOYE_URL'), required: false, hint: 'Full approved affiliate URL' },
    { key: 'NEXT_PUBLIC_AFFILIATE_MEGA_URL', label: 'Mega.pk affiliate', category: 'Monetization', configured: has('NEXT_PUBLIC_AFFILIATE_MEGA_URL'), required: false, hint: 'Full approved affiliate URL' },
  ];
}
