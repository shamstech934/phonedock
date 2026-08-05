import type { PipelineStage } from 'mongoose';

export const PTA_APPROVED_PATTERN = /approved/i;
export const NON_PTA_PATTERN = /non.?pta|not.?approved|unapproved/i;
export const MONITORING_PHONE_FILTER = { deletedAt: null } as const;

export interface MonitoringPhoneMetrics {
  totalPhones: number;
  publishedPhones: number;
  missingSpecs: number;
  incompleteSpecs: number;
  staleSpecs: number;
  missingImages: number;
  unverifiedImages: number;
  missingPrices: number;
  discountedPhones: number;
  upcomingPhones: number;
  discontinuedPhones: number;
  ptaApprovedPhones: number;
  nonPtaPhones: number;
}

export const EMPTY_MONITORING_PHONE_METRICS: MonitoringPhoneMetrics = {
  totalPhones: 0,
  publishedPhones: 0,
  missingSpecs: 0,
  incompleteSpecs: 0,
  staleSpecs: 0,
  missingImages: 0,
  unverifiedImages: 0,
  missingPrices: 0,
  discountedPhones: 0,
  upcomingPhones: 0,
  discontinuedPhones: 0,
  ptaApprovedPhones: 0,
  nonPtaPhones: 0,
};

function asNumber(path: string) {
  return {
    $convert: {
      input: { $ifNull: [path, 0] },
      to: 'double',
      onError: 0,
      onNull: 0,
    },
  };
}

function asString(path: string) {
  return {
    $convert: {
      input: { $ifNull: [path, ''] },
      to: 'string',
      onError: '',
      onNull: '',
    },
  };
}

function nonEmptyString(path: string) {
  return { $ne: [{ $trim: { input: asString(path) } }, ''] };
}

function positiveFiniteNumber(path: string) {
  const value = asNumber(path);
  return {
    $and: [
      { $gt: [value, 0] },
      { $lte: [{ $abs: value }, Number.MAX_VALUE] },
      { $eq: [value, value] },
    ],
  };
}

/**
 * Calculates all Phone/PhoneSpecs/PhoneImage monitoring metrics in MongoDB.
 *
 * The old implementation loaded every matching phone into the Vercel runtime,
 * built maps, and scanned the full array repeatedly. This pipeline keeps the
 * exact `{ deletedAt: null }` scope and returns one small aggregate document.
 */
export function buildMonitoringPhoneMetricsPipeline(options: {
  phoneSpecsCollection: string;
  phoneImagesCollection: string;
  staleSpecsCutoff: Date;
}): PipelineStage[] {
  const price = asNumber('$pricePKR');
  const originalPrice = asNumber('$originalPricePKR');
  const ptaStatus = asString('$ptaStatus');
  const hasCompleteCoreSpecs = {
    $and: [
      nonEmptyString('$monitoringSpec.chipset'),
      nonEmptyString('$monitoringSpec.ram'),
      nonEmptyString('$monitoringSpec.storage'),
      nonEmptyString('$monitoringSpec.display'),
      nonEmptyString('$monitoringSpec.battery'),
      nonEmptyString('$monitoringSpec.mainCamera'),
    ],
  };

  return [
    { $match: MONITORING_PHONE_FILTER },
    {
      $lookup: {
        from: options.phoneSpecsCollection,
        localField: '_id',
        foreignField: 'phoneId',
        pipeline: [{
          $project: {
            _id: 0,
            updatedAt: 1,
            chipset: 1,
            ram: 1,
            storage: 1,
            display: 1,
            battery: 1,
            mainCamera: 1,
          },
        }],
        as: 'monitoringSpecs',
      },
    },
    {
      $lookup: {
        from: options.phoneImagesCollection,
        localField: '_id',
        foreignField: 'phoneId',
        pipeline: [
          { $match: { status: { $ne: 'rejected' } } },
          { $project: { _id: 0, verified: 1 } },
        ],
        as: 'monitoringImages',
      },
    },
    {
      $set: {
        monitoringSpec: { $arrayElemAt: ['$monitoringSpecs', 0] },
        monitoringSpecCount: { $size: '$monitoringSpecs' },
        monitoringImageCount: { $size: '$monitoringImages' },
        monitoringHasVerifiedImage: {
          $anyElementTrue: [{
            $map: {
              input: '$monitoringImages',
              as: 'image',
              in: { $eq: ['$$image.verified', true] },
            },
          }],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalPhones: { $sum: 1 },
        publishedPhones: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        missingSpecs: { $sum: { $cond: [{ $eq: ['$monitoringSpecCount', 0] }, 1, 0] } },
        incompleteSpecs: {
          $sum: {
            $cond: [{ $and: [{ $gt: ['$monitoringSpecCount', 0] }, { $not: [hasCompleteCoreSpecs] }] }, 1, 0],
          },
        },
        staleSpecs: {
          $sum: {
            $cond: [{
              $and: [
                { $gt: ['$monitoringSpecCount', 0] },
                { $ne: ['$monitoringSpec.updatedAt', null] },
                { $lt: ['$monitoringSpec.updatedAt', options.staleSpecsCutoff] },
              ],
            }, 1, 0],
          },
        },
        missingImages: {
          $sum: {
            $cond: [{ $and: [{ $not: [nonEmptyString('$thumbnail')] }, { $eq: ['$monitoringImageCount', 0] }] }, 1, 0],
          },
        },
        unverifiedImages: {
          $sum: {
            $cond: [{ $and: [{ $gt: ['$monitoringImageCount', 0] }, { $not: ['$monitoringHasVerifiedImage'] }] }, 1, 0],
          },
        },
        missingPrices: { $sum: { $cond: [{ $not: [positiveFiniteNumber('$pricePKR')] }, 1, 0] } },
        discountedPhones: {
          $sum: { $cond: [{ $and: [positiveFiniteNumber('$pricePKR'), { $gt: [originalPrice, price] }] }, 1, 0] },
        },
        upcomingPhones: {
          $sum: {
            $cond: [{
              $or: [
                { $eq: ['$upcoming', true] },
                { $in: [{ $ifNull: ['$availabilityStatus', ''] }, ['rumored', 'announced', 'coming_soon']] },
              ],
            }, 1, 0],
          },
        },
        discontinuedPhones: {
          $sum: {
            $cond: [{
              $or: [
                { $eq: ['$availabilityStatus', 'discontinued'] },
                nonEmptyString('$discontinuedAt'),
              ],
            }, 1, 0],
          },
        },
        ptaApprovedPhones: {
          $sum: {
            $cond: [{
              $or: [
                { $eq: ['$ptaApproved', true] },
                { $regexMatch: { input: ptaStatus, regex: PTA_APPROVED_PATTERN } },
              ],
            }, 1, 0],
          },
        },
        nonPtaPhones: {
          $sum: {
            $cond: [{ $regexMatch: { input: ptaStatus, regex: NON_PTA_PATTERN } }, 1, 0],
          },
        },
      },
    },
    { $project: { _id: 0 } },
  ];
}
