import { BaseProvider } from './base';
import { JsonUrlProvider } from './json-provider';
import { CsvUrlProvider } from './csv-provider';
import { ApiProvider } from './api-provider';
import { ManualUrlProvider } from './manual-url-provider';
import { ManufacturerProvider } from './manufacturer-provider';
import { ProviderConfig } from '../types';

export function createProvider(config: ProviderConfig, sourceId: string, sourceName: string): BaseProvider {
  switch (config.type) {
    case 'json_url': return new JsonUrlProvider(config, sourceId, sourceName);
    case 'csv_url': return new CsvUrlProvider(config, sourceId, sourceName);
    case 'api': return new ApiProvider(config, sourceId, sourceName);
    case 'manual_url': return new ManualUrlProvider(config, sourceId, sourceName);
    case 'manufacturer': return new ManufacturerProvider(config, sourceId, sourceName);
    case 'file_upload': return new JsonUrlProvider({ ...config, type: 'json_url' }, sourceId, sourceName);
    default: throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export { BaseProvider } from './base';
export type { ProviderFetchResult, ProviderTestResult } from './base';