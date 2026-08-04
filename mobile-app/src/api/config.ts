import { z } from 'zod';
import { apiRequest } from './client';

const booleanMap = z.record(z.string(), z.boolean());
export const mobileConfigSchema = z.object({
  config: z.object({
    enabled: z.boolean().default(true),
    maintenanceMode: z.boolean().default(false),
    maintenanceTitle: z.string().default('PhoneDock is being improved'),
    maintenanceMessage: z.string().default('Please check back shortly.'),
    minimumVersion: z.string().default('0.1.0'),
    latestVersion: z.string().default('0.1.0'),
    forceUpdate: z.boolean().default(false),
    updateUrlAndroid: z.string().default(''),
    updateUrlIos: z.string().default(''),
    supportUrl: z.string().default('/contact'),
    homeSections: z.array(z.string()).default(['hero', 'latest', 'brands', 'features', 'priceGroups']),
    discovery: z.object({
      enabled: z.boolean().default(true),
      title: z.string().default('Find Your Phone'),
      categories: z.array(z.enum(['price', 'ram', 'storage', 'camera', 'battery', 'pta', 'year']))
        .default(['price', 'ram', 'storage', 'camera', 'battery', 'pta', 'year']),
      viewAllText: z.string().default('Explore all phones'),
      viewAllUrl: z.string().default('/phones'),
    }).default({}),
    navigation: booleanMap.default({}),
    features: booleanMap.default({}),
    campaign: z.object({
      enabled: z.boolean().default(false),
      title: z.string().default(''),
      message: z.string().default(''),
      image: z.string().default(''),
      actionLabel: z.string().default(''),
      actionUrl: z.string().default(''),
    }).default({}),
    branding: z.object({
      siteName: z.string().default('PhoneDock'),
      tagline: z.string().default(''),
      logo: z.string().default(''),
      primaryColor: z.string().default('#1769ff'),
    }).default({}),
    serverTime: z.string().optional(),
  }),
});

export type MobileConfig = z.infer<typeof mobileConfigSchema>['config'];
export const getMobileConfig = () => apiRequest('/api/mobile/config', mobileConfigSchema, { timeoutMs: 8_000 }).then(result => result.config);
