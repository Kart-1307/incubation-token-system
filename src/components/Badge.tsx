interface BadgeProps {
  status: string;
}

const styles: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-500',
  Eligible: 'bg-emerald-100 text-emerald-700',
  'Not Eligible': 'bg-red-100 text-red-700',
  Draft: 'bg-amber-100 text-amber-700',
  Finalized: 'bg-blue-100 text-blue-700',
  Generated: 'bg-sky-100 text-sky-700',
  Printed: 'bg-indigo-100 text-indigo-700',
  Used: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-red-100 text-red-700',
  Expired: 'bg-slate-100 text-slate-500',
  Completed: 'bg-slate-100 text-slate-600',
};

export default function Badge({ status }: BadgeProps) {
  const cls = styles[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
