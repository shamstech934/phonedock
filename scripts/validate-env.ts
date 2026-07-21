import { config } from 'dotenv';
import { validateProductionEnvironment } from '../src/lib/env-validation';

config({ path: '.env.local' });
config();

const result = validateProductionEnvironment(process.env);
for (const warning of result.warnings) console.warn(`[env warning] ${warning}`);
if (!result.valid) {
  for (const error of result.errors) console.error(`[env error] ${error}`);
  process.exit(1);
}
console.log('Production environment validation passed.');
