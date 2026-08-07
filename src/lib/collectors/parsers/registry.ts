import type { ManufacturerParserPlugin } from './types';
import { SamsungParser } from './samsung-parser';
import { WhatMobileParser } from './whatmobile-parser';
import { GenericManufacturerParser } from './generic-parser';

const plugins: ManufacturerParserPlugin[] = [
  new WhatMobileParser(),
  new SamsungParser(),
  new GenericManufacturerParser(),
];

export function getManufacturerParser(url: string): ManufacturerParserPlugin {
  const parsed = new URL(url);
  return plugins.find(plugin => plugin.id !== 'generic' && plugin.supports(parsed)) || plugins[plugins.length - 1];
}

export function registeredParserIds(): string[] {
  return plugins.map(plugin => plugin.id);
}
