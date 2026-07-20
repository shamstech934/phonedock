# PhoneDock Admin CMS Pack

## Added
- Admin-controlled hero banner: enable/disable, badge, title, highlighted word, subtitle, search placeholder and CTA fields.
- Homepage section manager with enable/disable switches and custom titles.
- Announcement bar manager with message, button, URL and background color.
- Branding controls for site name, tagline, logo, favicon and theme colors.
- SEO, social media, contact, footer and maintenance settings consolidated into one CMS screen.
- Settings stored in MongoDB using the existing singleton Settings model.
- Homepage now reads CMS settings server-side.
- Hero text, hero visibility, announcement bar, search placeholder and homepage section visibility update from Admin Settings.

## Verification
- npm ci: passed
- TypeScript: passed
- Changed-file ESLint: 0 errors (2 non-blocking interface warnings)
- No new npm dependency
- No new environment variable
- Existing settings documents remain compatible because defaults are applied for new fields.
