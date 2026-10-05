'use client';

import { useState, useEffect } from 'react';
import {
  getPrinterSettings,
  savePrinterSettings,
  getDiagnosticTestTokenData,
  type PrinterSettings,
  type PaperWidth,
} from '@/utils/thermalPrinterUtils';
import type { TokenPrintData } from './TokenPrintSlip';

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerTestPrint: (testToken: TokenPrintData) => void;
}

export default function PrinterSettingsModal({
  isOpen,
  onClose,
  onTriggerTestPrint,
}: PrinterSettingsModalProps) {
  const [settings, setSettings] = useState<PrinterSettings>(() => getPrinterSettings());
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getPrinterSettings());
      setSavedNotice(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (updated: Partial<PrinterSettings>) => {
    const next = savePrinterSettings(updated);
    setSettings(next);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleTestPrintClick = () => {
    const testData = getDiagnosticTestTokenData();
    onTriggerTestPrint(testData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg">
              🖨️
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thermal Printer Configuration</h2>
              <p className="text-xs text-slate-500">Hardware settings & diagnostic testing for POS receipt printers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {savedNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Printer settings saved successfully!</span>
            </div>
          )}

          {/* Paper Width Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Thermal Paper Roll Width
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSave({ paperWidth: '80mm' })}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.paperWidth === '80mm'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">80 mm Standard POS</span>
                  {settings.paperWidth === '80mm' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-normal">
                  Standard 3-inch wide receipt roll (POS-80, Epson, TVS, Xprinter, Helett).
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSave({ paperWidth: '58mm' })}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.paperWidth === '58mm'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">58 mm Compact POS</span>
                  {settings.paperWidth === '58mm' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-normal">
                  2-inch mini receipt roll (POS-58, portable Bluetooth/USB thermal units).
                </div>
              </button>
            </div>
          </div>

          {/* Automation & Behavior Toggles */}
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Printing Automation
            </label>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoPrint}
                  onChange={(e) => handleSave({ autoPrint: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    Auto-Print Upon Barcode Scan / Issuance
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Immediately ejects thermal receipt ticket upon student verification without requiring an extra manual click.
                  </div>
                </div>
              </label>

              <div className="border-t border-slate-200" />

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.includeQrCode}
                  onChange={(e) => handleSave({ includeQrCode: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    Include Scannable Verification QR Code
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Embeds high-density 203 DPI QR code on physical slip for counter staff to scan and verify.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Silent Zero-Click Kiosk Mode Helper */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <span>⚡</span>
              <span>Pro Tip: Zero-Click Silent Printing</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              To bypass the browser print dialog completely on Windows, set your thermal printer as default in Windows and launch Chrome in kiosk mode:
            </p>
            <div className="bg-amber-100/70 text-slate-800 font-mono text-[11px] p-2 rounded border border-amber-300/60 select-all overflow-x-auto">
              chrome.exe --kiosk-printing {typeof window !== 'undefined' ? `${window.location.origin}/scan-token` : 'http://localhost:3000/scan-token'}
            </div>
          </div>

          {/* Diagnostic Hardware Test Action */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="font-bold text-xs text-slate-900">Physical Machine Verification</div>
                <div className="text-xs text-slate-500">Prints alignment markers & thermal density test block</div>
              </div>
              <button
                type="button"
                onClick={handleTestPrintClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
              >
                <span>🖨️</span>
                <span>Print Diagnostic Test Slip</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
