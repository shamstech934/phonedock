import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const pkg = JSON.parse(read("package.json")) as { version: string; engines?: { node?: string } };
assert.equal(pkg.version, "1.0.0", "release metadata must use semantic version 1.0.0");
assert.equal(pkg.engines?.node, ">=22.12.0 <23", "production Node range must stay pinned");

for (const document of [
  "ARCHITECTURE.md",
  "DEVELOPER_GUIDE.md",
  "ADMIN_GUIDE.md",
  "DEPLOYMENT.md",
  "BACKUP_AND_RESTORE.md",
  "SECURITY.md",
  "DATA_PLATFORM.md",
  "API_REFERENCE.md",
  "CHANGELOG.md",
  "ROADMAP.md",
]) {
  assert.ok(existsSync(resolve(root, document)), `${document} is required for the release candidate`);
  assert.ok(read(document).trim().length > 250, `${document} must contain actionable guidance`);
}

const env = read(".env.example");
for (const required of ["MONGODB_URI", "JWT_SECRET", "USER_JWT_SECRET", "CRON_SECRET", "APP_RELEASE"]) {
  assert.match(env, new RegExp(`^${required}=`, "m"), `${required} must be documented`);
}

const config = read("next.config.ts");
for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
  assert.match(config, new RegExp(header), `${header} must remain configured`);
}

const growthScripts = read("src/components/monetization/GrowthScripts.tsx");
assert.match(growthScripts, /phonedock_cookie_consent_v1/);
assert.match(growthScripts, /pathname\.startsWith\(["']\/admin["']\)/);

const playwright = read("e2e/accessibility.spec.ts");
assert.match(playwright, /@axe-core\/playwright/);

console.log("Phase 5 enterprise release invariants passed");
