import { redirect } from 'next/navigation';

export default function LegacyCollectorRoute() {
  redirect('/admin/collector/jobs');
}
