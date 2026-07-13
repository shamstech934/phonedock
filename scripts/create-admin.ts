import { connectDB } from '../src/lib/mongodb';
import { Admin } from '../src/lib/models';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
  console.log('\n=== PhoneDock Admin Bootstrap ===\n');

  const email = (await question('Admin email: ')).trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Invalid email address.');
    process.exit(1);
  }

  const name = (await question('Admin name: ')).trim();
  if (!name) {
    console.error('Name is required.');
    process.exit(1);
  }

  const password = await question('Password (min 12 chars): ') as string;
  if (!password || password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  const confirm = await question('Confirm password: ') as string;
  if (password !== confirm) {
    console.error('Passwords do not match.');
    process.exit(1);
  }

  await connectDB();

  const existing = await Admin.findOne({ email });
  if (existing) {
    const overwrite = await question('An admin with this email already exists. Overwrite? (yes/no): ');
    if (overwrite.toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const hashed = await bcrypt.hash(password, 12);

  await Admin.findOneAndUpdate(
    { email },
    {
      email,
      name,
      password: hashed,
      role: 'superadmin',
      active: true,
      passwordChangedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    },
    { upsert: true, new: true }
  );

  console.log(`\nSuperadmin "${name}" (${email}) created successfully.`);
  console.log('You can now log in at /admin/login\n');
  rl.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });