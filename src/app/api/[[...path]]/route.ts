import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RateLimit, UserReview, Phone, PriceAlert, PriceHistory } from '@/lib/models';
import { connectDB, checkIpRateLimit, getClientIp, isEmailConfigured } from './handlers/helpers';
import { hashResetToken } from '@/lib/auth';
import { handlePublicGet, handlePublicPost } from './handlers/public';
import { verifyTurnstile } from '@/lib/turnstile';
import { handleAdminAuthGet, handleAdminAuthPost, handleAdminAuthDelete } from './handlers/admin-auth';
import { handleFirstSetupGet, handleFirstSetupPost } from './handlers/first-setup';
import { handleAdminCrudGet, handleAdminCrudPost, handleAdminCrudPut, handleAdminCrudDelete } from './handlers/admin-crud';
import { handleCollectorGet, handleCollectorPost, handleCollectorPut, handleCollectorDelete } from './handlers/collector';
import { handleImportGet, handleImportPost } from './handlers/import';
import { handleDownloadSample } from './handlers/download';
import { syncYouTubeVideos } from '@/lib/video-sync';
import { Video } from '@/lib/models';

// ============ HELPERS ============

async function sendConfirmationEmail(email: string, rawToken: string, phoneName: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';
  const confirmUrl = `${baseUrl}/api/price-alerts/confirm?token=${rawToken}`;
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: parseInt(process.env.EMAIL_PORT || '587') === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Confirm your price alert for ${phoneName}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:20px">
      <h2 style="color:#1a1a1a">Confirm Your Price Alert</h2>
      <p style="color:#666">You requested a price drop alert for <strong>${phoneName}</strong> on PhoneDock.</p>
      <p style="margin:24px 0"><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Confirm Alert</a></p>
      <p style="color:#999;font-size:12px">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
    </div>`,
  });
}

// ============ GET HANDLER ============
export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const segments = path || [];

  try {
    // Cron: /api/cron/sync-youtube — protected by CRON_SECRET, NO rate limiting
    if (segments.length === 2 && segments[0] === 'cron' && segments[1] === 'sync-youtube') {
      const secret = req.headers.get('authorization')?.replace('Bearer ', '');
      if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const result = await syncYouTubeVideos();
      return NextResponse.json(result);
    }

    // Cron: /api/cron/check-price-drops — protected by CRON_SECRET
    if (segments.length === 2 && segments[0] === 'cron' && segments[1] === 'check-price-drops') {
      const secret = req.headers.get('authorization')?.replace('Bearer ', '');
      if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      await connectDB();
      const alerts = await PriceAlert.find({ status: 'confirmed', notified: false }).populate('phoneId').lean();
      let sent = 0;
      for (const alert of alerts) {
        const phone = alert.phoneId as any;
        if (!phone || !phone.pricePKR) continue;
        const lastPrice = await PriceHistory.findOne({ phoneId: phone._id, storeName: null }).sort({ recordedAt: -1 }).lean();
        if (lastPrice && lastPrice.price > phone.pricePKR) {
          // Price has dropped! Send notification email (using nodemailer)
          try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
              host: process.env.EMAIL_HOST,
              port: parseInt(process.env.EMAIL_PORT || '587'),
              secure: process.env.EMAIL_SECURE === 'true',
              auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            });
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
                  <td style="padding:12px;background:#fef2f2;text-decoration:line-through;color:#999;font-size:14px">PKR ${(lastPrice.price).toLocaleString()}</td>
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

    // GET /api/price-alerts/confirm?token=xxx
    if (segments.length === 2 && segments[0] === 'price-alerts' && segments[1] === 'confirm') {
      await connectDB();
      const { searchParams } = new URL(req.url);
      const rawToken = searchParams.get('token') || '';
      if (!rawToken) {
        return new NextResponse('<html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Invalid or expired link</h2></body></html>', { headers: { 'Content-Type': 'text/html' } });
      }
      const tokenHash = hashResetToken(rawToken);
      const alert = await PriceAlert.findOne({
        confirmationTokenHash: tokenHash,
        confirmationTokenExpires: { $gt: new Date() },
        status: 'pending',
      });
      if (!alert) {
        return new NextResponse('<html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Invalid or expired link</h2><p style="color:#999">The confirmation link is invalid or has expired. Please subscribe again.</p></body></html>', { headers: { 'Content-Type': 'text/html' } });
      }
      alert.status = 'confirmed';
      alert.confirmedAt = new Date();
      alert.confirmationTokenHash = '';
      alert.confirmationTokenExpires = null;
      await alert.save();
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Price Alert Confirmed</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;max-width:480px;margin:0 auto">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <h1 style="color:#16a34a;margin-bottom:8px">Price Alert Confirmed!</h1>
        <p style="color:#666">You will be notified when the price drops. Thank you for subscribing to PhoneDock alerts.</p>
      </body></html>`;
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
    }

    // GET /api/price-alerts/unsubscribe?email=xxx&phoneId=xxx
    if (segments.length === 2 && segments[0] === 'price-alerts' && segments[1] === 'unsubscribe') {
      await connectDB();
      const { searchParams } = new URL(req.url);
      const email = (searchParams.get('email') || '').toLowerCase();
      const phoneId = searchParams.get('phoneId') || '';
      if (!email || !phoneId) {
        return new NextResponse('<html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Missing parameters</h2></body></html>', { headers: { 'Content-Type': 'text/html' } });
      }
      const alert = await PriceAlert.findOne({ email, phoneId, status: { $in: ['confirmed', 'pending'] } });
      if (alert) {
        alert.status = 'unsubscribed';
        alert.unsubscribedAt = new Date();
        alert.confirmationTokenHash = '';
        alert.confirmationTokenExpires = null;
        await alert.save();
      }
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;max-width:480px;margin:0 auto">
        <div style="font-size:48px;margin-bottom:16px">👋</div>
        <h1 style="margin-bottom:8px">Unsubscribed Successfully</h1>
        <p style="color:#666">You will no longer receive price drop alerts for this phone.</p>
      </body></html>`;
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
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

      const existing = await PriceAlert.findOne({ phoneId: phone._id, email: emailLower });

      if (existing) {
        if (existing.status === 'unsubscribed') {
          // Re-activate as pending with new token
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = hashResetToken(rawToken);
          existing.status = 'pending';
          existing.confirmationTokenHash = tokenHash;
          existing.confirmationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
          existing.confirmedAt = null;
          existing.notified = false;
          existing.unsubscribedAt = null;
          await existing.save();
          if (isEmailConfigured()) {
            await sendConfirmationEmail(emailLower, rawToken, phone.modelName);
          }
          return NextResponse.json({ success: true, message: 'Confirmation email sent. Please check your inbox.' });
        }
        // Already confirmed or pending — return generic message
        return NextResponse.json({ success: true, message: 'Confirmation email sent. Please check your inbox.' });
      }

      // New subscription — create as pending
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(rawToken);
      await PriceAlert.create({
        phoneId: phone._id,
        email: emailLower,
        targetPrice: 0,
        notified: false,
        status: 'pending',
        confirmationTokenHash: tokenHash,
        confirmationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      if (isEmailConfigured()) {
        await sendConfirmationEmail(emailLower, rawToken, phone.modelName);
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

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('API PUT error:', e.message);
    const msg = e?.message || '';
    if (msg.includes('MONGODB_URI') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('Authentication failed') || msg.includes('IP is not allowed')) {
      return NextResponse.json({ error: 'Database connection failed. Please set MONGODB_URI in environment variables.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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