import { redirect } from 'next/navigation';

export default function OrgIndexPage() {
  redirect('/?portal=organization');
}
