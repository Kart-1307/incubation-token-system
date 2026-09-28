'use client';

export default function OfficialSairamLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="font-serif italic text-sm font-bold text-sky-600">Sri</span>
        <span className="font-black text-2xl tracking-tight text-[#003366] uppercase">
          SAIRAM
        </span>
      </div>
      <div className="font-bold text-xs tracking-widest text-[#003366] uppercase">
        ENGINEERING COLLEGE
      </div>
      <div className="text-[11px] font-semibold text-slate-500 tracking-wide mt-0.5">
        Incubation Centre · Food Token System
      </div>
    </div>
  );
}
