import { BaseProvider, ProviderFetchResult, ProviderTestResult } from './base';

/**
 * Official manufacturer integrations require a vendor-approved adapter.
 * The generic collector intentionally stays disabled rather than pretending to scrape or map arbitrary sites.
 */
export class ManufacturerProvider extends BaseProvider {
  async fetch(_page?: number, _pageToken?: string): Promise<ProviderFetchResult> {
    return {
      phones: [],
      hasNextPage: false,
      providerErrors: [
        'Unsupported provider: install a vendor-approved manufacturer adapter before enabling this source.',
      ],
    };
  }

  async test(): Promise<ProviderTestResult> {
    return {
      success: false,
      message: 'Manufacturer sources are disabled until a vendor-approved adapter is installed.',
    };
  }
}
