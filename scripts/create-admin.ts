/**
 * Production-Grade Admin Creation Script — PhoneDock
 *
 * SECURITY:
 *  - Password is NEVER logged, stored in plain text, or committed to git
 *  - Interactive terminal prompts only — no browser/URL access
 *  - bcrypt hashing with cost factor 12
 *  - Email validation + duplicate detection
 *  - Strong password validation (12+ chars, mixed case, number, special)
 *  - Refuses to run if ANY admin already exists (unless --force flag)
 *
 * Usage: npm run admin:create
 *        npm run admin:create -- --force
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

// ============ INTERACTIVE PROMPTS ============

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    if (hidden) {
      // Mask password input with asterisks
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
          case '\u0003': // Ctrl+C
            process.exit(1);
            break;
          case '\u007F': // Backspace
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
        // Non-TTY fallback (CI/CD) — just ask normally
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
  const forceMode = process.argv.includes('--force');

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

  // Check if any admin already exists
  const existingCount = await Admin.countDocuments();
  if (existingCount > 0 && !forceMode) {
    const existing = await Admin.find().select('-password').lean();
    console.error('✗ Admin account(s) already exist:');
    existing.forEach((a: any) => {
      console.error(`  • ${a.email} (${a.role})`);
    });
    console.error('\n  Use --force to create an additional admin.');
    console.error('  Otherwise, use the admin panel to manage users.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Collect inputs
  const name = await question('Full Name: ');
  if (!name || name.length < 2) {
    console.error('\n✗ Name must be at least 2 characters.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  const email = await question('Email Address: ');
  if (!email || !isValidEmail(email)) {
    console.error('\n✗ Invalid email address.\n');
    await mongoose.disconnect();
    process.exit(1);
  }
  const emailLower = email.toLowerCase();

  // Check duplicate
  const duplicate = await Admin.findOne({ email: emailLower });
  if (duplicate) {
    console.error(`\n✗ An admin with "${emailLower}" already exists.\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Password with validation
  let password: string;
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
  let role = existingCount === 0 ? 'superadmin' : 'admin';
  if (existingCount === 0) {
    console.log(`\n  First admin — assigning role: superadmin\n`);
  } else {
    const roleInput = await question(`Role [admin/editor/reviewer] (default: admin): `);
    const validRoles = ['superadmin', 'admin', 'editor', 'reviewer'];
    if (roleInput && validRoles.includes(roleInput.toLowerCase())) {
      role = roleInput.toLowerCase();
    }
  }

  // Hash password — NEVER log the plain password
  console.log('  Creating admin account...');
  const hashedPassword = await bcrypt.hash(password, 12);

  // Clear password from memory
  password = '';
  (globalThis as any).password = undefined;

  // Create admin
  const admin = await Admin.create({
    email: emailLower,
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