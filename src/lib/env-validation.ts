import { validateMongoUri } from '@/lib/mongodb-env';

export interface EnvironmentValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const PLACEHOLDER = /(replace|change|placeholder|example|your[_-]|xxxx|secret123)/i;

function configured(env: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function validateSecret(env: NodeJS.ProcessEnv, key: string, errors: string[]) {
  const value = env[key]?.trim() || '';
  if (value.length < 32) errors.push(`${key} must be at least 32 characters.`);
  else if (PLACEHOLDER.test(value)) errors.push(`${key} contains a placeholder value.`);
}

function validateOptionalGroup(env: NodeJS.ProcessEnv, keys: string[], errors: string[]) {
  const count = keys.filter((key) => configured(env, key)).length;
  if (count > 0 && count < keys.length) errors.push(`${keys.join(', ')} must be configured together or all left blank.`);
}

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env): EnvironmentValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const mongo = validateMongoUri(env.MONGODB_URI);
  if (!mongo.valid) errors.push(mongo.error || 'MONGODB_URI is invalid.');
  validateSecret(env, 'JWT_SECRET', errors);
  validateSecret(env, 'CRON_SECRET', errors);
  if (configured(env, 'USER_JWT_SECRET')) validateSecret(env, 'USER_JWT_SECRET', errors);

  try {
    const baseUrl = new URL(env.NEXT_PUBLIC_BASE_URL || '');
    if (baseUrl.protocol !== 'https:') errors.push('NEXT_PUBLIC_BASE_URL must use HTTPS in production.');
  } catch {
    errors.push('NEXT_PUBLIC_BASE_URL must be a valid absolute URL.');
  }

  validateOptionalGroup(env, ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'], errors);
  validateOptionalGroup(env, ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'], errors);
  validateOptionalGroup(env, ['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'], errors);

  if (env.REQUIRE_USER_EMAIL_VERIFICATION === 'true' && !configured(env, 'EMAIL_HOST')) {
    errors.push('Email must be fully configured when REQUIRE_USER_EMAIL_VERIFICATION=true.');
  }
  if (configured(env, 'FIRST_ADMIN_SETUP_KEY')) {
    warnings.push('FIRST_ADMIN_SETUP_KEY is set. Remove it and redeploy immediately after the first superadmin is created.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
