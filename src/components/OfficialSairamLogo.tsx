'use client';

export default function OfficialSairamLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-center w-28 h-28">
        {/* Official Sri Sairam Techno Incubator Foundation Logo */}
        <img
          src="/techno-incubator-logo.png"
          alt="Sri Sairam Techno Incubator Foundation Logo"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}



