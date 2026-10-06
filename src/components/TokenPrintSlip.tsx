'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getMealSession, formatISTDateDMY, formatISTTime } from '@/utils/timeUtils';
import { getPrinterSettings, type PrinterSettings } from '@/utils/thermalPrinterUtils';

export interface TokenPrintData {
  tokenNumber: string;
  studentId: string;
  studentName: string;
  department?: string;
  year?: number;
  project: string;
  date: string;
  time: string;
  session?: string;
  isTestPrint?: boolean;
  category?: 'Student' | 'Intern';
  startupName?: string;
}

interface TokenPrintSlipProps {
  token: TokenPrintData | null;
  onClose?: () => void;
  autoPrint?: boolean;
}

export default function TokenPrintSlip({ token, onClose, autoPrint = false }: TokenPrintSlipProps) {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<PrinterSettings>(() => getPrinterSettings());

  useEffect(() => {
    setMounted(true);
    setSettings(getPrinterSettings());

    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<PrinterSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener('thermal-printer-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('thermal-printer-settings-changed', handleSettingsChange);
    };
  }, []);

  // Handle auto-print once mounted
  useEffect(() => {
    const shouldPrint = autoPrint || (settings.autoPrint && Boolean(token));
    if (token && shouldPrint && mounted) {
      const timer = setTimeout(() => {
        window.print();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [token, autoPrint, settings.autoPrint, mounted]);

  if (!token) return null;

  const sessionName = token.session || getMealSession();
  const is58mm = settings.paperWidth === '58mm';

  const printContent = (
    <div
      id="token-slip-printable"
      className={`hidden print:block text-black bg-white font-mono p-1 ${
        is58mm ? 'slip-58mm max-w-[58mm] text-[10px]' : 'slip-80mm max-w-[80mm] text-[11px]'
      }`}
    >
      {/* Test Print Header Banner */}
      {token.isTestPrint && (
        <div className="border-2 border-black border-dashed p-1 mb-2 text-center text-[10px] font-bold">
          <div>*** DIAGNOSTIC TEST SLIP ***</div>
          <div className="text-[9px] font-normal">HARDWARE CALIBRATION & ALIGNMENT</div>
          <div className="mt-1 tracking-widest text-[8px]">████████████████████████</div>
        </div>
      )}

      {/* Institution & Counter Header */}
      <div className="text-center font-bold uppercase tracking-wide border-b-2 border-black pb-1.5 mb-2">
        <div className={is58mm ? 'text-[11px] leading-tight' : 'text-xs leading-tight'}>
          {settings.headerTitle}
        </div>
        <div className="text-[9px] font-semibold tracking-normal text-slate-800 mt-0.5">
          FOOD TOKEN SYSTEM · MESS COUNTER
        </div>
      </div>

      {/* Main Token Serial Number Box */}
      <div className="text-center my-2 border-2 border-black p-2 rounded">
        <div className="text-[9px] uppercase tracking-wider text-slate-700 font-bold">TOKEN NUMBER</div>
        <div className={`font-black font-mono tracking-widest my-0.5 ${is58mm ? 'text-lg' : 'text-xl'}`}>
          {token.tokenNumber}
        </div>
        <div className="text-[10px] font-extrabold bg-black text-white px-2.5 py-0.5 rounded inline-block uppercase tracking-wider">
          {sessionName}
        </div>
      </div>

      {/* Student & Project Details Table */}
      <div className="space-y-1 my-2 border-b-2 border-black pb-2 font-mono leading-tight">
        <div className="flex justify-between items-baseline gap-1">
          <span className="font-semibold text-slate-800">
            {token.category === 'Intern' || token.studentId.startsWith('INT-') ? 'INTERN:' : 'STUDENT:'}
          </span>
          <span className="font-bold text-right truncate">{token.studentName}</span>
        </div>
        <div className="flex justify-between items-baseline gap-1">
          <span className="font-semibold text-slate-800">ID NO:</span>
          <span className="font-bold text-right">
            {token.category === 'Intern' || token.studentId.startsWith('INT-')
              ? `${token.studentId} (Startup Intern)`
              : token.studentId}
          </span>
        </div>
        {token.category === 'Intern' || token.studentId.startsWith('INT-') ? (
          <div className="flex justify-between items-baseline gap-1">
            <span className="font-semibold text-slate-800">STARTUP:</span>
            <span className="font-bold text-right truncate">{token.startupName || token.department || 'Startup Intern'}</span>
          </div>
        ) : (
          token.department && (
            <div className="flex justify-between items-baseline gap-1">
              <span className="font-semibold text-slate-800">DEPT:</span>
              <span className="font-bold text-right">{token.department}</span>
            </div>
          )
        )}
        <div className="flex justify-between items-baseline gap-1">
          <span className="font-semibold text-slate-800">TIME:</span>
          <span className="text-right">
            {formatISTDateDMY(token.date)} · {formatISTTime(token.time)}
          </span>
        </div>
      </div>

      {/* Security & Validity Disclaimer */}
      <div className="text-[8px] text-center text-slate-700 leading-tight pt-1 border-t border-dashed border-black">
        <div>{settings.footerDisclaimer}</div>
        <div className="mt-0.5">Printed via Incubation Hardware Terminal</div>
      </div>

      {/* Feed & Cut Margin Buffer (Ensures physical cutter doesn't clip text) */}
      <div className="pt-8 text-center text-[7px] text-slate-400 select-none">
        - - - - - - - - - - - - - - - - - -
      </div>
    </div>
  );

  return (
    <>
      {mounted && typeof document !== 'undefined' && createPortal(printContent, document.body)}
    </>
  );
}
