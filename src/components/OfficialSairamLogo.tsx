'use client';

export default function OfficialSairamLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-center max-w-[280px]">
        {/* Official Sairam Institutions Logo (Sai Baba Portrait + Sairam + INSTITUTIONS Banner) */}
        <img
          src="/sairam-engineering-college-logo.png"
          alt="Sairam Institutions Logo"
          className="w-full h-auto max-h-44 object-contain rounded-xl"
        />
      </div>
    </div>
  );
}

