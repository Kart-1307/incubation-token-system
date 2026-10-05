import QRCode from 'qrcode';
import { getTodayISTDateString, formatISTTime, getMealSession } from './timeUtils';

export type PaperWidth = '80mm' | '58mm';

export interface PrinterSettings {
  paperWidth: PaperWidth;
  autoPrint: boolean;
  includeQrCode: boolean;
  headerTitle: string;
  footerDisclaimer: string;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  paperWidth: '80mm',
  autoPrint: false,
  includeQrCode: true,
  headerTitle: 'SRI SAIRAM TECHNO INCUBATOR FOUNDATION',
  footerDisclaimer: 'Valid for 1 meal only · Mess Counter Token · Non-transferable',
};

const STORAGE_KEY = 'incubation_thermal_printer_config';

/**
 * Retrieve saved printer settings from localStorage with safe fallback defaults.
 */
export function getPrinterSettings(): PrinterSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.warn('Failed to parse thermal printer settings from localStorage', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update and persist printer settings to localStorage.
 */
export function savePrinterSettings(updated: Partial<PrinterSettings>): PrinterSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS, ...updated };
  }

  try {
    const current = getPrinterSettings();
    const merged: PrinterSettings = { ...current, ...updated };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    // Dispatch a custom event so components can update reactively
    window.dispatchEvent(new CustomEvent('thermal-printer-settings-changed', { detail: merged }));
    return merged;
  } catch (err) {
    console.error('Failed to save thermal printer settings to localStorage', err);
    return { ...DEFAULT_SETTINGS, ...updated };
  }
}

/**
 * Generates a high-contrast, zero-margin QR Code Data URL optimized for
 * 203 DPI thermal print heads (pure black on pure white).
 */
export async function generateQrCodeDataUrl(data: string, width: number = 140): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate thermal QR code', err);
    return '';
  }
}

/**
 * Generates test slip data to test physical thermal printer alignment,
 * paper feed, and print density without touching database records.
 */
export function getDiagnosticTestTokenData() {
  const today = getTodayISTDateString();
  const time = formatISTTime();
  const session = getMealSession();

  return {
    tokenNumber: 'TEST-80MM-001',
    studentId: 'PRINTER-TEST',
    studentName: 'Diagnostic Alignment Test',
    project: 'Thermal Hardware Verification',
    department: 'HARDWARE / IOT',
    year: 1,
    date: today,
    time: time,
    session: session,
    isTestPrint: true,
  };
}
