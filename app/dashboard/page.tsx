'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const redirect = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'host') {
        router.replace('/dashboard/host');
      } else {
        router.replace('/dashboard/seller');
      }
    };
    redirect();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-500">リダイレクト中...</p>
    </div>
  );
}
