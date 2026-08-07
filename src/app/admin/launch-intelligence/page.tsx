import { redirect } from 'next/navigation';

export default function LegacyLaunchIntelligencePage() {
  redirect('/admin/launch-center?view=intelligence');
}
