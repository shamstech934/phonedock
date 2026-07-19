# PhoneDock — Pakistan's #1 Smartphone Database

A production-grade Next.js 16 application for smartphone specs, prices, reviews, and comparison — optimized for the Pakistani market.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Middleware)
- **Language**: TypeScript (strict mode, zero `any` types)
- **Database**: MongoDB (Mongoose 9, Vercel serverless-compatible)
- **Auth**: JWT (jose) + bcrypt + HttpOnly cookies + session versioning
- **UI**: Tailwind CSS 4 + shadcn/ui + Radix UI + Framer Motion
- **Email**: Nodemailer (SMTP)
- **Images**: Cloudinary
- **Bot Protection**: Cloudflare Turnstile
- **Deployment**: Vercel (serverless functions)

## Project Structure

```
src/
├── app/
│   ├── (main)/          # Public pages (phones, brands, compare, etc.)
│   ├── admin/           # Admin panel (CRUD, import, data quality, etc.)
│   ├── api/[[...path]]/ # Catch-all API with modular handlers
│   └── phones/[slug]/   # SSR phone detail with generateMetadata
├── components/
│   ├── admin/           # Admin-specific components
│   ├── ui/              # shadcn/ui primitives
│   └── shared/          # Shared components (PhoneQuickView, formatPrice, etc.)
├── lib/
│   ├── models/          # Mongoose schemas (Phone, Brand, News, etc.)
│   ├── import/          # Import Engine V2 (batch, dry-run, rollback)
│   ├── data-quality/    # Automated quality scanner with rules engine
│   ├── collectors/      # External data collection pipeline
│   └── auth.ts          # JWT signing, verification, rate limiting
└── middleware.ts         # Auth guards, login rate limiting
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Seed database
npm run seed

# Create admin user
npm run admin:create

# Start development
npm run dev
```

### Environment Variables

See `.env.example` for all required and optional variables.

Key variables:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — 32+ char random string for JWT signing
- `NEXT_PUBLIC_BASE_URL` — Public URL (e.g., `https://phonedock.pk`)
- `CRON_SECRET` — Secret for cron endpoint authentication
- `FIRST_ADMIN_SETUP_KEY` — One-time admin setup key

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build |
| `npm run verify` | Lint + typecheck + build |
| `npm run seed` | Seed database with sample data |
| `npm run admin:create` | Create admin user |
| `npm run test` | Run critical integration tests |

## Key Features

- **Phone Database**: 500+ phones with full specs, benchmarks, images
- **Price Tracking**: Real-time price monitoring across Pakistani retailers
- **Import Engine V2**: Batch import with dry-run, rollback, duplicate handling
- **Data Quality**: Automated scanning with 15+ quality rules
- **SEO**: Server-side rendering, dynamic metadata, sitemap, robots.txt
- **Admin Panel**: Full CRUD for phones, brands, news, videos, reviews, users
- **Security**: JWT auth, timing-safe secret comparison, CSP headers, middleware auth guards, rate limiting
- **Collector Pipeline**: External data sources (API, CSV, manual URL, manufacturer)

## Deployment

Deployed on Vercel with serverless functions. MongoDB uses Vercel serverless-compatible connection (`autoIndex: false`).

```bash
# Verify before deploy
npm run verify

# Deploy
vercel --prod
```

## License

Private — All rights reserved.