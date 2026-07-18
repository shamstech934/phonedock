import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) {
      crypto.timingSafeEqual(aBuf, aBuf);
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
import { RateLimit, UserReview, Phone, PriceAlert, PriceHistory, NewsletterSubscriber } from '@/lib/models';
import { connectDB, checkIpRateLimit, getClientIp, isEmailConfigured } from './handlers/helpers';
import { getEmailTransporter } from '@/lib/email';
import { handlePublicGet, handlePublicPost } from './handlers/public';
import { verifyTurnstile } from '@/lib/turnstile';
import { handleAdminAuthGet, handleAdminAuthPost, handleAdminAuthDelete } from './handlers/admin-auth';
import { handleFirstSetupGet, handleFirstSetupPost } from './handlers/first-setup';
import { handleAdminCrudGet, handleAdminCrudPost, handleAdminCrudPut, handleAdminCrudDelete } from './handlers/admin-crud';
import { handleCollectorGet, handleCollectorPost, handleCollectorPut, handleCollectorDelete } from './handlers/collector';
import { handleImportGet, handleImportPost } from './handlers/import';
import { handleDownloadSample } from './handlers/download';
import { handlePriceTrackerGet, handlePriceTrackerPost, handlePriceTrackerPut, handlePriceTrackerDelete } from './handlers/price-tracker';
import { handleCronUpdatePrices } from './handlers/cron-update-prices';
import { syncYouTubeVideos } from '@/lib/video-sync';
import { Video } from '@/lib/models';

// ============ GET HANDLER ============
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
    // Cron: /api/cron/update-prices — protected by CRON_SECRET, NO rate limiting
    if (segments.length === 2 && segments[0] === 'cron' && segments[1] === 'update-prices') {
      const cronResult = await handleCronUpdatePrices(req);
      if (cronResult) return cronResult;
    }

    // Cron: /api/cron/sync-youtube — protected by CRON_SECRET, NO rate limiting
    if (segments.length === 2 && segments[0] === 'cron' && segments[1] === 'sync-youtube') {
      const secret = req.headers.get('authorization')?.replace('Bearer ', '');
      if (!timingSafeEqual(secret || '', process.env.CRON_SECRET || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const result = await syncYouTubeVideos();
      return NextResponse.json(result);
    }

    // Cron: /api/cron/check-price-drops — protected by CRON_SECRET
    if (segments.length === 2 && segments[0] === 'cron' && segments[1] === 'check-price-drops') {
      const secret = req.headers.get('authorization')?.replace('Bearer ', '');
      if (!timingSafeEqual(secret || '', process.env.CRON_SECRET || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      await connectDB();
      const alerts = await PriceAlert.find({ status: 'confirmed', notified: false }).populate('phoneId').lean();
      let sent = 0;
      // Batch-fetch latest prices for all alerted phones
      const phoneIds = alerts.map(a => {
        const p = a.phoneId as any;
        return p._id;
      }).filter(Boolean);

      const latestPricesArr = await PriceHistory.aggregate([
        { $match: { phoneId: { $in: phoneIds }, storeName: null } },
        { $sort: { recordedAt: -1 } },
        { $group: { _id: '$phoneId', price: { $first: '$price' } } },
      ]);
      const priceMap = new Map(latestPricesArr.map((p: any) => [p._id.toString(), p.price]));

      for (const alert of alerts) {
        const phone = alert.phoneId as any;
        if (!phone || !phone.pricePKR) continue;
        const lastPriceVal = priceMap.get(phone._id.toString());
        if (lastPriceVal && lastPriceVal > phone.pricePKR) {
          // Price has dropped! Send notification email (using nodemailer)
          try {
            const transporter = await getEmailTransporter();
            const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';
            const unsubscribeUrl = `${siteUrl}/api/price-alerts/unsubscribe?email=${encodeURIComponent(alert.email)}&phoneId=${phone._id}`;
            await transporter.sendMail({
              from: `"PhoneDock" <${process.env.EMAIL_USER}>`,
              to: alert.email,
              subject: `Price Drop: ${phone.modelName} is now PKR ${phone.pricePKR.toLocaleString()}`,
              html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:20px">
                <h2 style="color:#1a1a1a">Price Drop Alert</h2>
                <p style="color:#666">Great news! The price of <strong>${phone.modelName}</strong> has dropped.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0"><tr>
                  <td style="padding:12px;background:#fef2f2;text-decoration:line-through;color:#999;font-size:14px">PKR ${lastPriceVal.toLocaleString()}</td>
                  <td style="padding:0 8px;color:#ccc">→</td>
                  <td style="padding:12px;background:#f0fdf4;color:#16a34a;font-size:18px;font-weight:bold">PKR ${phone.pricePKR.toLocaleString()}</td>
                </tr></table>
                <p style="color:#999;font-size:12px">You're receiving this because you subscribed to price drop alerts on PhoneDock.</p>
                <p style="font-size:12px"><a href="${unsubscribeUrl}" style="color:#666">Unsubscribe</a></p>
              </div>`,
            });
            await PriceAlert.findByIdAndUpdate(alert._id, { $set: { notified: true } });
            sent++;
          } catch (e) { console.error('[PriceAlert email]', e); }
        }
      }
      return NextResponse.json({ checked: alerts.length, sent });
    }

    // Price alert confirmation: /api/price-alerts/confirm?token=xxx&email=xxx
    if (segments.length === 2 && segments[0] === 'price-alerts' && segments[1] === 'confirm') {
      await connectDB();
      const { searchParams } = new URL(req.url);
      const token = searchParams.get('token') || '';
      const email = (searchParams.get('email') || '').toLowerCase();
      if (!token || !email) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/?alert=invalid`);
      }
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const alert = await PriceAlert.findOne({
        email,
        confirmTokenHash: tokenHash,
        confirmTokenExpires: { $gt: new Date() },
        status: 'pending',
      });
      if (!alert) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/?alert=invalid`);
      }
      await PriceAlert.updateOne({ _id: alert._id }, {
        $set: { status: 'confirmed', confirmedAt: new Date(), confirmTokenHash: null, confirmTokenExpires: null },
      });
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/?alert=confirmed`);
    }

    // Price alert unsubscribe: /api/price-alerts/unsubscribe?email=xxx&phoneId=xxx
    if (segments.length === 2 && segments[0] === 'price-alerts' && segments[1] === 'unsubscribe') {
      await connectDB();
      const { searchParams } = new URL(req.url);
      const email = (searchParams.get('email') || '').toLowerCase();
      const phoneId = searchParams.get('phoneId') || '';
      if (!email || !phoneId) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/?alert=invalid`);
      }
      await PriceAlert.updateMany(
        { email, phoneId, status: { $ne: 'unsubscribed' } },
        { $set: { status: 'unsubscribed', unsubscribedAt: new Date() } },
      );
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/?alert=unsubscribed`);
    }

    // Download sample data (no auth needed)
    const downloadResult = await handleDownloadSample(req, segments);
    if (downloadResult) return downloadResult;

    // First-setup status check (before public routes — must be available without auth)
    const setupGetResult = await handleFirstSetupGet(req, segments);
    if (setupGetResult) return setupGetResult;

    // Public routes
    const publicResult = await handlePublicGet(req, segments);
    if (publicResult) return publicResult;

    // Admin auth routes (session check)
    const authResult = await handleAdminAuthGet(req, segments);
    if (authResult) return authResult;

    // Admin CRUD routes (stats, phones, brands, news, users, activity)
    const crudResult = await handleAdminCrudGet(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (dashboard, sources, jobs)
    const collectorResult = await handleCollectorGet(req, segments);
    if (collectorResult) return collectorResult;

    // Import routes (history)
    const importResult = await handleImportGet(req, segments);
    if (importResult) return importResult;

    // Price Tracker GET routes (stats, phones, sources, changes, pending, history, listings)
    const priceTrackerGetResult = await handlePriceTrackerGet(req, segments);
    if (priceTrackerGetResult) return priceTrackerGetResult;

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API GET error:', e.message);
    const msg = e?.message || '';
    if (msg.includes('MONGODB_URI') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('Authentication failed') || msg.includes('IP is not allowed')) {
      return NextResponse.json({ error: 'Database connection failed. Please set MONGODB_URI in environment variables.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============ POST HANDLER ============
export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  // MongoDB-backed IP rate limiting
  const ip = getClientIp(req);
  const isLogin = segments.length === 2 && segments[0] === 'admin' && segments[1] === 'login';
  const isForgotPassword = segments.length === 3 && segments[0] === 'admin' && segments[1] === 'forgot-password';
  const isResetPassword = segments.length === 3 && segments[0] === 'admin' && segments[1] === 'reset-password';
  const isContact = segments.length === 1 && segments[0] === 'contact';
  const isCollector = segments.length >= 2 && segments[0] === 'collector';
  const isImport = segments.length >= 1 && segments[0] === 'import';

  try {
    await connectDB();

    if (isLogin) {
      if (!await checkIpRateLimit(`login:${ip}`, 10, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
      }
    } else if (isForgotPassword || isResetPassword) {
      if (!await checkIpRateLimit(`pwreset:${ip}`, 5, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many password reset attempts.' }, { status: 429 });
      }
    } else if (isContact) {
      if (!await checkIpRateLimit(`contact:${ip}`, 3, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many contact submissions.' }, { status: 429 });
      }
    } else if (isCollector || isImport) {
      if (!await checkIpRateLimit(`api:${ip}`, 400, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
      }
    } else {
      if (!await checkIpRateLimit(`api:${ip}`, 400, 60_000, RateLimit)) {
        return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
      }
    }
  } catch {
    // If rate limit DB check fails, fail closed
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  try {
    // Public contact form: /api/contact
    if (segments.length === 1 && segments[0] === 'contact') {
      const contactResult = await handlePublicPost(req, segments, ip);
      if (contactResult) return contactResult;
    }

    // Public review submission: /api/phones/:slug/reviews
    if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'reviews') {
      if (!await checkIpRateLimit(`review:${ip}`, 3, 3600_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many reviews. Try again later.' }, { status: 429 });
      }
      await connectDB();
      const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
      if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
      const body = await req.json();
      const { name, email, rating, comment, turnstileToken } = body;
      if (!name || !email || !rating || !comment) return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
      // Turnstile verification (skip if not configured — graceful degradation)
      if (process.env.TURNSTILE_SECRET_KEY) {
        if (!turnstileToken) return NextResponse.json({ error: 'Bot verification required' }, { status: 403 });
        const tsValid = await verifyTurnstile(turnstileToken, ip);
        if (!tsValid) return NextResponse.json({ error: 'Bot verification failed' }, { status: 403 });
      }
      if (rating < 1 || rating > 5) return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
      if (comment.length < 10 || comment.length > 1000) return NextResponse.json({ error: 'Comment must be 10-1000 characters' }, { status: 400 });
      if (name.length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 });
      // Spam detection
      const spamFlags: string[] = [];
      if (/https?:\/\//i.test(comment)) spamFlags.push('contains_url');
      if (/(buy now|click here|free money|lottery|winner|crypto|investment)/i.test(comment)) spamFlags.push('suspected_spam');
      if (/^[A-Z\s.!?]+$/.test(comment)) spamFlags.push('all_caps');
      if (spamFlags.length > 0) {
        await UserReview.create({ phoneId: phone._id, name: name.trim().slice(0, 100), email: email.trim().toLowerCase().slice(0, 200), rating, comment: comment.trim().slice(0, 1000), status: 'flagged', spamFlags });
        return NextResponse.json({ success: true, message: 'Review submitted for moderation' });
      }
      await UserReview.create({ phoneId: phone._id, name: name.trim().slice(0, 100), email: email.trim().toLowerCase().slice(0, 200), rating, comment: comment.trim().slice(0, 1000), status: 'pending', spamFlags: [] });
      return NextResponse.json({ success: true, message: 'Review submitted for moderation' });
    }

    // Newsletter subscription: /api/newsletter
    if (segments.length === 1 && segments[0] === 'newsletter') {
      if (!await checkIpRateLimit(`newsletter:${ip}`, 3, 3600_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
      }
      await connectDB();
      const body = await req.json();
      const email = (body.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
      }
      try {
        await NewsletterSubscriber.create({ email });
        return NextResponse.json({ success: true, message: 'Subscribed successfully!' });
      } catch (e: any) {
        if (e.code === 11000) {
          return NextResponse.json({ success: true, message: 'You are already subscribed!' });
        }
        throw e;
      }
    }

    // Public price alert subscription: /api/phones/:slug/price-alerts (double opt-in)
    if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'price-alerts') {
      if (!await checkIpRateLimit(`alert:${ip}`, 5, 3600_000, RateLimit)) {
        return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
      }
      await connectDB();
      const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
      if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
      const body = await req.json();
      const { email } = body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
      const emailLower = email.toLowerCase().trim();

      const confirmToken = crypto.randomUUID();
      const tokenHash = crypto.createHash('sha256').update(confirmToken).digest('hex');
      const confirmExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Check for existing pending alert (allow re-send)
      const existingPending = await PriceAlert.findOne({ phoneId: phone._id, email: emailLower, status: 'pending' });
      if (existingPending) {
        // Update token and re-send
        await PriceAlert.updateOne({ _id: existingPending._id }, { $set: { confirmTokenHash: tokenHash, confirmTokenExpires: confirmExpiry } });
      } else {
        // Check if already confirmed
        const existingConfirmed = await PriceAlert.findOne({ phoneId: phone._id, email: emailLower, status: 'confirmed' });
        if (existingConfirmed) {
          return NextResponse.json({ success: true, message: 'You are already subscribed to price alerts for this phone.' });
        }
        // Check if unsubscribed — re-activate as pending
        const existingUnsub = await PriceAlert.findOne({ phoneId: phone._id, email: emailLower, status: 'unsubscribed' });
        if (existingUnsub) {
          await PriceAlert.updateOne({ _id: existingUnsub._id }, {
            $set: { status: 'pending', confirmTokenHash: tokenHash, confirmTokenExpires: confirmExpiry, confirmedAt: null, notified: false, unsubscribedAt: null },
          });
        } else {
          await PriceAlert.create({
            phoneId: phone._id,
            email: emailLower,
            targetPrice: 0,
            notified: false,
            status: 'pending',
            confirmTokenHash: tokenHash,
            confirmTokenExpires: confirmExpiry,
          });
        }
      }

      // Send confirmation email if email is configured
      if (isEmailConfigured()) {
        const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';
        const confirmLink = `${siteUrl}/api/price-alerts/confirm?token=${confirmToken}&email=${encodeURIComponent(emailLower)}`;
        const unsubscribeLink = `${siteUrl}/api/price-alerts/unsubscribe?email=${encodeURIComponent(emailLower)}&phoneId=${phone._id}`;
        try {
          const transporter = await getEmailTransporter();
          await transporter.sendMail({
            from: `"PhoneDock" <${process.env.EMAIL_USER}>`,
            to: emailLower,
            subject: `Confirm: Price Alert for ${phone.modelName}`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">Confirm Your Price Alert</h2>
        <p>You subscribed to price drop alerts for <strong>${phone.modelName}</strong>.</p>
        <p>Click below to confirm your subscription:</p>
        <a href="${confirmLink}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Confirm Subscription</a>
        <p style="color:#999;font-size:12px;margin-top:16px">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
        <p style="font-size:12px"><a href="${unsubscribeLink}">Unsubscribe</a></p>
      </div>`,
          });
        } catch (e) { console.error('[PriceAlert] Confirmation email failed:', (e as Error).message); }
      }

      return NextResponse.json({ success: true, message: 'Confirmation email sent. Please check your inbox.' });
    }

    // First-setup POST (before auth routes — no auth required)
    const setupPostResult = await handleFirstSetupPost(req, segments);
    if (setupPostResult) return setupPostResult;

    // Admin auth routes (bootstrap, session, login, logout, change-password, forgot-password, reset-password)
    const authResult = await handleAdminAuthPost(req, segments);
    if (authResult) return authResult;

    // Import routes (file upload, validate, rollback)
    const importResult = await handleImportPost(req, segments);
    if (importResult) return importResult;

    // Admin CRUD routes (users create, phones create, brands create, news create, bulk-import, seed)
    const crudResult = await handleAdminCrudPost(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (sources, jobs, review, test)
    const collectorResult = await handleCollectorPost(req, segments);
    if (collectorResult) return collectorResult;

    // Price Tracker POST routes (update-price, sources, listings, test-source, approve, reject, toggle-lock)
    const priceTrackerPostResult = await handlePriceTrackerPost(req, segments);
    if (priceTrackerPostResult) return priceTrackerPostResult;

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API POST error:', e.message);
    const msg = e?.message || '';
    if (msg.includes('MONGODB_URI') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('Authentication failed') || msg.includes('IP is not allowed')) {
      return NextResponse.json({ error: 'Database connection failed. Please set MONGODB_URI in environment variables.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============ PUT HANDLER ============
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  // MongoDB-backed IP rate limiting
  const ip = getClientIp(req);
  try {
    await connectDB();
    if (!await checkIpRateLimit(`api:${ip}`, 400, 60_000, RateLimit)) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  try {
    // Admin CRUD routes (phones, brands, news update, toggle-featured, toggle-trending)
    const crudResult = await handleAdminCrudPut(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (sources toggle)
    const collectorResult = await handleCollectorPut(req, segments);
    if (collectorResult) return collectorResult;

    // Price Tracker PUT routes (sources, listings)
    const priceTrackerPutResult = await handlePriceTrackerPut(req, segments);
    if (priceTrackerPutResult) return priceTrackerPutResult;

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API PUT error:', e.message, e.stack);
    const msg = e?.message || '';
    if (msg.includes('MONGODB_URI') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('Authentication failed') || msg.includes('IP is not allowed')) {
      return NextResponse.json({ error: 'Database connection failed. Please set MONGODB_URI in environment variables.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

// ============ DELETE HANDLER ============
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  // MongoDB-backed IP rate limiting
  const ip = getClientIp(req);
  try {
    await connectDB();
    if (!await checkIpRateLimit(`api:${ip}`, 400, 60_000, RateLimit)) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  try {
    // Admin auth DELETE routes (sessions management)
    const authDeleteResult = await handleAdminAuthDelete(req, segments);
    if (authDeleteResult) return authDeleteResult;

    // Admin CRUD routes (phones, brands, news delete)
    const crudResult = await handleAdminCrudDelete(req, segments);
    if (crudResult) return crudResult;

    // Collector routes (jobs delete)
    const collectorResult = await handleCollectorDelete(req, segments);
    if (collectorResult) return collectorResult;

    // Price Tracker DELETE routes (sources, listings)
    const priceTrackerDeleteResult = await handlePriceTrackerDelete(req, segments);
    if (priceTrackerDeleteResult) return priceTrackerDeleteResult;

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API DELETE error:', e.message);
    const msg = e?.message || '';
    if (msg.includes('MONGODB_URI') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('Authentication failed') || msg.includes('IP is not allowed')) {
      return NextResponse.json({ error: 'Database connection failed. Please set MONGODB_URI in environment variables.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}