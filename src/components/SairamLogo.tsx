'use client';

export default function SairamLogo({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div
        className="w-10 h-10 mx-auto rounded-lg bg-gradient-to-br from-indigo-700 to-amber-500 flex items-center justify-center text-white font-black text-xs shadow-md border border-amber-400/40"
        title="Sri Sairam Engineering College - Incubation Centre"
      >
        SEC
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-0.5 select-none">
      {/* College & Center Clean Title Header */}
      <div className="min-w-0">
        <div className="text-[11px] font-black tracking-wider text-amber-300 uppercase leading-tight truncate">
          SRI SAIRAM ENGINEERING COLLEGE
        </div>
        <div className="font-bold text-sm text-white leading-tight truncate mt-0.5">Incubation Centre</div>
        <div className="text-[11px] text-indigo-200/80 leading-tight truncate font-medium">Food Token Management</div>
      </div>
    </div>
  );
}
