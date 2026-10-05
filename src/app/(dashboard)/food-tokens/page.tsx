'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FoodTokensRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/daily-food-list?tab=logs');
  }, [router]);

  return (
    <div className="py-20 text-center">
      <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
      <p className="text-sm text-slate-500">Redirecting to Datewise Logs &amp; Token Audit...</p>
    </div>
  );
}
