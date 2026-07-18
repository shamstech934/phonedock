// ============ ROLE-BASED PERMISSION SYSTEM ============

export type AdminRole = 'superadmin' | 'admin' | 'editor' | 'moderator' | 'reviewer' | 'viewer';

export type Permission =
  // Dashboard
  | 'dashboard:read'
  // Phones
  | 'phones:read' | 'phones:create' | 'phones:edit' | 'phones:delete' | 'phones:publish' | 'phones:seed'
  // Brands
  | 'brands:read' | 'brands:create' | 'brands:edit' | 'brands:delete'
  // News
  | 'news:read' | 'news:create' | 'news:edit' | 'news:delete' | 'news:publish'
  // Sponsors
  | 'sponsors:read' | 'sponsors:manage'
  // Imports
  | 'imports:read' | 'imports:execute'
  // Collectors
  | 'collectors:read' | 'collectors:manage'
  // Users
  | 'users:read' | 'users:manage'
  // Settings
  | 'settings:read' | 'settings:manage'
  // Activity
  | 'activity:read'
  // Media
  | 'media:upload' | 'media:delete'
  // Trash
  | 'trash:read' | 'trash:restore' | 'trash:delete'
  // Videos
  | 'videos:read' | 'videos:edit' | 'videos:manage'
  // Price Tracker
  | 'prices:read' | 'prices:edit'
  // Data Quality
  | 'data-quality:read' | 'data-quality:scan' | 'data-quality:fix' | 'data-quality:delete';

// ============ PERMISSION MAPS ============

const ALL_PERMISSIONS: Permission[] = [
  'dashboard:read',
  'phones:read', 'phones:create', 'phones:edit', 'phones:delete', 'phones:publish', 'phones:seed',
  'brands:read', 'brands:create', 'brands:edit', 'brands:delete',
  'news:read', 'news:create', 'news:edit', 'news:delete', 'news:publish',
  'sponsors:read', 'sponsors:manage',
  'imports:read', 'imports:execute',
  'collectors:read', 'collectors:manage',
  'users:read', 'users:manage',
  'settings:read', 'settings:manage',
  'activity:read',
  'media:upload', 'media:delete',
  'trash:read', 'trash:restore', 'trash:delete',
  'videos:read', 'videos:edit', 'videos:manage',
  'prices:read', 'prices:edit',
  'data-quality:read', 'data-quality:scan', 'data-quality:fix', 'data-quality:delete',
];

const rolePermissions: Record<AdminRole, Set<Permission>> = {
  superadmin: new Set(ALL_PERMISSIONS),
  admin: new Set<Permission>([
    'dashboard:read',
    'phones:read', 'phones:create', 'phones:edit', 'phones:delete', 'phones:publish', 'phones:seed',
    'brands:read', 'brands:create', 'brands:edit', 'brands:delete',
    'news:read', 'news:create', 'news:edit', 'news:delete', 'news:publish',
    'sponsors:read', 'sponsors:manage',
    'imports:read', 'imports:execute',
    'collectors:read', 'collectors:manage',
    'users:read',
    'settings:read',
    'activity:read',
    'media:upload', 'media:delete',
    'trash:read', 'trash:restore', 'trash:delete',
    'videos:read', 'videos:edit', 'videos:manage',
    'prices:read', 'prices:edit',
    'data-quality:read', 'data-quality:scan', 'data-quality:fix', 'data-quality:delete',
  ]),
  editor: new Set<Permission>([
    'dashboard:read',
    'phones:read', 'phones:create', 'phones:edit',
    'brands:read',
    'news:read', 'news:create', 'news:edit',
    'activity:read',
    'media:upload',
    'prices:read',
    'data-quality:read',
  ]),
  reviewer: new Set<Permission>([
    'phones:read',
    'brands:read',
    'news:read',
    'activity:read',
    'collectors:read',
    'prices:read',
  ]),
  moderator: new Set<Permission>([
    'dashboard:read',
    'phones:read',
    'brands:read',
    'news:read',
    'news:create',
    'news:edit',
    'activity:read',
    'videos:read',
  ]),
  viewer: new Set<Permission>([
    'dashboard:read',
    'phones:read',
    'brands:read',
    'news:read',
    'activity:read',
    'videos:read',
  ]),
};

// ============ PUBLIC API ============

/** Check if a given role has a specific permission */
export function hasPermission(role: AdminRole, permission: Permission, customPermissions?: string[]): boolean {
  if (role === 'superadmin') return true;
  // If custom permissions are provided, use them as an override
  if (customPermissions && customPermissions.length > 0) {
    return customPermissions.includes(permission);
  }
  return rolePermissions[role]?.has(permission) ?? false;
}

/** Get all permissions for a given role */
export function getPermissions(role: AdminRole): Permission[] {
  return Array.from(rolePermissions[role] ?? []);
}

/** Get all defined permissions */
export function getAllPermissions(): Permission[] {
  return [...ALL_PERMISSIONS];
}

/** Get all defined roles */
export function getAllRoles(): AdminRole[] {
  return ['superadmin', 'admin', 'editor', 'moderator', 'reviewer', 'viewer'];
}