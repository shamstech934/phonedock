import sanitize from 'sanitize-html';

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const allowedTags = [
  'p','br','div','span','h1','h2','h3','h4','h5','h6','a','img','ul','ol','li',
  'strong','em','b','i','u','blockquote','table','thead','tbody','tr','th','td',
  'pre','code','hr','figure','figcaption','sup','sub'
];

/** Server-side allowlist sanitizer for admin-authored article HTML. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return sanitize(html, {
    allowedTags,
    allowedAttributes: {
      '*': ['class', 'title'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    transformTags: {
      a: (_tag, attrs) => ({
        tagName: 'a',
        attribs: {
          ...attrs,
          rel: 'noopener noreferrer nofollow',
          ...(attrs.target === '_blank' ? { target: '_blank' } : {}),
        },
      }),
    },
    exclusiveFilter(frame) {
      if (frame.tag === 'img' && !/^https?:\/\//i.test(frame.attribs.src || '')) return true;
      return false;
    },
  });
}
