import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Phone } from '@/lib/models/Phone';
import { UserReview, PriceAlert, RateLimit } from '@/lib/models/Other';
import { connectDB } from '@/lib/mongodb';
import { checkIpRateLimit, isEmailConfigured } from '@/app/api/[[...path]]/handlers/helpers';
import { verifyTurnstile } from '@/lib/turnstile';
import { getEmailTransporter } from '@/lib/email';
import { createUnsubscribeToken } from '@/lib/unsubscribe-token';

export async function handlePhonePublicPost(req: NextRequest, segments: string[], ip: string): Promise<NextResponse> {
  if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'reviews') {
    if (!await checkIpRateLimit(`review:${ip}`, 3, 3600_000, RateLimit)) {
      return NextResponse.json({ error: 'Too many reviews. Try again later.' }, { status: 429 });
    }
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    const body = await req.json();
    const { name, email, rating, comment, turnstileToken } = body;
    if (!name || !email || rating === undefined || rating === null || !comment) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRating = Number(rating);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) return NextResponse.json({ error: 'Rating must be an integer from 1 to 5' }, { status: 400 });
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) return NextResponse.json({ error: 'Bot verification required' }, { status: 403 });
      if (!await verifyTurnstile(turnstileToken, ip)) return NextResponse.json({ error: 'Bot verification failed' }, { status: 403 });
    }
    if (String(comment).length < 10 || String(comment).length > 1000) return NextResponse.json({ error: 'Comment must be 10-1000 characters' }, { status: 400 });
    if (String(name).length > 100) return NextResponse.json({ error: 'Name too long' }, { status: 400 });
    const spamFlags: string[] = [];
    if (/https?:\/\//i.test(comment)) spamFlags.push('contains_url');
    if (/(buy now|click here|free money|lottery|winner|crypto|investment)/i.test(comment)) spamFlags.push('suspected_spam');
    if (/^[A-Z\s.!?]+$/.test(comment)) spamFlags.push('all_caps');
    await UserReview.create({
      phoneId: phone._id,
      name: String(name).trim().slice(0, 100),
      email: normalizedEmail.slice(0, 200),
      rating: normalizedRating,
      comment: String(comment).trim().slice(0, 1000),
      status: spamFlags.length ? 'flagged' : 'pending',
      spamFlags,
    });
    return NextResponse.json({ success: true, message: 'Review submitted for moderation' });
  }

  if (segments.length === 3 && segments[0] === 'phones' && segments[2] === 'price-alerts') {
    if (!await checkIpRateLimit(`alert:${ip}`, 5, 3600_000, RateLimit)) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    await connectDB();
    const phone = await Phone.findOne({ slug: segments[1], active: true, status: 'published' });
    if (!phone) return NextResponse.json({ error: 'Phone not found' }, { status: 404 });
    const body = await req.json();
    const emailLower = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });

    const confirmToken = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(confirmToken).digest('hex');
    const confirmExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pending = await PriceAlert.findOne({ phoneId: phone._id, email: emailLower, status: 'pending' });
    if (pending) {
      await PriceAlert.updateOne({ _id: pending._id }, { $set: { confirmTokenHash: tokenHash, confirmTokenExpires: confirmExpiry } });
    } else {
      const confirmed = await PriceAlert.findOne({ phoneId: phone._id, email: emailLower, status: 'confirmed' });
      if (confirmed) return NextResponse.json({ success: true, message: 'You are already subscribed to price alerts for this phone.' });
      const unsubscribed = await PriceAlert.findOne({ phoneId: phone._id, email: emailLower, status: 'unsubscribed' });
      if (unsubscribed) {
        await PriceAlert.updateOne({ _id: unsubscribed._id }, { $set: { status: 'pending', confirmTokenHash: tokenHash, confirmTokenExpires: confirmExpiry, confirmedAt: null, notified: false, unsubscribedAt: null } });
      } else {
        await PriceAlert.create({ phoneId: phone._id, email: emailLower, targetPrice: 0, notified: false, status: 'pending', confirmTokenHash: tokenHash, confirmTokenExpires: confirmExpiry });
      }
    }

    if (isEmailConfigured()) {
      const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com';
      const confirmLink = `${siteUrl}/api/price-alerts/confirm?token=${confirmToken}&email=${encodeURIComponent(emailLower)}`;
      const unsubscribeToken = createUnsubscribeToken(emailLower, phone._id.toString());
      const unsubscribeLink = `${siteUrl}/api/price-alerts/unsubscribe?email=${encodeURIComponent(emailLower)}&phoneId=${phone._id}&token=${unsubscribeToken}`;
      try {
        const transporter = await getEmailTransporter();
        await transporter.sendMail({
          from: `"SpecsDekh" <${process.env.EMAIL_USER}>`,
          to: emailLower,
          subject: `Confirm: Price Alert for ${phone.modelName}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:20px"><h2>Confirm Your Price Alert</h2><p>You subscribed to price drop alerts for <strong>${phone.modelName}</strong>.</p><p><a href="${confirmLink}">Confirm Subscription</a></p><p style="font-size:12px"><a href="${unsubscribeLink}">Unsubscribe</a></p></div>`,
        });
      } catch (error) {
        console.error('[PriceAlert] Confirmation email failed:', error instanceof Error ? error.message : String(error));
      }
    }
    return NextResponse.json({ success: true, message: 'Confirmation email sent. Please check your inbox.' });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
