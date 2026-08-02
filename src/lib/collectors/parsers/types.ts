import type { NormalizedPhone } from '../types';

export interface DiscoveredProductLink {
  url: string;
  label?: string;
  brandHint?: string;
  modelHint?: string;
  image?: string;
}

export interface ParserContext {
  sourceUrl: string;
  configuredBrands: string[];
  sourceName: string;
}

export interface ManufacturerParserPlugin {
  id: string;
  domains: RegExp[];
  supports(url: URL): boolean;
  discover(html: string, context: ParserContext): DiscoveredProductLink[];
  parseProduct(html: string, productUrl: string, context: ParserContext): NormalizedPhone | null;
}
