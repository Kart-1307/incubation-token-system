'use client';

export default function SairamLogo({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div
        className="w-10 h-10 mx-auto rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-slate-700/60"
        title="Sri Sairam Techno Incubator Foundation"
      >
        <img
          src="/techno-incubator-logo.png"
          alt="SSTIF"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-0.5 select-none">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm border border-slate-700/50">
        <img
          src="/techno-incubator-logo.png"
          alt="SSTIF Logo"
          className="w-full h-full object-contain"
        />
      </div>
      {/* Foundation Clean Title Header */}
      <div className="min-w-0 flex flex-col justify-center">
        <div className="font-bold text-xs text-white leading-snug">
          Sri Sairam Techno Incubator Foundation
        </div>
        <div className="text-[10px] text-indigo-300 font-medium leading-tight mt-0.5">
          Food Token Management
        </div>
      </div>
    </div>
  );
}
