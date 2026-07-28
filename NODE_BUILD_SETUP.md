# PhoneDock Node and Build Setup

PhoneDock supports Node.js 22 LTS and Node.js 24 LTS. Node 22 remains the
recommended production/Vercel version and is selected by the version files.

## Clean Windows setup

1. Install Node.js 22 LTS.
2. Open a new terminal in the repository root.
3. Run `npm.cmd ci` when PowerShell blocks `npm.ps1`; otherwise `npm ci` is fine.
4. Run `npm.cmd run doctor:runtime`.
5. Run `npm.cmd run verify`.

Do not copy `node_modules` from another ZIP or computer. It is generated from
`package-lock.json` and is intentionally excluded from release ZIP files.

## Vercel

Set the project Node.js version to 22.x. The repository also declares the same
constraint in `package.json`, `.nvmrc`, and `.node-version`.

## Repairing an incomplete install

If packages such as `exceljs`, `jszip`, `sanitize-html`, or `tsx` are missing,
close running development servers and run a fresh `npm ci`. Do not add the
packages again: they are already declared in both `package.json` and
`package-lock.json`.
