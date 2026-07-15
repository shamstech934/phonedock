import { NextRequest, NextResponse } from 'next/server';
import { Phone, Brand, News, Admin, ActivityLog, PhoneSpecs, PhoneImage, PhoneBenchmark, PhonePrice } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission, phoneToJSON, hashPassword, isStrongPassword, MAX_UPLOAD_RECORDS } from './helpers';

// ============ ADMIN CRUD GET ============

export async function handleAdminCrudGet(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/stats ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'stats') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'dashboard:read'); if (permCheck) return permCheck;
    await connectDB();
    const [totalPhones, totalBrands, trendingCount, featuredCount, newsCount, recentActivity] = await Promise.all([
      Phone.countDocuments({ active: true }),
      Brand.countDocuments({ active: true }),
      Phone.countDocuments({ active: true, trending: true }),
      Phone.countDocuments({ active: true, featured: true }),
      News.countDocuments({ published: true }),
      ActivityLog.find().sort({ createdAt: -1 }).limit(20).populate('adminId', 'name email').lean(),
    ]);
    const priceResult = await Phone.aggregate([
      { $match: { active: true, pricePKR: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$pricePKR' } } },
    ]);
    const priceDistribution = await Phone.aggregate([
      { $match: { active: true, pricePKR: { $gt: 0 } } },
      {
        $bucket: {
          groupBy: '$pricePKR',
          boundaries: [0, 20000, 40000, 60000, 100000, Infinity],
          default: 'Above 100K',
          output: { count: { $sum: 1 } },
        },
      },
    ]);
    const distLabels = ['Under 20K', '20K - 40K', '40K - 60K', '60K - 100K', 'Above 100K'];
    return NextResponse.json({
      totalPhones, totalBrands, trendingCount, featuredCount, newsCount,
      avgPrice: priceResult[0]?.avg || 0,
      priceDistribution: priceDistribution.map((d: any, i: number) => ({ range: distLabels[i] || d._id, count: d.count })),
      recentActivity,
    });
  }

  // ---- /api/admin/phones ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const phones = await Phone.find({ active: true }).sort({ createdAt: -1 }).populate('brand').lean();
    return NextResponse.json({ phones: phones.map((p: any) => phoneToJSON(p)) });
  }

  // ---- /api/admin/phones/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:read'); if (permCheck) return permCheck;
    await connectDB();
    const phone = await Phone.findById(segments[2]).populate('brand');
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const [specs, benchmarks, images, prices] = await Promise.all([
      PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
      PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
      PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
      PhonePrice.find({ phoneId: phone._id }).lean(),
    ]);
    return NextResponse.json(phoneToJSON(phone, specs, benchmarks, images, prices));
  }

  // ---- /api/admin/brands ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:read'); if (permCheck) return permCheck;
    await connectDB();
    const brands = await Brand.find().sort({ sortOrder: 1 }).lean();
    return NextResponse.json(brands);
  }

  // ---- /api/admin/news ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:read'); if (permCheck) return permCheck;
    await connectDB();
    const news = await News.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(news);
  }

  // ---- /api/admin/users ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:read'); if (permCheck) return permCheck;
    await connectDB();
    const users = await Admin.find().select('-password -resetTokenHash -resetTokenExpires').sort({ createdAt: -1 }).lean();
    return NextResponse.json(users);
  }

  // ---- /api/admin/activity ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'activity') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'activity:read'); if (permCheck) return permCheck;
    await connectDB();
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100).populate('adminId', 'name email').lean();
    return NextResponse.json(logs);
  }

  return undefined;
}

// ============ ADMIN CRUD POST ============

export async function handleAdminCrudPost(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/users (CREATE — superadmin only) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'users') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'users:manage'); if (permCheck) return permCheck;
    const body = await req.json();
    const { email, name, role, password } = body;
    if (!email || !name || !password) return NextResponse.json({ error: 'Email, name, and password required' }, { status: 400 });
    const pwCheck = isStrongPassword(password);
    if (!pwCheck.valid) return NextResponse.json({ error: `Weak password: ${pwCheck.errors.join(', ')}` }, { status: 400 });
    const validRoles = ['superadmin', 'admin', 'editor', 'reviewer'];
    const assignedRole = validRoles.includes(role) ? role : 'admin';
    if (assignedRole === 'superadmin' && admin.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmins can create superadmin accounts' }, { status: 403 });
    }
    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    const newAdmin = await Admin.create({
      email: email.toLowerCase(), name: (name as string).trim(),
      password: await hashPassword(password),
      role: assignedRole, active: true, sessionVersion: 0,
    });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_user', details: `Created admin: ${email}`, entityType: 'admin', entityId: newAdmin._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: newAdmin._id?.toString() });
  }

  // ---- /api/admin/phones (CREATE) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:create'); if (permCheck) return permCheck;
    const body = await req.json();
    const { brandId, modelName, slug: inputSlug, pricePKR, ptaStatus, ptaApproved, releaseDate,
      thumbnail, description, featured, trending, upcoming, status: phoneStatus,
      cameraScore, performanceScore, batteryScore, displayScore, valueScore, overallRating,
      pros, cons, reviewSummary, reviewVerdict, seoTitle, seoDescription, keywords,
      specs, benchmarks, images, prices } = body;
    if (!brandId || !modelName) return NextResponse.json({ error: 'brandId and modelName required' }, { status: 400 });
    const brand = await Brand.findById(brandId);
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 400 });
    const slug = inputSlug || modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Phone.findOne({ slug });
    if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    const phone = await Phone.create({ brandId, modelName, slug, pricePKR: pricePKR || 0, ptaStatus: ptaStatus || 'Unknown', ptaApproved: ptaApproved || false, releaseDate: releaseDate || '', thumbnail: thumbnail || '', description: description || '', featured: featured || false, trending: trending || false, upcoming: upcoming || false, status: phoneStatus || 'published', active: true, cameraScore: cameraScore || 0, performanceScore: performanceScore || 0, batteryScore: batteryScore || 0, displayScore: displayScore || 0, valueScore: valueScore || 0, overallRating: overallRating || 0, pros: pros || '', cons: cons || '', reviewSummary: reviewSummary || '', reviewVerdict: reviewVerdict || '', seoTitle: seoTitle || '', seoDescription: seoDescription || '', keywords: keywords || '' });
    if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...specs, phoneId: phone._id }, { upsert: true });
    if (benchmarks && typeof benchmarks === 'object') await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...benchmarks, phoneId: phone._id }, { upsert: true });
    if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: any, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
    if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_phone', details: `Created: ${brand.name} ${modelName}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: phone._id?.toString(), slug });
  }

  // ---- /api/admin/brands (CREATE) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:create'); if (permCheck) return permCheck;
    const body = await req.json();
    const { name, slug: inputSlug, logo, country, description, sortOrder } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const slug = inputSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (await Brand.findOne({ slug })) return NextResponse.json({ error: 'Brand slug exists' }, { status: 409 });
    const brand = await Brand.create({ name, slug, logo: logo || '', country: country || '', description: description || '', sortOrder: sortOrder || 0, active: true });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_brand', details: `Created: ${name}`, entityType: 'brand', entityId: brand._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: brand._id?.toString() });
  }

  // ---- /api/admin/news (CREATE) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:create'); if (permCheck) return permCheck;
    const body = await req.json();
    const { title, slug: inputSlug, content, excerpt, category, image, author, published, featured } = body;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const slug = (inputSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).slice(0, 80);
    if (await News.findOne({ slug })) return NextResponse.json({ error: 'News slug exists' }, { status: 409 });
    const news = await News.create({ title, slug, content: content || '', excerpt: excerpt || '', category: category || 'General', image: image || '', author: author || '', published: published !== false, featured: featured || false, status: 'published' });
    try { await ActivityLog.create({ adminId: admin._id, action: 'create_news', details: `Created: ${title}`, entityType: 'news', entityId: news._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: news._id?.toString() });
  }

  // ---- /api/admin/phones/bulk-import ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones' && segments[2] === 'bulk-import') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'imports:execute'); if (permCheck) return permCheck;
    const body = await req.json();
    const { records, mode = 'skip_duplicates' } = body;
    if (!Array.isArray(records) || records.length === 0) return NextResponse.json({ error: 'No records' }, { status: 400 });
    if (records.length > MAX_UPLOAD_RECORDS) return NextResponse.json({ error: `Too many records (max ${MAX_UPLOAD_RECORDS})` }, { status: 400 });
    const brands = await Brand.find().lean();
    const brandMap = new Map(brands.map((b: any) => [b.name.toLowerCase(), b._id]));
    const allPhones = await Phone.find().populate('brand').lean();
    const existingSlugs = new Set(allPhones.map((p: any) => p.slug));
    const existingBM = new Set(allPhones.map((p: any) => `${(p.brand as any)?.name || ''}|${p.modelName}`.toLowerCase()));
    let imported = 0, updated = 0, skipped = 0, failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        const bName = String(r.brand || r.brandName || '').trim();
        const mName = String(r.model || r.modelName || '').trim();
        if (!bName || !mName) { skipped++; errors.push(`Row ${i+1}: Missing brand/model`); continue; }
        let bId = brandMap.get(bName.toLowerCase());
        if (!bId) { const bslug = bName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const nb = await Brand.create({ name: bName, slug: bslug, active: true, description: '', sortOrder: 0, logo: '', country: '' }); brandMap.set(bName.toLowerCase(), nb._id); bId = nb._id; }
        const slug = String(r.slug || '').trim() || `${bName} ${mName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const isDup = existingSlugs.has(slug) || existingBM.has(`${bName}|${mName}`.toLowerCase());
        if (isDup && mode === 'skip_duplicates') { skipped++; continue; }
        if (isDup && mode === 'new_only') { skipped++; continue; }
        const pd: any = { brandId: bId, modelName: mName, slug, pricePKR: parseInt(r.pricePKR) || parseInt(r.price) || 0, ptaStatus: r.ptaStatus || 'Unknown', ptaApproved: r.ptaApproved === true, releaseDate: r.releaseDate || '', thumbnail: r.thumbnail || '', description: r.description || '', featured: r.featured === true, trending: r.trending === true, upcoming: r.upcoming === true, status: 'published', active: true, cameraScore: parseInt(r.cameraScore) || 0, performanceScore: parseInt(r.performanceScore) || 0, batteryScore: parseInt(r.batteryScore) || 0, displayScore: parseInt(r.displayScore) || 0, valueScore: parseInt(r.valueScore) || 0, overallRating: parseInt(r.overallRating) || 0, pros: r.pros || '', cons: r.cons || '', reviewSummary: r.reviewSummary || '', reviewVerdict: r.reviewVerdict || '' };
        if (isDup && mode === 'update_existing') { const ex = await Phone.findOne({ slug }); if (ex) { await Phone.updateOne({ _id: ex._id }, { $set: pd }); if (r.specs) await PhoneSpecs.findOneAndUpdate({ phoneId: ex._id }, { $set: r.specs }, { upsert: true }); if (r.benchmarks) await PhoneBenchmark.findOneAndUpdate({ phoneId: ex._id }, { $set: r.benchmarks }, { upsert: true }); updated++; continue; } }
        const phone = await Phone.create(pd); existingSlugs.add(slug); existingBM.add(`${bName}|${mName}`.toLowerCase());
        if (r.specs) await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...r.specs, phoneId: phone._id }, { upsert: true });
        if (r.benchmarks) await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...r.benchmarks, phoneId: phone._id }, { upsert: true });
        if (Array.isArray(r.images)) await PhoneImage.insertMany(r.images.map((img: any, j: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? j })));
        if (Array.isArray(r.prices)) await PhonePrice.insertMany(r.prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
        imported++;
      } catch (err: any) { failed++; errors.push(`Row ${i+1}: ${err.message}`); }
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'bulk_import', details: `Bulk: ${imported} new, ${updated} updated, ${skipped} skipped, ${failed} failed`, entityType: 'phone' }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, total: records.length, imported, updated, skipped, failed, errors });
  }

  // ---- /api/admin/seed (REMOVED — use `npm run seed` CLI script instead) ----
  if (segments.length === 2 && segments[0] === 'admin' && segments[1] === 'seed') {
    return NextResponse.json({ error: 'Seed endpoint removed. Use `npm run seed` from the CLI.' }, { status: 410 });
  }

  return undefined;
}

// ============ ADMIN CRUD PUT ============

export async function handleAdminCrudPut(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/phones/:id (UPDATE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
    const phone = await Phone.findById(segments[2]);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    const { brandId, modelName, slug: inputSlug, pricePKR, ptaStatus, ptaApproved, releaseDate,
      thumbnail, description, featured, trending, upcoming, status: phoneStatus, active,
      cameraScore, performanceScore, batteryScore, displayScore, valueScore, overallRating,
      pros, cons, reviewSummary, reviewVerdict, seoTitle, seoDescription, keywords,
      specs, benchmarks, images, prices } = body;
    if (modelName) phone.modelName = modelName;
    if (inputSlug !== undefined && inputSlug !== phone.slug) {
      const existing = await Phone.findOne({ slug: inputSlug, _id: { $ne: phone._id } });
      if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      phone.slug = inputSlug;
    }
    if (brandId) { const b = await Brand.findById(brandId); if (b) phone.brandId = brandId; }
    if (pricePKR !== undefined) phone.pricePKR = pricePKR;
    if (ptaStatus !== undefined) phone.ptaStatus = ptaStatus;
    if (ptaApproved !== undefined) phone.ptaApproved = ptaApproved;
    if (releaseDate !== undefined) phone.releaseDate = releaseDate;
    if (thumbnail !== undefined) phone.thumbnail = thumbnail;
    if (description !== undefined) phone.description = description;
    if (featured !== undefined) phone.featured = featured;
    if (trending !== undefined) phone.trending = trending;
    if (upcoming !== undefined) phone.upcoming = upcoming;
    if (phoneStatus !== undefined) {
      const pubCheck = requirePermission(admin, 'phones:publish'); if (pubCheck) return pubCheck;
      phone.status = phoneStatus;
    }
    if (active !== undefined && active === false) {
      const delCheck = requirePermission(admin, 'phones:delete'); if (delCheck) return delCheck;
      phone.active = active;
    } else if (active !== undefined) {
      phone.active = active;
    }
    if (cameraScore !== undefined) phone.cameraScore = cameraScore;
    if (performanceScore !== undefined) phone.performanceScore = performanceScore;
    if (batteryScore !== undefined) phone.batteryScore = batteryScore;
    if (displayScore !== undefined) phone.displayScore = displayScore;
    if (valueScore !== undefined) phone.valueScore = valueScore;
    if (overallRating !== undefined) phone.overallRating = overallRating;
    if (pros !== undefined) phone.pros = pros;
    if (cons !== undefined) phone.cons = cons;
    if (reviewSummary !== undefined) phone.reviewSummary = reviewSummary;
    if (reviewVerdict !== undefined) phone.reviewVerdict = reviewVerdict;
    if (seoTitle !== undefined) phone.seoTitle = seoTitle;
    if (seoDescription !== undefined) phone.seoDescription = seoDescription;
    if (keywords !== undefined) phone.keywords = keywords;
    await phone.save();
    if (specs && typeof specs === 'object') await PhoneSpecs.findOneAndUpdate({ phoneId: phone._id }, { ...specs, phoneId: phone._id }, { upsert: true });
    if (benchmarks && typeof benchmarks === 'object') await PhoneBenchmark.findOneAndUpdate({ phoneId: phone._id }, { ...benchmarks, phoneId: phone._id }, { upsert: true });
    if (images !== undefined) {
      await PhoneImage.deleteMany({ phoneId: phone._id });
      if (Array.isArray(images) && images.length > 0) await PhoneImage.insertMany(images.map((img: any, i: number) => ({ phoneId: phone._id, url: img.url || '', altText: img.altText || '', sortOrder: img.sortOrder ?? i })));
    }
    if (prices !== undefined) {
      await PhonePrice.deleteMany({ phoneId: phone._id });
      if (Array.isArray(prices) && prices.length > 0) await PhonePrice.insertMany(prices.map((pr: any) => ({ phoneId: phone._id, storeName: pr.storeName || '', price: pr.price || 0, url: pr.url || '', inStock: pr.inStock !== false })));
    }
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_phone', details: `Updated: ${phone.modelName}`, entityType: 'phone', entityId: phone._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: phone._id?.toString() });
  }

  // ---- /api/admin/brands/:id (UPDATE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:edit'); if (permCheck) return permCheck;
    const brand = await Brand.findById(segments[2]);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    if (body.name) brand.name = body.name;
    if (body.logo !== undefined) brand.logo = body.logo;
    if (body.country !== undefined) brand.country = body.country;
    if (body.description !== undefined) brand.description = body.description;
    if (body.sortOrder !== undefined) brand.sortOrder = body.sortOrder;
    if (body.active === false) {
      const delCheck = requirePermission(admin, 'brands:delete'); if (delCheck) return delCheck;
      brand.active = false;
    } else if (body.active !== undefined) {
      brand.active = body.active;
    }
    await brand.save();
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_brand', details: `Updated: ${brand.name}`, entityType: 'brand', entityId: brand._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: brand._id?.toString() });
  }

  // ---- /api/admin/news/:id (UPDATE) ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:edit'); if (permCheck) return permCheck;
    const news = await News.findById(segments[2]);
    if (!news) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    if (body.title) news.title = body.title;
    if (body.slug !== undefined && body.slug !== news.slug) {
      const existing = await News.findOne({ slug: body.slug, _id: { $ne: news._id } });
      if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
      news.slug = body.slug;
    }
    if (body.content !== undefined) news.content = body.content;
    if (body.excerpt !== undefined) news.excerpt = body.excerpt;
    if (body.category) news.category = body.category;
    if (body.image !== undefined) news.image = body.image;
    if (body.author !== undefined) news.author = body.author;
    if (body.published !== undefined) {
      const pubCheck = requirePermission(admin, 'news:publish'); if (pubCheck) return pubCheck;
      news.published = body.published;
    }
    if (body.featured !== undefined) news.featured = body.featured;
    if (body.status !== undefined) news.status = body.status;
    await news.save();
    try { await ActivityLog.create({ adminId: admin._id, action: 'update_news', details: `Updated: ${news.title}`, entityType: 'news', entityId: news._id?.toString() }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true, id: news._id?.toString() });
  }

  // ---- /api/admin/phones/:id/toggle-featured ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'phones' && segments[3] === 'toggle-featured') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
    const phone = await Phone.findById(segments[2]);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    phone.featured = !phone.featured; await phone.save();
    return NextResponse.json({ success: true, featured: phone.featured });
  }

  // ---- /api/admin/phones/:id/toggle-trending ----
  if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'phones' && segments[3] === 'toggle-trending') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:edit'); if (permCheck) return permCheck;
    const phone = await Phone.findById(segments[2]);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    phone.trending = !phone.trending; await phone.save();
    return NextResponse.json({ success: true, trending: phone.trending });
  }

  return undefined;
}

// ============ ADMIN CRUD DELETE ============

export async function handleAdminCrudDelete(req: NextRequest, segments: string[]): Promise<NextResponse | undefined> {
  // ---- /api/admin/phones/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'phones') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'phones:delete'); if (permCheck) return permCheck;
    const id = segments[2];
    const phone = await Phone.findById(id);
    if (!phone) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const name = phone.modelName;
    await Promise.all([
      Phone.deleteOne({ _id: id }),
      PhoneSpecs.deleteMany({ phoneId: id }),
      PhoneBenchmark.deleteMany({ phoneId: id }),
      PhoneImage.deleteMany({ phoneId: id }),
      PhonePrice.deleteMany({ phoneId: id }),
    ]);
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_phone', details: `Deleted: ${name}`, entityType: 'phone', entityId: id }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/brands/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'brands') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'brands:delete'); if (permCheck) return permCheck;
    const id = segments[2];
    const brand = await Brand.findById(id);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const phoneCount = await Phone.countDocuments({ brandId: id });
    if (phoneCount > 0) return NextResponse.json({ error: `Cannot delete: ${phoneCount} phones use this brand` }, { status: 400 });
    const name = brand.name;
    await Brand.deleteOne({ _id: id });
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_brand', details: `Deleted: ${name}`, entityType: 'brand', entityId: id }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  // ---- /api/admin/news/:id ----
  if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'news') {
    const authResult = await getAdminFromRequest(req); if (authResult.error) return authResult.error; const admin = authResult.admin;
    const permCheck = requirePermission(admin, 'news:delete'); if (permCheck) return permCheck;
    const id = segments[2];
    const news = await News.findById(id);
    if (!news) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const title = news.title;
    await News.deleteOne({ _id: id });
    try { await ActivityLog.create({ adminId: admin._id, action: 'delete_news', details: `Deleted: ${title}`, entityType: 'news', entityId: id }); } catch (e) { console.error('[ActivityLog]', e); }
    return NextResponse.json({ success: true });
  }

  return undefined;
}