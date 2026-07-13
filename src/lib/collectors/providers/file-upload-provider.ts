import { BaseProvider, ProviderFetchResult } from './base';
import Papa from 'papaparse';
import { NormalizedPhone } from '../types';

export class FileUploadProvider extends BaseProvider {
  async fetch(_page?: number, _pageToken?: string): Promise<ProviderFetchResult> {
    // File upload is handled via the API endpoint (multipart form data)
    return { phones: [], hasNextPage: false, providerErrors: ['FileUpload provider is invoked via API upload endpoint, not fetched directly'] };
  }
}