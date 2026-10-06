'use client';

import { formatISTDateDMY, formatISTTime, getMealSession } from '@/utils/timeUtils';
import { getPrinterSettings } from '@/utils/thermalPrinterUtils';
import TokenPrintSlip, { type TokenPrintData } from './TokenPrintSlip';

export interface TokenSlipModalProps {
  token: TokenPrintData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenSlipModal({ token, isOpen, onClose }: TokenSlipModalProps) {
  const settings = getPrinterSettings();

  if (!isOpen || !token) return null;

  const sessionName = token.session || getMealSession();
  const timeStr = token.time || '12:00 PM';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Hidden portal for browser print execution */}
      <TokenPrintSlip token={token} />

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-base">🧾</span>
            <h2 className="text-sm font-bold text-slate-800">Thermal Token Receipt</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Digital Slip Receipt Body */}
        <div className="p-5 overflow-y-auto bg-slate-100/70 flex justify-center">
          <div className="w-full max-w-70 bg-white border border-slate-300 rounded-lg p-4 shadow-sm text-slate-900 font-mono text-xs leading-tight">
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-2.5 mb-2.5">
              <div className="font-bold text-[11px] leading-tight text-slate-900">
                {settings.headerTitle}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">FOOD TOKEN SYSTEM · MESS COUNTER</div>
              <div className="font-bold text-xs mt-1 text-indigo-900">FOOD TOKEN SLIP</div>
            </div>

            {/* Token Badge */}
            <div className="flex flex-col items-center justify-center my-2.5 py-2 bg-slate-50 border border-slate-200 rounded">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">
                TOKEN NUMBER
              </div>
              <div className="text-xl font-black font-mono tracking-widest text-indigo-950">
                {token.tokenNumber}
              </div>
              <div className="text-[10px] font-bold mt-1 bg-indigo-900 text-white px-2 py-0.5 rounded uppercase">
                {sessionName}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1.5 border-t border-b border-dashed border-slate-300 py-2.5 my-2 text-[11px]">
              <div className="flex justify-between gap-1">
                <span className="text-slate-500">
                  {token.category === 'Intern' || token.studentId.startsWith('INT-') ? 'INTERN:' : 'STUDENT:'}
                </span>
                <span className="font-bold text-right truncate">{token.studentName}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-slate-500">ID NO:</span>
                <span className="font-bold font-mono text-right">
                  {token.category === 'Intern' || token.studentId.startsWith('INT-')
                    ? `${token.studentId} (Startup Intern)`
                    : token.studentId}
                </span>
              </div>
              {token.category === 'Intern' || token.studentId.startsWith('INT-') ? (
                <div className="flex justify-between gap-1">
                  <span className="text-slate-500">STARTUP:</span>
                  <span className="font-bold text-right truncate">{token.startupName || token.department || 'Startup Intern'}</span>
                </div>
              ) : (
                token.department && (
                  <div className="flex justify-between gap-1">
                    <span className="text-slate-500">DEPT:</span>
                    <span className="font-bold text-right">{token.department}</span>
                  </div>
                )
              )}
              <div className="flex justify-between gap-1">
                <span className="text-slate-500">TIME:</span>
                <span className="text-right">
                  {formatISTDateDMY(token.date)} · {formatISTTime(timeStr)}
                </span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="text-center text-[8px] text-slate-500 pt-1 border-t border-dashed border-slate-200">
              <div>Valid for 1 meal ({sessionName}) only</div>
              <div>Non-transferable · Mess Counter Token</div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-200 bg-white flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>🖨️</span>
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
