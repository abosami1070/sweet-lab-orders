import { getCurrentProfile } from '@/lib/auth';
import { RoleHome } from '@/components/role-home';
import { SetupChecklist } from '@/components/setup-checklist';

export default async function AdminHome() {
  const profile = (await getCurrentProfile())!; // الـ layout تحقق من الدور مسبقاً
  return (
    <>
      <RoleHome profile={profile} />
      <SetupChecklist profile={profile} />
    </>
  );
}
