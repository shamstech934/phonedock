import { ManualUrlProvider } from './manual-url-provider';
import type { ProviderTestResult } from './base';
import { registeredParserIds } from '../parsers/registry';

/**
 * Manufacturer sources use the modular parser registry. A known domain can use
 * a dedicated plugin, while every future brand automatically falls back to the
 * generic JSON-LD/link discovery parser. This keeps brand creation data-driven:
 * adding a Collector Source with a brand filter is enough for ordinary sites.
 */
export class ManufacturerProvider extends ManualUrlProvider {
  async test(): Promise<ProviderTestResult> {
    const result = await super.test();
    if (result.success) return result;
    return {
      ...result,
      message: `${result.message} Registered parsers: ${registeredParserIds().join(', ')}.`,
    };
  }
}
