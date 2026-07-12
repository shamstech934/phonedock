import { Brand, Phone, PhoneSpecs, PhoneImage, PhoneBenchmark, ImportHistory as ImportHistoryModel } from '@/lib/models';
import connectDB from '@/lib/mongodb';
import { Types } from 'mongoose';
import { RawPhoneRecord, ValidationError, ImportResult, ImportHistoryEntry } from './types';
import { validatePhoneRecord, extractPhoneData, generateSlug } from './validators';
import { categorizePhone, generateSEO, generateReviewTemplate } from './auto-generators';

const BATCH_SIZE = 100;

// ============ BRAND RESOLUTION ============
async function resolveBrand(brandName: string): Promise<Types.ObjectId | null> {
  if (!brandName) return null;

  // Try exact match first
  let brand = await Brand.findOne({ name: new RegExp(`^${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();

  if (!brand) {
    // Try slug match
    const slug = generateSlug(brandName);
    brand = await Brand.findOne({ slug }).lean();
  }

  if (brand) return brand._id as Types.ObjectId;

  // Auto-create brand
  const newBrand = await Brand.create({
    name: brandName.trim(),
    slug: generateSlug(brandName),
    logo: '',
    country: '',
    description: `${brandName} smartphones`,
    sortOrder: 0,
    active: true,
  });

  return newBrand._id as Types.ObjectId;
}

// ============ MAIN IMPORT FUNCTION ============
export async function importPhones(
  records: RawPhoneRecord[],
  options: {
    filename: string;
    fileType: 'json' | 'csv' | 'xlsx';
    autoCategorize?: boolean;
    autoSEO?: boolean;
    autoReview?: boolean;
    skipExisting?: boolean;
  }
): Promise<ImportResult & { historyId?: string }> {
  const startTime = Date.now();
  const result: ImportResult = {
    total: records.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    warnings: [],
    duration: 0,
  };

  // Collect all slugs for duplicate detection
  const existingSlugs = new Set<string>();
  const existingPhones = await Phone.find({}, { slug: 1 }).lean();
  for (const p of existingPhones) {
    existingSlugs.add((p as any).slug);
  }

  // Validate all records first
  const validatedRecords: Array<{ row: number; validation: ReturnType<typeof validatePhoneRecord> }> = [];
  for (let i = 0; i < records.length; i++) {
    const validation = validatePhoneRecord(records[i], i + 1, existingSlugs);
    validatedRecords.push({ row: i + 1, validation });

    if (!validation.valid) {
      result.errors.push(...validation.errors.map(e => ({
        row: e.row,
        model: records[i].modelName || records[i].model || `Row ${i + 1}`,
        error: `${e.field}: ${e.message}`,
      })));
      result.failed++;
    }
    result.warnings.push(...validation.warnings);
  }

  // Filter to valid records only
  const validRecords = validatedRecords.filter(r => r.validation.valid);

  // Process in batches
  for (let batchStart = 0; batchStart < validRecords.length; batchStart += BATCH_SIZE) {
    const batch = validRecords.slice(batchStart, batchStart + BATCH_SIZE);

    for (const { row, validation } of batch) {
      try {
        const phone = validation.phone;
        const { phoneData, specsData, benchData, images, brandName } = extractPhoneData(phone);

        // Resolve brand
        const brandId = await resolveBrand(brandName);
        if (!brandId) {
          result.errors.push({ row, model: phone.modelName || `Row ${row}`, error: 'Could not resolve or create brand' });
          result.failed++;
          continue;
        }
        phoneData.brandId = brandId;

        // Auto-generate SEO if enabled and fields are empty
        if (options.autoSEO && !phoneData.seoTitle) {
          const seo = generateSEO(phone);
          phoneData.seoTitle = seo.seoTitle;
          phoneData.seoDescription = seo.seoDescription;
          phoneData.keywords = seo.keywords;
        }

        // Auto-generate review if enabled and fields are empty
        if (options.autoReview && !phoneData.reviewSummary) {
          const review = generateReviewTemplate(phone);
          phoneData.pros = review.pros;
          phoneData.cons = review.cons;
          phoneData.reviewSummary = review.reviewSummary;
          phoneData.reviewVerdict = review.reviewVerdict;
        }

        // Check if phone exists (by slug)
        const existingPhone = await Phone.findOne({ slug: phoneData.slug }).lean();

        if (existingPhone) {
          if (options.skipExisting) {
            result.skipped++;
            continue;
          }

          // Update existing phone
          await Phone.updateOne(
            { slug: phoneData.slug },
            { $set: phoneData, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          );
          const phoneId = (existingPhone as any)._id;

          // Update specs
          if (Object.keys(specsData).length > 0) {
            await PhoneSpecs.updateOne(
              { phoneId },
              { $set: specsData },
              { upsert: true }
            );
          }

          // Update benchmarks
          if (Object.keys(benchData).length > 0) {
            await PhoneBenchmark.updateOne(
              { phoneId },
              { $set: benchData },
              { upsert: true }
            );
          }

          // Update images
          if (images.length > 0) {
            await PhoneImage.deleteMany({ phoneId });
            await PhoneImage.insertMany(
              images.map((url, idx) => ({ phoneId, url, altText: `${phoneData.modelName} image ${idx + 1}`, sortOrder: idx }))
            );
          }

          result.updated++;
        } else {
          // Insert new phone
          const newPhone = await Phone.create(phoneData);
          const phoneId = newPhone._id;

          // Insert specs
          if (Object.keys(specsData).length > 0) {
            await PhoneSpecs.create({ phoneId, ...specsData });
          }

          // Insert benchmarks
          if (Object.keys(benchData).length > 0) {
            await PhoneBenchmark.create({ phoneId, ...benchData });
          }

          // Insert images
          if (images.length > 0) {
            await PhoneImage.insertMany(
              images.map((url, idx) => ({ phoneId, url, altText: `${phoneData.modelName} image ${idx + 1}`, sortOrder: idx }))
            );
          }

          // Ensure text index is built
          try {
            await Phone.collection.createIndex({ modelName: 'text', description: 'text' }, { background: true });
          } catch {
            // Index may already exist
          }

          result.inserted++;
        }

        // Add slug to tracking set
        existingSlugs.add(phoneData.slug);
      } catch (e: any) {
        result.errors.push({
          row,
          model: phone.modelName || `Row ${row}`,
          error: e.message || 'Unknown error during import',
        });
        result.failed++;
      }
    }
  }

  result.duration = Date.now() - startTime;

  // Save import history
  try {
    const historyEntry = await ImportHistoryModel.create({
      filename: options.filename,
      fileType: options.fileType,
      totalRecords: result.total,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      errorRecords: result.errors.slice(0, 500), // Limit stored errors
      status: result.failed === result.total ? 'failed' : result.failed > 0 ? 'partial' : 'completed',
      duration: result.duration,
      batchSize: BATCH_SIZE,
    });
    (result as any).historyId = (historyEntry as any)._id?.toString();
  } catch {
    // History save failure is non-critical
  }

  return result;
}

// ============ ROLLBACK IMPORT ============
export async function rollbackImport(historyId: string): Promise<{ success: boolean; message: string }> {
  await connectDB();

  const history = await ImportHistoryModel.findById(historyId).lean();
  if (!history) {
    return { success: false, message: 'Import history not found' };
  }

  // Find phones created during the import window
  const importTime = new Date((history as any).createdAt);
  const fiveMinAfter = new Date(importTime.getTime() + 5 * 60 * 1000);

  const deleted = await Phone.deleteMany({
    createdAt: { $gte: importTime, $lte: fiveMinAfter },
  });

  // Also clean up related specs, benchmarks, images
  const phoneIds = deleted.map(d => d._id);
  if (phoneIds.length > 0) {
    await Promise.all([
      PhoneSpecs.deleteMany({ phoneId: { $in: phoneIds } }),
      PhoneBenchmark.deleteMany({ phoneId: { $in: phoneIds } }),
      PhoneImage.deleteMany({ phoneId: { $in: phoneIds } }),
    ]);
  }

  // Mark history as rolled back
  await ImportHistoryModel.updateOne(
    { _id: historyId },
    { $set: { status: 'rolled_back' } }
  );

  return {
    success: true,
    message: `Rolled back ${deleted.deletedCount} phones created during import`,
  };
}

// ============ GET IMPORT STATS ============
export async function getImportStats(): Promise<Record<string, number>> {
  await connectDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [importedToday, updatedToday, failedToday, totalPhones, missingImages, missingBrands] = await Promise.all([
    Phone.countDocuments({ createdAt: { $gte: today } }),
    // Approximate updated by looking at recent updates
    Phone.countDocuments({ updatedAt: { $gte: today }, createdAt: { $lt: today } }),
    ImportHistoryModel.countDocuments({ createdAt: { $gte: today }, status: 'failed' }),
    Phone.countDocuments({ active: true, status: 'published' }),
    Phone.countDocuments({ $or: [{ thumbnail: '' }, { thumbnail: null }] }),
    // Brands with no phones
    Brand.countDocuments({
      active: true,
      _id: { $nin: (await Phone.distinct('brandId')).map(id => new Types.ObjectId(id)) },
    }),
  ]);

  const duplicateSlugs = await Phone.aggregate([
    { $group: { _id: '$slug', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicates' },
  ]);

  return {
    importedToday,
    updatedToday,
    failedToday,
    totalPhones,
    missingImages,
    missingBrands,
    duplicatePhones: duplicateSlugs[0]?.duplicates || 0,
  };
}