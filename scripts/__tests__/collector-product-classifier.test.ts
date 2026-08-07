import assert from 'node:assert/strict';
import { classifyCollectorPage, normalizeCollectedModelName } from '../../src/lib/collectors/page-classifier';

const productHtml = '<html><head><meta property="og:title" content="Samsung Galaxy A37 Price in Pakistan & Specifications - WhatMobile"><script type="application/ld+json">{"@type":"Product","name":"Samsung Galaxy A37"}</script></head><body>Specifications Display Camera Battery RAM Storage</body></html>';

assert.equal(classifyCollectorPage({ url: 'https://www.whatmobile.com.pk/Samsung_Galaxy-A37', html: productHtml, sourceName: 'WhatMobile' }).kind, 'product');
assert.equal(classifyCollectorPage({ url: 'https://www.whatmobile.com.pk/Infinix_GT-50-Pro', html: productHtml, sourceName: 'WhatMobile' }).kind, 'product');
assert.equal(classifyCollectorPage({ url: 'https://www.whatmobile.com.pk/Vivo_X300-FE', html: productHtml, sourceName: 'WhatMobile' }).kind, 'product');
assert.notEqual(classifyCollectorPage({ url: 'https://www.whatmobile.com.pk/Samsung_Mobiles_Prices', title: 'Samsung Mobiles – Samsung Mobile Phones Prices 2026 - WhatMobile', sourceName: 'WhatMobile' }).kind, 'product');
assert.notEqual(classifyCollectorPage({ url: 'https://www.whatmobile.com.pk/10000-to-20000-Mobiles', title: '10000 to 20000 Rs Mobile Phones Prices - WhatMobile', sourceName: 'WhatMobile' }).kind, 'product');
assert.equal(classifyCollectorPage({ url: 'https://www.whatmobile.com.pk/How-to-Block-Stolen-Mobile', title: 'How to Block your Stolen / Lost Mobile Phone - WhatMobile', sourceName: 'WhatMobile' }).kind, 'article');
assert.equal(classifyCollectorPage({ url: 'https://www.samsung.com/pk/all-about-galaxy/', title: 'All about Galaxy', sourceName: 'Samsung' }).kind, 'navigation');
assert.equal(classifyCollectorPage({ url: 'https://www.samsung.com/pk/smartphones/compare/', title: 'Compare', sourceName: 'Samsung' }).kind, 'navigation');
assert.equal(normalizeCollectedModelName('Samsung', 'Samsung Galaxy A37 Price in Pakistan & Specifications - WhatMobile'), 'Galaxy A37');
assert.equal(normalizeCollectedModelName('Samsung', 'Samsung Galaxy A57 5G Price in Pakistan 2026'), 'Galaxy A57 5G');
console.log('collector product classifier tests passed');
