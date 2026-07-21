import assert from 'node:assert/strict';
import { sanitizeHtml } from '../../src/lib/sanitize';

const attacks = [
  '<script>alert(1)</script><p>safe</p>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="jav&#x61;script:alert(1)">x</a>',
  '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
  '<svg><script>alert(1)</script></svg>',
  '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
  '<a href="//evil.example">x</a>',
];
for (const payload of attacks) {
  const out = sanitizeHtml(payload).toLowerCase();
  assert.equal(out.includes('<script'), false);
  assert.equal(/\son\w+=/.test(out), false);
  assert.equal(out.includes('javascript:'), false);
  assert.equal(out.includes('data:'), false);
  assert.equal(out.includes('<svg'), false);
  assert.equal(out.includes('<math'), false);
}
const safe = sanitizeHtml('<p>Hello <strong>world</strong></p><a href="https://example.com" target="_blank">link</a>');
assert.match(safe, /<strong>world<\/strong>/);
assert.match(safe, /noopener noreferrer nofollow/);
console.log('Sanitizer security: 9/9 checks passed');
