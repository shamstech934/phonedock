/**
 * Production-Grade Admin Creation Script — PhoneDock
 *
 * SECURITY:
 *  - Password is NEVER logged, stored in plain text, or committed to git
 *  - Interactive terminal prompts OR secure env var (ADMIN_INITIAL_PASSWORD)
 *  - bcrypt hashing with cost factor 12
 *  - Email validation + duplicate detection
 *  - Strong password validation (12+ chars, mixed case, number, special)
 *  - If admin exists with same email → safely updates to superadmin + resets password
 *
 * Usage:
 *   Interactive:  npm run admin:create
 *   Non-interactive (CI/sandbox):
 *     ADMIN_INITIAL_PASSWORD='YourSecureP@ssw0rd!' npm run admin:create -- --name "Shams" --email "user@example.com" --role superadmin
 *   Force additional admin:
 *     npm run admin:create -- --force
 *   Reset password for existing email:
 *     ADMIN_INITIAL_PASSWORD='NewP@ssw0rd!' npm run admin:create -- --name "Shams" --email "user@example.com" --reset-password
 */

import * as readline from 'readline';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
if (!MONGODB_URI) {
  console.error('\n✗ ERROR: MONGODB_URI environment variable is not set.');
  console.error('  Create a .env.local file in the project root with MONGODB_URI.\n');
  process.exit(1);
}

// ============ ADMIN SCHEMA (mirrors production) ============

const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  name: { type: String, default: '', trim: true },
  role: { type: String, enum: ['superadmin', 'admin', 'editor', 'reviewer'], default: 'admin' },
  active: { type: Boolean, default: true },
  lastLogin: { type: Date },
  lastLoginIp: { type: String, default: '' },
  lastLoginUA: { type: String, default: '' },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  passwordChangedAt: { type: Date, default: Date.now },
  revokedSessions: [{ jti: String, revokedAt: Date }],
  resetToken: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
}, { timestamps: true });

AdminSchema.index({ email: 1 }, { unique: true });
AdminSchema.index({ role: 1 });

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

// ============ VALIDATION ============

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  if (password.length < 12) errors.push('at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('one special character (!@#$%^&* etc.)');
  return { valid: errors.length === 0, errors };
}

// ============ CLI ARG PARSER ============

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf('--' + flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes('--' + flag);
}

// ============ INTERACTIVE PROMPTS ============

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    if (hidden) {
      const stdin = process.stdin;
      const stdout = process.stdout;
      let buf = '';
      stdout.write(prompt);

      const onChar = (ch: string) => {
        switch (ch) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.setRawMode?.(false);
            stdin.removeListener('data', onChar);
            stdout.write('\n');
            resolve(buf);
            break;
          case '\u0003':
            process.exit(1);
            break;
          case '\u007F':
            buf = buf.slice(0, -1);
            stdout.clearLine(0);
            stdout.cursorTo(0);
            stdout.write(prompt + '*'.repeat(buf.length));
            break;
          default:
            buf += ch;
            stdout.clearLine(0);
            stdout.cursorTo(0);
            stdout.write(prompt + '*'.repeat(buf.length));
            break;
        }
      };

      if (stdin.isTTY) {
        stdin.setRawMode!(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        stdin.on('data', onChar);
      } else {
        stdin.removeListener('data', onChar);
        rl.question(prompt, (answer) => resolve(answer));
      }
    } else {
      rl.question(prompt, (answer) => resolve(answer.trim()));
    }
  });
}

// ============ MAIN ============

async function main() {
  const forceMode = hasFlag('force');
  const resetPasswordMode = hasFlag('reset-password');
  const nonInteractive = hasFlag('name') || hasFlag('email') || !!process.env.ADMIN_INITIAL_PASSWORD;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   PhoneDock — Admin Account Setup   ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Connect to MongoDB
  console.log('Connecting to database...');
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 15000,
    });
  } catch (e: any) {
    console.error('\n✗ Failed to connect to MongoDB:', e.message);
    console.error('  Check your MONGODB_URI in .env.local\n');
    process.exit(1);
  }
  console.log('Connected.\n');

  // Check existing admins
  const existingCount = await Admin.countDocuments();

  // ---- COLLECT INPUTS ----

  let name: string;
  let email: string;
  let role: string;
  let password: string;

  if (nonInteractive) {
    // ---- NON-INTERACTIVE MODE (env vars + CLI flags) ----
    name = getArg('name') || '';
    email = (getArg('email') || '').toLowerCase();
    password = process.env.ADMIN_INITIAL_PASSWORD || '';

    if (!name || name.length < 2) {
      console.error('\n✗ Non-interactive mode requires: --name "Full Name"\n');
      await mongoose.disconnect();
      process.exit(1);
    }
    if (!email || !isValidEmail(email)) {
      console.error('\n✗ Non-interactive mode requires: --email "valid@email.com"\n');
      await mongoose.disconnect();
      process.exit(1);
    }
    if (!password) {
      console.error('\n✗ Non-interactive mode requires: ADMIN_INITIAL_PASSWORD env var\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Validate password strength
    const validation = validatePassword(password);
    if (!validation.valid) {
      console.error(`\n✗ Password must have: ${validation.errors.join(', ')}\n`);
      await mongoose.disconnect();
      process.exit(1);
    }

    role = getArg('role') || (existingCount === 0 ? 'superadmin' : 'admin');
    const validRoles = ['superadmin', 'admin', 'editor', 'reviewer'];
    if (!validRoles.includes(role)) {
      console.error(`\n✗ Invalid role "${role}". Use: superadmin, admin, editor, reviewer\n`);
      await mongoose.disconnect();
      process.exit(1);
    }

  } else {
    // ---- INTERACTIVE MODE ----
    if (existingCount > 0 && !forceMode) {
      const existing = await Admin.find().select('-password').lean();
      console.error('✗ Admin account(s) already exist:');
      (existing as any[]).forEach((a) => {
        console.error(`  • ${a.email} (${a.role})`);
      });
      console.error('\n  Use --force to create an additional admin.');
      console.error('  Or use --reset-password --email "user@example.com" to reset password.');
      console.error('  Otherwise, use the admin panel to manage users.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    name = await question('Full Name: ');
    if (!name || name.length < 2) {
      console.error('\n✗ Name must be at least 2 characters.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    email = await question('Email Address: ');
    if (!email || !isValidEmail(email)) {
      console.error('\n✗ Invalid email address.\n');
      await mongoose.disconnect();
      process.exit(1);
    }
    email = email.toLowerCase();

    // Password with validation
    while (true) {
      password = await question('Password (min 12 chars, mixed case + number + special): ', true);
      const validation = validatePassword(password);
      if (!validation.valid) {
        console.error(`  ✗ Password must have: ${validation.errors.join(', ')}\n`);
        continue;
      }
      break;
    }

    const confirm = await question('Confirm Password: ', true);
    if (password !== confirm) {
      console.error('\n✗ Passwords do not match.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Determine role
    role = existingCount === 0 ? 'superadmin' : 'admin';
    if (existingCount === 0) {
      console.log(`\n  First admin — assigning role: superadmin\n`);
    } else {
      const roleInput = await question(`Role [admin/editor/reviewer] (default: admin): `);
      const validRoles = ['superadmin', 'admin', 'editor', 'reviewer'];
      if (roleInput && validRoles.includes(roleInput.toLowerCase())) {
        role = roleInput.toLowerCase();
      }
    }
  }

  // ---- CHECK DUPLICATE / EXISTING ----

  const existing = await Admin.findOne({ email });
  if (existing) {
    if (resetPasswordMode || nonInteractive) {
      // Safely UPDATE existing account to superadmin + reset password
      console.log(`\n  Admin "${email}" already exists. Updating...`);
      const hashedPassword = await bcrypt.hash(password, 12);

      // Clear password from memory immediately
      password = '';
      (globalThis as any).password = undefined;
      if (process.env.ADMIN_INITIAL_PASSWORD) {
        delete process.env.ADMIN_INITIAL_PASSWORD;
      }

      await Admin.updateOne(
        { email },
        {
          $set: {
            name,
            role: 'superadmin',
            active: true,
            password: hashedPassword,
            failedAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            revokedSessions: [],
          }
        }
      );

      console.log('\n╔══════════════════════════════════════╗');
      console.log('║     Admin Account Updated           ║');
      console.log('╠══════════════════════════════════════╣');
      console.log(`║  Name:  ${name.padEnd(30)}║`);
      console.log(`║  Email: ${email.padEnd(30)}║`);
      console.log(`║  Role:  ${'superadmin'.padEnd(30)}║`);
      console.log('╠══════════════════════════════════════╣');
      console.log('║  Password: RESET (all sessions cleared)  ║');
      console.log('║  Login at: /admin/login             ║');
      console.log('╚══════════════════════════════════════╝\n');

      await mongoose.disconnect();
      process.exit(0);
    } else {
      console.error(`\n✗ An admin with "${email}" already exists.`);
      console.error('  Use --reset-password --email "..." to update password & role.\n');
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  // ---- CREATE NEW ADMIN ----

  // Hash password — NEVER log the plain password
  console.log('  Creating admin account...');
  const hashedPassword = await bcrypt.hash(password, 12);

  // Clear password from memory
  password = '';
  (globalThis as any).password = undefined;
  if (process.env.ADMIN_INITIAL_PASSWORD) {
    delete process.env.ADMIN_INITIAL_PASSWORD;
  }

  const admin = await Admin.create({
    email,
    name,
    password: hashedPassword,
    role,
    active: true,
    failedAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: new Date(),
  });

  // Log success (no password or sensitive data)
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     Admin Account Created           ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Name:  ${admin.name.padEnd(30)}║`);
  console.log(`║  Email: ${admin.email.padEnd(30)}║`);
  console.log(`║  Role:  ${admin.role.padEnd(30)}║`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  Login at: /admin/login             ║');
  console.log('╚══════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('Unexpected error:', e.message || e);
  process.exit(1);
});