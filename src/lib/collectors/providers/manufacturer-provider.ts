import { BaseProvider, ProviderFetchResult, ProviderTestResult } from './base';
import { NormalizedPhone } from '../types';

/**
 * Manufacturer provider is a placeholder/stub for official manufacturer APIs.
 * Real integrations would use manufacturer-specific SDKs or approved API endpoints.
 * This provider does NOT scrape manufacturer websites.
 */
export class ManufacturerProvider extends BaseProvider {
  async fetch(_page?: number, _pageToken?: string): Promise<ProviderFetchResult> {
    return {
      phones: [],
      hasNextPage: false,
      providerErrors: ['Manufacturer provider requires a custom adapter. Configure the endpoint and mapping rules for the specific manufacturer API.'],
    };
  }

  async test(): Promise<ProviderTestResult> {
    if (!this.config.endpoint) {
      return { success: false, message: 'No manufacturer API endpoint configured' };
    }
    const start = Date.now();
    try {
      const response = await this.fetchWithTimeout(this.config.endpoint, {}, 10000);
      return {
        success: response.ok,
        message: response.ok ? 'Endpoint reachable' : `HTTP ${response.status}`,
        latencyMs: Date.now() - start,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Connection failed', latencyMs: Date.now() - start };
    }
  }
}