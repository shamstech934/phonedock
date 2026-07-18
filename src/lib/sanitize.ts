export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips dangerous HTML elements and attributes for defense-in-depth.
 * Used on admin-created content before rendering with dangerouslySetInnerHTML.
 * Allows safe tags: p, br, div, span, h1-h6, a, img, ul, ol, li, strong, em,
 * b, i, u, blockquote, table, thead, tbody, tr, th, td, pre, code, hr, figure,
 * figcaption, video, source, sup, sub.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  let safe = html;
  // Remove script, iframe, object, embed, form, input, textarea, select, button, meta, link, base tags
  safe = safe.replace(/<\s*\/?\s*(script|iframe|object|embed|form|input|textarea|select|button|meta|link|base)[^>]*>/gi, '');
  // Remove on* event handler attributes
  safe = safe.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: URLs
  safe = safe.replace(/(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi, '$1="');
  // Remove data: URLs in src (except for images which are allowed)
  safe = safe.replace(/(src)\s*=\s*["']?\s*data\s*:(?!image)/gi, '$1=""');
  return safe;
}