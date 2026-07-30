export type Brand = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  phoneCount?: number;
};

export type Phone = {
  id: string;
  slug: string;
  modelName: string;
  brand?: Brand;
  thumbnail?: string;
  heroImage?: string;
  pricePKR?: number;
  originalPricePKR?: number;
  overallRating?: number;
  ptaApproved?: boolean;
  releaseDate?: string;
  specs?: Record<string, unknown>;
  description?: string;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
