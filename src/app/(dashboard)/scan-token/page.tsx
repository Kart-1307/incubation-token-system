'use client';

import { useState, useEffect, useRef } from 'react';
import TokenPrintSlip from '@/components/TokenPrintSlip';
import { verifyStudentScan, issueFoodToken, type VerificationResult } from '@/actions/tokenActions';
import { getDailyFoodList, type FoodListDetails } from '@/actions/foodListActions';
import { getMealSession, getTodayISTDateString } from '@/utils/timeUtils';
import { getStudents, type StudentRecord } from '@/actions/studentActions';
import QRCode from 'qrcode';

type ScanState =
  | 'idle'
  | 'scanning'
  | 'found-eligible'
  | 'found-not-eligible'
  | 'not-found'
  | 'generating'
  | 'token-generated'
  | 'duplicate'
  | 'printer-failure';

interface TokenDisplay {
  id: string;
  tokenNumber: string;
  studentId: string;
  studentName: string;
  project: string;
  date: string;
  time: string;
  session?: string;
  status: string;
}

export default function ScanToken() {
  const [scannedId, setScannedId] = useState('');
  const [state, setState] = useState<ScanState>('idle');
  const [student, setStudent] = useState<VerificationResult['student'] | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [generatedToken, setGeneratedToken] = useState<TokenDisplay | null>(null);
  const [todayStr] = useState<string>(() => getTodayISTDateString());
  const [foodListInfo, setFoodListInfo] = useState<FoodListDetails | null>(null);
  const [dbStudents, setDbStudents] = useState<StudentRecord[]>([]);
  const [liveSyncConnected, setLiveSyncConnected] = useState<boolean>(false);
  const [showPhoneQrModal, setShowPhoneQrModal] = useState<boolean>(false);
  const [phoneQrDataUrl, setPhoneQrDataUrl] = useState<string>('');
  const [tunnelUrlInput, setTunnelUrlInput] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
    return 'https://sairam-incubation.loca.lt';
  });
  const [copiedAlert, setCopiedAlert] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const stateRef = useRef<ScanState>(state);
  const generatedTokenRef = useRef<TokenDisplay | null>(generatedToken);

  useEffect(() => {
    stateRef.current = state;
    generatedTokenRef.current = generatedToken;
  }, [state, generatedToken]);

  // Initialize and persist mobile scanner URL (auto-detects deployed live origin)
  useEffect(() => {
    fetch('/api/tunnel-status')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.url) {
          setTunnelUrlInput(data.url);
        } else if (typeof window !== 'undefined') {
          const isDeployed = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          const saved = localStorage.getItem('last_mobile_scanner_url');
          if (isDeployed) {
            setTunnelUrlInput(window.location.origin);
          } else if (saved && !saved.includes('sairam-incubation.loca.lt')) {
            setTunnelUrlInput(saved);
          }
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          const isDeployed = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          if (isDeployed) {
            setTunnelUrlInput(window.location.origin);
          } else {
            const saved = localStorage.getItem('last_mobile_scanner_url');
            if (saved) setTunnelUrlInput(saved);
          }
        }
      });
  }, [showPhoneQrModal]);

  // Generate dynamic QR code whenever tunnel/host URL changes
  useEffect(() => {
    let clean = (tunnelUrlInput || '').trim();
    if (!clean) return;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    const target = clean.endsWith('/mobile-scan') ? clean : `${clean.replace(/\/$/, '')}/mobile-scan`;
    QRCode.toDataURL(target, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => setPhoneQrDataUrl(url))
      .catch(err => console.error('QR generation error:', err));

    if (typeof window !== 'undefined') {
      localStorage.setItem('last_mobile_scanner_url', clean);
    }
  }, [tunnelUrlInput]);

  // Global hardware USB/Bluetooth barcode scanner gun detection
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && target !== inputRef.current) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          const scannedCode = buffer.trim().toUpperCase();
          buffer = '';
          // If already holding a generated token for this student, ignore repeat swipe to keep holding screen
          if (stateRef.current === 'token-generated' && generatedTokenRef.current?.studentId === scannedCode) {
            return;
          }
          setScannedId(scannedCode);
          processIdVerification(scannedCode);
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 120) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [todayStr]);

  // Synthesize Web Audio chime on terminal for real-time mobile scans
  const playTerminalChime = (type: 'success' | 'warning' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(349.23, ctx.currentTime);
        osc.frequency.setValueAtTime(261.63, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  };

  useEffect(() => {
    getDailyFoodList(todayStr).then(res => setFoodListInfo(res)).catch(() => {});
    getStudents().then(res => setDbStudents(res)).catch(() => {});
  }, [todayStr]);

  // Real-time Server-Sent Events listener connecting phone scans to laptop terminal
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let autoResetTimer: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource('/api/terminal-stream');

      eventSource.addEventListener('connected', () => {
        setLiveSyncConnected(true);
      });

      eventSource.onopen = () => {
        setLiveSyncConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'TOKEN_ISSUED') {
            setGeneratedToken({
              id: payload.tokenNumber || `tok-${Date.now()}`,
              tokenNumber: payload.tokenNumber,
              studentId: payload.studentId,
              studentName: payload.studentName || 'Student',
              project: payload.project || 'Incubation Member',
              date: payload.date || todayStr,
              time: payload.time || 'Now',
              session: payload.session || getMealSession(),
              status: 'Issued',
            });
            setStudent({
              id: payload.studentId,
              name: payload.studentName || 'Student',
              department: payload.department || '',
              year: 3,
              status: 'Active',
            });
            setProjectName(payload.project || 'Incubation Member');
            setMessage(payload.message || 'Token issued via Mobile Scanner');
            setState('token-generated');

            playTerminalChime('success');
          } else if (payload.type === 'DUPLICATE') {
            // Guard: If currently holding the generated token screen for this student or token number,
            // hold the token generated screen! Do not kick it out with a duplicate warning!
            if (
              stateRef.current === 'token-generated' &&
              (generatedTokenRef.current?.studentId === payload.studentId ||
                generatedTokenRef.current?.tokenNumber === payload.tokenNumber)
            ) {
              return;
            }

            setGeneratedToken({
              id: payload.tokenNumber || `tok-${Date.now()}`,
              tokenNumber: payload.tokenNumber,
              studentId: payload.studentId,
              studentName: payload.studentName || 'Student',
              project: payload.project || 'Incubation Member',
              date: payload.date || todayStr,
              time: payload.time || 'Earlier',
              session: payload.session || getMealSession(),
              status: 'Issued',
            });
            setMessage(payload.message);
            setState('duplicate');
            playTerminalChime('warning');
          } else if (payload.type === 'INELIGIBLE') {
            setMessage(payload.message);
            setState('found-not-eligible');
            playTerminalChime('error');
          } else if (payload.type === 'NOT_FOUND') {
            setMessage(payload.message);
            setState('not-found');
            playTerminalChime('error');
          }
        } catch (err) {
          console.warn('Error parsing terminal stream payload:', err);
        }
      };

      eventSource.onerror = () => {
        setLiveSyncConnected(false);
      };
    } catch (e) {
      console.warn('SSE connection error:', e);
    }

    return () => {
      if (autoResetTimer) clearTimeout(autoResetTimer);
      if (eventSource) eventSource.close();
    };
  }, [todayStr]);

  // Keep input focused for physical hardware USB/Bluetooth barcode scanner guns
  useEffect(() => {
    if (state === 'idle' || state === 'scanning') {
      inputRef.current?.focus();
    }
  }, [state]);



  const processIdVerification = async (targetId: string) => {
    const cleanId = targetId.trim().toUpperCase();
    if (!cleanId) return;

    setState('scanning');
    setMessage('');
    setStudent(null);
    setGeneratedToken(null);

    const res = await verifyStudentScan(cleanId, todayStr);

    if (!res.found) {
      setState('not-found');
      setMessage(res.message);
      return;
    }

    setStudent(res.student || null);
    setProjectName(res.project || 'Unassigned');
    setMessage(res.message);

    if (res.isDuplicate && res.existingToken) {
      setGeneratedToken({
        id: res.existingToken.id,
        tokenNumber: res.existingToken.tokenNumber,
        studentId: res.student?.id || '',
        studentName: res.student?.name || '',
        project: res.project || 'Unassigned',
        date: res.existingToken.date,
        time: res.existingToken.time,
        session: res.existingToken.session || getMealSession(),
        status: 'Issued',
      });
      setState('duplicate');
      return;
    }

    if (!res.isEligible) {
      setState('found-not-eligible');
      return;
    }

    setState('found-eligible');
  };

  const handleVerifyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await processIdVerification(scannedId);
  };

  const handleQuickTapScan = (idSample: string) => {
    setScannedId(idSample);
    processIdVerification(idSample);
  };

  const handleGenerateToken = async () => {
    if (!student) return;
    setState('generating');

    const res = await issueFoodToken(student.id);

    if (!res.success || !res.token) {
      if (res.message?.includes('already issued') || res.message?.includes('already generated')) {
        setMessage(res.message);
        setState('duplicate');
      } else {
        setMessage(res.message || 'Failed to issue token');
        setState('found-eligible');
      }
      return;
    }

    const t = res.token;
    setGeneratedToken({
      id: t.id,
      tokenNumber: t.tokenNumber,
      studentId: t.studentId,
      studentName: t.studentName,
      project: t.project,
      date: t.date,
      time: t.time,
      session: t.session || getMealSession(),
      status: t.status,
    });

    setState('token-generated');
  };

  const reset = () => {
    setScannedId('');
    setState('idle');
    setStudent(null);
    setProjectName('');
    setMessage('');
    setGeneratedToken(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const currentMealSession = getMealSession();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Portal Container for Thermal Receipt Printing */}
      <TokenPrintSlip token={generatedToken} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mess Verification Terminal</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Scan student ID barcode/QR card or use wireless mobile phone scanner
          </p>
        </div>

        {/* Live Phone Sync Connection Indicator & Link */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border ${
            liveSyncConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${liveSyncConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>{liveSyncConnected ? 'Phone Sync: Live' : 'Phone Sync: Ready'}</span>
          </span>

          {/* Connect Phone Scanner Button (Opens On-Screen QR Code Modal) */}
          <button
            onClick={() => setShowPhoneQrModal(true)}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Scan QR Code with phone to open wireless camera scanner"
          >
            <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            <span>📱 Connect Phone</span>
          </button>
        </div>
      </div>

      {/* Food List Status Banner */}
      {foodListInfo && (
        <div className="p-3.5 rounded-xl border text-xs flex items-center justify-between font-medium bg-emerald-50 border-emerald-200 text-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Daily Food Eligibility List ({todayStr}): <strong className="text-emerald-950 font-bold">{foodListInfo.entries.length} students approved</strong></span>
          </div>
          <div className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px] uppercase tracking-wide">
            Active Session: {currentMealSession}
          </div>
        </div>
      )}

      {/* UNIFIED BARCODE & MANUAL ENTRY TERMINAL */}
      {state === 'idle' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white space-y-5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>BARCODE & ID CARD SCANNER READY</span>
            </div>
            <span className="text-slate-400 font-mono">SESSION: {currentMealSession}</span>
          </div>

          {/* Viewfinder Target Frame with Authentic 1D Barcode Card & Animated Laser */}
          <div className="relative w-full py-6 px-4 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center select-none">
            {/* Ambient Background Grid Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] bg-size-[16px_16px] opacity-25 pointer-events-none" />

            {/* Viewfinder Corner Reticles */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-amber-400/90 rounded-tl" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-amber-400/90 rounded-tr" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-amber-400/90 rounded-bl" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-amber-400/90 rounded-br" />

            {/* Stylized Student ID Barcode Card */}
            <div className="relative z-10 w-full max-w-sm bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl overflow-hidden">
              {/* Animated Laser Sweep Beam across the ID Card */}
              <div className="absolute left-0 right-0 h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e,0_0_24px_#f43f5e] animate-laser z-20 pointer-events-none">
                <div className="absolute inset-0 bg-white/80 blur-[0.5px]" />
                <div className="absolute -top-2.5 -bottom-2.5 left-0 right-0 bg-rose-500/20 blur-xs" />
              </div>

              {/* ID Badge Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[10px] tracking-wider text-slate-400">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                  <span>SRI SAIRAM ENGINEERING COLLEGE</span>
                </div>
                <span className="font-mono text-indigo-400 font-semibold">SMART ID</span>
              </div>

              {/* White Barcode Plate */}
              <div className="my-2.5 bg-white rounded-lg p-2.5 shadow-inner flex flex-col items-center justify-center">
                {/* 1D Barcode SVG Graphic */}
                <svg className="w-full h-11 text-slate-900" viewBox="0 0 280 44" fill="currentColor">
                  {/* Left Guard */}
                  <rect x="0" y="0" width="3" height="44" />
                  <rect x="5" y="0" width="2" height="44" />
                  {/* Left Data Bars */}
                  <rect x="10" y="0" width="4" height="40" />
                  <rect x="16" y="0" width="1" height="40" />
                  <rect x="19" y="0" width="3" height="40" />
                  <rect x="25" y="0" width="6" height="40" />
                  <rect x="33" y="0" width="2" height="40" />
                  <rect x="38" y="0" width="4" height="40" />
                  <rect x="44" y="0" width="1" height="40" />
                  <rect x="47" y="0" width="5" height="40" />
                  <rect x="54" y="0" width="2" height="40" />
                  <rect x="58" y="0" width="3" height="40" />
                  <rect x="64" y="0" width="1" height="40" />
                  <rect x="67" y="0" width="6" height="40" />
                  <rect x="75" y="0" width="2" height="40" />
                  <rect x="80" y="0" width="4" height="40" />
                  <rect x="86" y="0" width="3" height="40" />
                  <rect x="91" y="0" width="1" height="40" />
                  <rect x="94" y="0" width="5" height="40" />
                  <rect x="101" y="0" width="2" height="40" />
                  <rect x="105" y="0" width="4" height="40" />
                  <rect x="111" y="0" width="1" height="40" />
                  <rect x="114" y="0" width="6" height="40" />
                  <rect x="122" y="0" width="3" height="40" />
                  <rect x="127" y="0" width="2" height="40" />
                  <rect x="131" y="0" width="5" height="40" />
                  <rect x="138" y="0" width="1" height="40" />
                  {/* Center Guard */}
                  <rect x="142" y="0" width="2" height="44" />
                  <rect x="146" y="0" width="2" height="44" />
                  {/* Right Data Bars */}
                  <rect x="151" y="0" width="4" height="40" />
                  <rect x="157" y="0" width="2" height="40" />
                  <rect x="161" y="0" width="5" height="40" />
                  <rect x="168" y="0" width="1" height="40" />
                  <rect x="171" y="0" width="3" height="40" />
                  <rect x="176" y="0" width="6" height="40" />
                  <rect x="184" y="0" width="2" height="40" />
                  <rect x="188" y="0" width="4" height="40" />
                  <rect x="194" y="0" width="1" height="40" />
                  <rect x="197" y="0" width="5" height="40" />
                  <rect x="204" y="0" width="3" height="40" />
                  <rect x="209" y="0" width="2" height="40" />
                  <rect x="213" y="0" width="6" height="40" />
                  <rect x="221" y="0" width="1" height="40" />
                  <rect x="224" y="0" width="4" height="40" />
                  <rect x="230" y="0" width="3" height="40" />
                  <rect x="235" y="0" width="5" height="40" />
                  <rect x="242" y="0" width="2" height="40" />
                  <rect x="246" y="0" width="4" height="40" />
                  <rect x="252" y="0" width="1" height="40" />
                  <rect x="255" y="0" width="6" height="40" />
                  <rect x="263" y="0" width="2" height="40" />
                  <rect x="267" y="0" width="4" height="40" />
                  {/* Right Guard */}
                  <rect x="274" y="0" width="2" height="44" />
                  <rect x="278" y="0" width="2" height="44" />
                </svg>
                <div className="text-[10px] font-mono tracking-[0.3em] text-slate-800 font-bold mt-1 text-center select-none">
                  * SEC-STUDENT-ID *
                </div>
              </div>

              {/* ID Badge Footer Details */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                <span className="text-slate-500">INCUBATION INTERN</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  ACTIVE SCAN READY
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-medium">
              <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <rect x="3" y="11" width="18" height="10" rx="2" />
              </svg>
              <span>Swipe or point USB/Wireless barcode scanner at student ID card</span>
            </div>
          </div>

          {/* Auto-focused Input Form for Scanner & Manual Typing */}
          <form onSubmit={handleVerifyForm} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={scannedId}
              onChange={(e) => setScannedId(e.target.value)}
              placeholder="SCAN BARCODE OR TYPE ROLL NO (E.G. 23CS101)..."
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase terminal-input"
            />
            <button
              type="submit"
              disabled={!scannedId.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition cursor-pointer disabled:opacity-50"
            >
              Verify
            </button>
          </form>

          {/* Registered Student Quick-Tap Buttons */}
          <div className="pt-2 border-t border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>Quick Test ID Card Tap (Registered Students):</span>
              <span className="text-[10px] text-indigo-400 font-mono">{dbStudents.length} Students</span>
            </div>
            {dbStudents.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-1">No registered students found in database</div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                {dbStudents.map(studentItem => (
                  <button
                    key={studentItem.id}
                    type="button"
                    onClick={() => handleQuickTapScan(studentItem.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-900 border border-slate-700 text-xs font-mono font-semibold text-indigo-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    title={`${studentItem.name} (${studentItem.department})`}
                  >
                    <span>Tap {studentItem.id}</span>
                    <span className="text-[10px] font-sans text-slate-400 font-normal">({studentItem.name.split(' ')[0]})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCANNING IN PROGRESS STAGE */}
      {state === 'scanning' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
          <div className="relative w-full py-6 px-4 bg-slate-950 rounded-xl border border-emerald-500/30 overflow-hidden flex flex-col items-center justify-center select-none">
            {/* Viewfinder Corner Reticles in Emerald */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br" />

            {/* Stylized ID Card with Neon Emerald Decoding Laser */}
            <div className="relative z-10 w-full max-w-sm bg-linear-to-b from-slate-900 to-slate-950 border border-emerald-500/50 rounded-xl p-3.5 shadow-2xl overflow-hidden">
              <div className="absolute left-0 right-0 h-[2.5px] bg-emerald-400 shadow-[0_0_16px_#10b981,0_0_30px_#10b981] animate-laser z-20 pointer-events-none">
                <div className="absolute inset-0 bg-white blur-[0.5px]" />
                <div className="absolute -top-3 -bottom-3 left-0 right-0 bg-emerald-500/20 blur-xs" />
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[10px] text-slate-400">
                <span className="font-bold text-slate-300">SRI SAIRAM ENGINEERING COLLEGE</span>
                <span className="font-mono text-emerald-400 font-bold animate-pulse">DECODING...</span>
              </div>

              <div className="my-2.5 bg-white rounded-lg p-2.5 shadow-inner flex flex-col items-center justify-center opacity-95">
                <svg className="w-full h-11 text-slate-900 opacity-80" viewBox="0 0 280 44" fill="currentColor">
                  {/* Left Guard */}
                  <rect x="0" y="0" width="3" height="44" />
                  <rect x="5" y="0" width="2" height="44" />
                  {/* Left Data Bars */}
                  <rect x="10" y="0" width="4" height="40" />
                  <rect x="16" y="0" width="1" height="40" />
                  <rect x="19" y="0" width="3" height="40" />
                  <rect x="25" y="0" width="6" height="40" />
                  <rect x="33" y="0" width="2" height="40" />
                  <rect x="38" y="0" width="4" height="40" />
                  <rect x="44" y="0" width="1" height="40" />
                  <rect x="47" y="0" width="5" height="40" />
                  <rect x="54" y="0" width="2" height="40" />
                  <rect x="58" y="0" width="3" height="40" />
                  <rect x="64" y="0" width="1" height="40" />
                  <rect x="67" y="0" width="6" height="40" />
                  <rect x="75" y="0" width="2" height="40" />
                  <rect x="80" y="0" width="4" height="40" />
                  <rect x="86" y="0" width="3" height="40" />
                  <rect x="91" y="0" width="1" height="40" />
                  <rect x="94" y="0" width="5" height="40" />
                  <rect x="101" y="0" width="2" height="40" />
                  <rect x="105" y="0" width="4" height="40" />
                  <rect x="111" y="0" width="1" height="40" />
                  <rect x="114" y="0" width="6" height="40" />
                  <rect x="122" y="0" width="3" height="40" />
                  <rect x="127" y="0" width="2" height="40" />
                  <rect x="131" y="0" width="5" height="40" />
                  <rect x="138" y="0" width="1" height="40" />
                  {/* Center Guard */}
                  <rect x="142" y="0" width="2" height="44" />
                  <rect x="146" y="0" width="2" height="44" />
                  {/* Right Data Bars */}
                  <rect x="151" y="0" width="4" height="40" />
                  <rect x="157" y="0" width="2" height="40" />
                  <rect x="161" y="0" width="5" height="40" />
                  <rect x="168" y="0" width="1" height="40" />
                  <rect x="171" y="0" width="3" height="40" />
                  <rect x="176" y="0" width="6" height="40" />
                  <rect x="184" y="0" width="2" height="40" />
                  <rect x="188" y="0" width="4" height="40" />
                  <rect x="194" y="0" width="1" height="40" />
                  <rect x="197" y="0" width="5" height="40" />
                  <rect x="204" y="0" width="3" height="40" />
                  <rect x="209" y="0" width="2" height="40" />
                  <rect x="213" y="0" width="6" height="40" />
                  <rect x="221" y="0" width="1" height="40" />
                  <rect x="224" y="0" width="4" height="40" />
                  <rect x="230" y="0" width="3" height="40" />
                  <rect x="235" y="0" width="5" height="40" />
                  <rect x="242" y="0" width="2" height="40" />
                  <rect x="246" y="0" width="4" height="40" />
                  <rect x="252" y="0" width="1" height="40" />
                  <rect x="255" y="0" width="6" height="40" />
                  <rect x="263" y="0" width="2" height="40" />
                  <rect x="267" y="0" width="4" height="40" />
                  {/* Right Guard */}
                  <rect x="274" y="0" width="2" height="44" />
                  <rect x="278" y="0" width="2" height="44" />
                </svg>
                <div className="text-[10px] font-mono tracking-[0.3em] text-emerald-800 font-bold mt-1 text-center select-none">
                  * {scannedId || 'READING'} *
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                <span className="text-slate-500">DATABASE QUERY</span>
                <span className="text-emerald-400 font-semibold font-mono">MATCHING ELIGIBILITY...</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-spin border border-amber-300 border-t-transparent" />
              <span>Verifying ID {scannedId} against today's eligibility list...</span>
            </div>
          </div>
        </div>
      )}

      {/* ELIGIBLE - PROMPT TO ISSUE TOKEN */}
      {state === 'found-eligible' && student && (
        <div className="bg-white border border-emerald-200 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-100 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
              ✓
            </div>
            <h3 className="text-lg font-bold text-emerald-800">Student Eligible for Meal</h3>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Approved on today's food eligibility list</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Student Name:</span>
                <span className="font-bold text-slate-900">{student.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student ID:</span>
                <span className="font-bold font-mono text-indigo-700">{student.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department & Year:</span>
                <span className="font-medium text-slate-800">{student.department} · Year {student.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Incubation Project:</span>
                <span className="font-medium text-slate-800">{projectName}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Meal Session:</span>
                <span className="font-bold text-indigo-900 uppercase">{currentMealSession}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGenerateToken}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Generate Food Token</span>
              </button>
              <button
                onClick={reset}
                className="border border-slate-300 text-slate-600 px-4 py-3 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATING STAGE */}
      {state === 'generating' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-semibold text-slate-700">Generating Meal Token...</div>
        </div>
      )}

      {/* TOKEN GENERATED SUCCESS */}
      {state === 'token-generated' && generatedToken && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-6 p-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
              Token Sequence Number
            </div>
            <div className="text-3xl font-black font-mono tracking-wider text-indigo-900 my-1">
              {generatedToken.tokenNumber}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              Issued at: <span className="font-bold text-slate-800">{generatedToken.time}</span> · Session: <span className="font-bold text-indigo-900 uppercase">{generatedToken.session || currentMealSession}</span>
            </div>
          </div>

          {/* Thermal Receipt Preview */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
              Thermal Receipt Slip Preview
            </div>
            <div className="max-w-xs mx-auto bg-white border border-slate-300 rounded-lg p-5 text-xs leading-tight shadow-sm text-slate-900">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                <div className="font-bold text-[13px]">SRI SAIRAM ENGINEERING COLLEGE</div>
                <div className="text-[11px] text-slate-600">INCUBATION CENTRE</div>
                <div className="font-bold text-[13px] mt-1 text-indigo-900">FOOD TOKEN SLIP</div>
              </div>

              <div className="flex flex-col items-center justify-center my-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">TOKEN NUMBER</div>
                <div className="text-xl font-black font-mono tracking-widest text-indigo-900">{generatedToken.tokenNumber}</div>
              </div>

              <div className="space-y-1.5 border-t border-b border-dashed border-slate-300 py-2.5 my-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">STUDENT:</span>
                  <span className="font-bold">{generatedToken.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ID NO:</span>
                  <span className="font-bold font-mono">{generatedToken.studentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PROJECT:</span>
                  <span>{generatedToken.project}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SESSION:</span>
                  <span className="font-bold text-indigo-900 uppercase">{generatedToken.session || currentMealSession}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ISSUED:</span>
                  <span>{generatedToken.time}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                <div>Present this slip at mess counter</div>
                <div>Valid for 1 meal only · Non-transferable</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Print Slip
            </button>
            <button
              onClick={reset}
              className="flex-1 bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-800 transition-colors shadow-xs cursor-pointer"
            >
              Scan Next Student
            </button>
          </div>
        </div>
      )}

      {/* NOT ELIGIBLE */}
      {state === 'found-not-eligible' && student && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-rose-50 border-b border-rose-100 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
              ✕
            </div>
            <h3 className="text-lg font-bold text-rose-800">Student Not Eligible</h3>
          </div>
          <div className="p-6 space-y-3 text-center">
            <div className="font-bold text-slate-800">{student.name}</div>
            <div className="text-sm text-slate-400 font-medium font-mono">{student.id} · {student.department}</div>
            <p className="text-sm text-slate-500">
              This student is not included in today's food eligibility list ({todayStr}). No food token was issued.
            </p>
            <button
              onClick={reset}
              className="mt-4 bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-800 transition-colors cursor-pointer"
            >
              Scan Another Student
            </button>
          </div>
        </div>
      )}

      {/* NOT FOUND */}
      {state === 'not-found' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-600 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
              ?
            </div>
            <h3 className="text-lg font-bold text-slate-700">Student Not Found</h3>
          </div>
          <div className="p-6 space-y-3 text-center">
            <p className="text-sm text-slate-500">
              The student ID <span className="font-semibold font-mono text-slate-700">{scannedId}</span> was not found in the Student Master registry.
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={reset}
                className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE TOKEN WITH SMART SESSION GUIDANCE */}
      {state === 'duplicate' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
              ⚠
            </div>
            <h3 className="text-lg font-bold text-amber-800">Token Already Issued for Session</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="font-bold text-slate-800">{generatedToken?.studentName || student?.name}</div>
              <div className="text-sm text-slate-400 font-mono font-medium">{generatedToken?.studentId || student?.id}</div>
            </div>

            {/* Smart Session Guidance Alert Box */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-center">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                Meal Session Guidance
              </div>
              <p className="text-sm text-amber-900 font-medium">
                {message || `Token already generated for today's ${generatedToken?.session || currentMealSession} meal session.`}
              </p>
            </div>

            {generatedToken && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-semibold mb-0.5">Existing Token Record</div>
                  <div className="font-bold text-indigo-900 text-base font-mono tabular-nums">{generatedToken.tokenNumber}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Issued: {generatedToken.time} ({generatedToken.date})</div>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Print Token Slip
              </button>
              <button
                onClick={reset}
                className="flex-1 bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                Scan Next Student
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Phone Scanner Connect QR Modal */}
      {showPhoneQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <div>
                  <h3 className="text-sm font-bold">Connect Phone Scanner</h3>
                  <p className="text-[11px] text-slate-300">Point phone camera at this QR code</p>
                </div>
              </div>
              <button
                onClick={() => setShowPhoneQrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* QR Code Container */}
            <div className="p-5 flex flex-col items-center justify-center text-center">
              <div className="bg-slate-50 p-3 rounded-2xl border-2 border-dashed border-indigo-200 shadow-inner mb-3">
                {phoneQrDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={phoneQrDataUrl}
                    alt="Scan with phone"
                    className="w-48 h-48 rounded-xl object-contain mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Open default camera on phone & tap link</span>
              </div>

              {/* Tunnel URL config field */}
              <div className="w-full mt-4 text-left">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Target Tunnel / Server URL:
                </label>
                <div className="flex gap-1.5">
                  <input
                    value={tunnelUrlInput}
                    onChange={e => setTunnelUrlInput(e.target.value)}
                    placeholder="https://xxxx.loca.lt"
                    className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${tunnelUrlInput.replace(/\/$/, '')}/mobile-scan`);
                      setCopiedAlert('URL Copied!');
                      setTimeout(() => setCopiedAlert(''), 2500);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    title="Copy full mobile-scan URL"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Localtunnel IP Password helper */}
              <div className="w-full mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center justify-between">
                <div>
                  <span className="font-bold block">Tunnel Password (if asked):</span>
                  <span className="font-mono font-bold text-amber-950">49.43.248.107</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('49.43.248.107');
                    setCopiedAlert('Password Copied!');
                    setTimeout(() => setCopiedAlert(''), 2500);
                  }}
                  className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-semibold rounded text-[10px] transition-colors cursor-pointer"
                >
                  Copy IP
                </button>
              </div>

              {copiedAlert && (
                <div className="mt-2 text-xs font-bold text-emerald-600 animate-in fade-in">
                  ✓ {copiedAlert}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-between text-xs">
                <a
                  href="/mobile-scan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Open in this browser ↗
                </a>
                <button
                  onClick={() => setShowPhoneQrModal(false)}
                  className="px-3 py-1 bg-slate-900 text-white rounded-lg font-medium text-xs hover:bg-slate-800 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
