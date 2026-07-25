import { redirect } from 'next/navigation';

// The legacy import UI has been superseded by the more complete import-v2 system
// (batch processing, retry, cancel, rollback, error CSV, progress, quality scan — see
// AUDIT_REPORT_V19.md). Redirecting here instead of deleting the route keeps old
// bookmarks/links working while ensuring only one import system is actually used.
export default function LegacyImportRedirect() {
  redirect('/admin/import-v2');
}
