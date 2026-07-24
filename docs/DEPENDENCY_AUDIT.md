# Dependency audit note

The current direct dependencies no longer include `adm-zip` or `xlsx`. `exceljs` and `jszip` are used instead. The lockfile still contains transitive PostCSS entries, while `package.json` pins the top-level override to `postcss@8.5.10`.

A live `npm audit` could not be completed in this execution environment because dependency installation exceeded the time limit. Run `npm audit` in CI after `npm ci`. Do not accept major-version or breaking changes automatically; review any remaining transitive advisory against the actual dependency path.
