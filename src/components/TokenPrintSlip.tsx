'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getMealSession } from '@/utils/timeUtils';

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
}

interface TokenPrintSlipProps {
  token: TokenPrintData | null;
  onClose?: () => void;
  autoPrint?: boolean;
}

export default function TokenPrintSlip({ token, onClose, autoPrint = false }: TokenPrintSlipProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (token && autoPrint && mounted) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [token, autoPrint, mounted]);

  if (!token) return null;

  const sessionName = token.session || getMealSession();

  const printContent = (
    <div id="token-slip-printable" className="hidden print:block text-black bg-white font-mono p-2">
      <div className="text-center font-bold text-sm uppercase tracking-wide border-b border-black pb-1 mb-2">
        SRI SAIRAM ENGINEERING COLLEGE
        <div className="text-[10px] font-normal tracking-normal text-slate-700">INCUBATION CENTRE - FOOD TOKEN</div>
      </div>

      <div className="text-center my-2 border border-black p-2 rounded">
        <div className="text-[10px] uppercase tracking-wider text-slate-600">TOKEN NUMBER</div>
        <div className="text-xl font-black font-mono tracking-wider">{token.tokenNumber}</div>
        <div className="text-xs font-bold mt-1 bg-black text-white px-2 py-0.5 rounded inline-block uppercase">
          {sessionName}
        </div>
      </div>

      <div className="text-xs space-y-1 my-3 border-b border-black pb-2 font-sans">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">STUDENT:</span>
          <span className="font-bold">{token.studentName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">ID NO:</span>
          <span className="font-bold font-mono">{token.studentId}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">PROJECT:</span>
          <span className="font-bold">{token.project}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">DATE & TIME:</span>
          <span>{token.date} · {token.time}</span>
        </div>
      </div>

      <div className="text-[9px] text-center text-slate-600 leading-tight">
        <div>Valid for 1 meal ({sessionName}) only</div>
        <div>Non-transferable · Mess Counter Token</div>
      </div>
    </div>
  );

  return (
    <>
      {mounted && typeof document !== 'undefined' && createPortal(printContent, document.body)}
    </>
  );
}
