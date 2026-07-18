// ─── Email Transporter Singleton (Server-Only) ─────────
// This file must ONLY be imported from server-side code (API routes, server components).
// Do NOT import from client components or shared UI libraries.

let _transporter: any = null;

/** Get or create a singleton nodemailer transporter */
export async function getEmailTransporter() {
  if (_transporter) return _transporter;
  const nm = await import('nodemailer');
  _transporter = nm.default.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return _transporter;
}