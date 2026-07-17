# Users Admin — Enterprise Improvements

## Files Modified

| File | Change |
|------|--------|
| `src/lib/models/Other.ts` | Extended Admin schema with 2FA, custom permissions, suspension, invitation, phone, requirePasswordChange fields. Added new role enums: `moderator`, `viewer`. Added indexes on `active` and `customPermissions`. |
| `src/lib/permissions.ts` | Added `moderator` and `viewer` roles with their permission sets. Updated `AdminRole` type, `getAllRoles()`, and `hasPermission()` to support custom permission overrides. |
| `src/app/api/[[...path]]/handlers/admin-crud.ts` | Added 8 new API endpoints (see below). Enhanced existing users list endpoint with pagination, search, filters, sorting. Added crypto import and AdminSession import. |
| `src/app/admin/users/page.tsx` | Complete rewrite from 208 lines to ~1050 lines. Enterprise-grade user management interface. |

## New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users/stats` | GET | Dashboard statistics (total, superadmins, active, disabled, suspended, failed logins, online, sessions, 2FA count) |
| `/api/admin/users/:id` | GET | User detail with active sessions and recent activity log |
| `/api/admin/users/:id` | PUT | Update user (name, phone, role, active, suspended, 2FA, custom permissions, force password reset, reset failed attempts) |
| `/api/admin/users/:id` | DELETE | Delete user with protection (cannot delete self, cannot delete last superadmin, revokes all sessions) |
| `/api/admin/users/bulk` | POST | Bulk actions: activate, deactivate, suspend, assign_role, force_password_reset, delete |
| `/api/admin/users/invite` | POST | Send invitation by email with configurable expiry. Creates account in pending state. |
| `/api/admin/users/export` | GET | Export all users as CSV file |

## Security Improvements

- **Delete Protection**: Cannot delete own account. Cannot delete the last superadmin. Bulk delete checks superadmin count.
- **Session Revocation**: Deleting, suspending, or force-resetting a user automatically revokes all their sessions.
- **Role Protection**: Only superadmins can create/assign superadmin role. Non-superadmins cannot manage users.
- **Self-Edit Restriction**: Admins can only edit their own name/phone — not role, status, or security settings.
- **Bulk Self-Protection**: Cannot bulk-deactivate, bulk-suspend, or bulk-delete your own account.
- **Audit Logging**: All CRUD operations, role changes, permission changes, and security actions are logged to ActivityLog.

## Permission Improvements

- **New Roles**: Added `moderator` (content management focus) and `viewer` (read-only access) roles.
- **Custom Permissions**: Admin users can have `customPermissions` array that overrides their role-based permissions.
- **Granular Module Control**: Each module (Phones, Brands, News, Videos, etc.) supports 6 action types: read, create, edit, delete, approve, export.
- **UI Permission Editor**: Visual grid in user detail drawer to toggle individual permissions per module.

## Session Management

- **Active Sessions Display**: User detail drawer shows all active sessions with browser, OS, device, IP, and last active time.
- **Revoke Single Session**: Admins can revoke individual sessions for any user.
- **Revoke All Sessions**: One-click to revoke all other sessions for a user.
- **Online Count**: Stats dashboard shows currently online admins (sessions active in last 30 minutes).
- **Total Sessions**: Stats show total active session count across all admins.

## Database Changes

### Admin Schema Additions (all optional, backward compatible)
- `phone` (String) — Admin phone number
- `twoFactorEnabled` (Boolean, default: false)
- `twoFactorSecret` (String, select: false) — TOTP secret (hidden by default)
- `twoFactorRecoveryCodes` ([String], select: false) — Recovery codes (hidden by default)
- `customPermissions` ([String], default: []) — Permission override array
- `suspended` (Boolean, default: false)
- `suspendedReason` (String, default: '')
- `suspendedUntil` (Date) — Optional suspension end time
- `requirePasswordChange` (Boolean, default: false) — Force password change on next login
- `invitedBy` (ObjectId ref: Admin) — Who invited this user
- `invitedAt` (Date) — When invitation was sent
- `invitationTokenHash` (String, select: false) — Hashed invitation token
- `invitationExpires` (Date, select: false) — Invitation expiry
- `invitationAccepted` (Boolean, default: false)

### Role Enum Extended
- From: `['superadmin', 'admin', 'editor', 'reviewer']`
- To: `['superadmin', 'admin', 'editor', 'moderator', 'reviewer', 'viewer']`

### New Indexes
- `{ active: 1 }` — For status filtering
- `{ customPermissions: 1 }` — For permission queries

## Performance Improvements

- **Server-side pagination**: All user queries use `skip/limit` with configurable page size (1-100, default 20).
- **Optimized field selection**: Password, secret tokens, and recovery codes are excluded from list queries using `select()`.
- **Parallel queries**: Stats endpoint uses `Promise.all()` for concurrent count queries.
- **Debounced search**: Client-side 350ms debounce on search input to reduce API calls.
- **Select-only queries**: List queries only select needed fields, reducing data transfer.
- **TTL indexes**: AdminSession records auto-expire, keeping the sessions collection clean.

## Features Implemented

- ✅ 8 statistics cards (Total, Super Admins, Active, Disabled, Suspended, Online, Failed Logins, Sessions)
- ✅ Server-side search by name, email, role
- ✅ Role filter (Super Admin, Admin, Editor, Moderator, Reviewer, Viewer)
- ✅ Status filter (Active, Inactive, Suspended)
- ✅ 2FA filter (Enabled, Disabled)
- ✅ Last Login filter (Today, This Week, This Month)
- ✅ 6 sort options (Newest, Oldest, Recently Active, Alphabetical, Role, Status)
- ✅ User table with avatar, name, email, role badge, status badge, 2FA badge, last login, created date
- ✅ User detail drawer with 5 tabs (Profile, Permissions, Sessions, Activity, Security)
- ✅ Role management with 6 roles
- ✅ Granular permissions editor (14 modules × 6 actions)
- ✅ Session management with browser/OS/device detection, IP display, revoke actions
- ✅ Security actions (Enable/Disable 2FA, Force Password Reset, Suspend/Unsuspend, Reset Failed Attempts)
- ✅ Invite system with email and configurable expiry
- ✅ Bulk actions (Activate, Deactivate, Assign Role, Force Reset, Delete)
- ✅ Delete protection (self, last superadmin)
- ✅ CSV export
- ✅ Toast notifications
- ✅ Keyboard navigation and ARIA labels
- ✅ Responsive design (desktop, tablet, mobile)
- ✅ Empty states
- ✅ Error handling
- ✅ Audit logging for all actions

## Remaining Recommendations

1. **2FA TOTP Implementation**: The model fields exist but actual TOTP generation/validation (using `otplib` or similar) is not yet implemented. The UI shows enable/disable toggles that store the state in the database.
2. **Recovery Codes Generation**: When 2FA is enabled, generate and display recovery codes to the user (one-time display).
3. **Accept Invitation Page**: The invitation system creates tokens and sends emails, but the `/admin/accept-invite` page doesn't exist yet to handle the acceptance flow.
4. **Custom Permissions UI for New Roles**: Currently, custom permissions can only be edited via the user detail drawer. Consider a role management page for creating/editing custom role templates.
5. **User Activity Timeline**: The activity tab shows basic entries. Consider filtering by action type and date range.
6. **IP Geolocation**: Session IPs could be enriched with country/city data using a GeoIP database.
7. **Password Policy Configuration**: Make minimum length and complexity requirements configurable via Settings.
8. **Rate Limit Configuration**: Per-user and per-IP rate limits for the users API endpoints.