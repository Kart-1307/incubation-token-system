'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import TokenPrintSlip from '@/components/TokenPrintSlip';
import TokenSlipModal from '@/components/TokenSlipModal';
import { verifyStudentScan, issueFoodToken, type VerificationResult } from '@/actions/tokenActions';
import { getDailyFoodList, type FoodListDetails } from '@/actions/foodListActions';
import { getMealSession, getTodayISTDateString, getPreviousISTDateString, formatISTDateDMY, formatISTTime } from '@/utils/timeUtils';
import { getStudents, type StudentRecord } from '@/actions/studentActions';

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
  category?: 'Student' | 'Intern';
  startupName?: string;
  department?: string;
  year?: number;
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
  const [yesterdayFoodListInfo, setYesterdayFoodListInfo] = useState<FoodListDetails | null>(null);
  const [dbStudents, setDbStudents] = useState<StudentRecord[]>([]);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hardware_scanner_sound');
      return saved !== 'false';
    }
    return true;
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hardware_scanner_sound', String(next));
      }
      return next;
    });
  };
  const inputRef = useRef<HTMLInputElement>(null);

  const stateRef = useRef<ScanState>(state);
  const generatedTokenRef = useRef<TokenDisplay | null>(generatedToken);

  useEffect(() => {
    stateRef.current = state;
    generatedTokenRef.current = generatedToken;
  }, [state, generatedToken]);

  // Global hardware USB/Bluetooth barcode scanner gun detection (zero-lag burst capture)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isOtherInput = target && target.tagName === 'INPUT' && target !== inputRef.current;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Hardware scanners send characters with inter-key delta < 45ms
      const isScannerBurst = timeDiff < 45;

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
        if (isOtherInput && !isScannerBurst) return;
        if (timeDiff > 100) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [todayStr]);

  // Synthesize Web Audio chime for instant hardware scanner feedback
  const playTerminalChime = (type: 'success' | 'warning' | 'error') => {
    if (!soundEnabled) return;
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
    const yesterdayStr = getPreviousISTDateString(todayStr);
    getDailyFoodList(todayStr).then(res => setFoodListInfo(res)).catch(() => {});
    getDailyFoodList(yesterdayStr).then(res => setYesterdayFoodListInfo(res)).catch(() => {});
    getStudents().then(res => setDbStudents(res)).catch(() => {});
  }, [todayStr]);



  // Keep input focused for physical hardware USB/Bluetooth barcode scanner guns
  useEffect(() => {
    if (state === 'idle' || state === 'scanning') {
      inputRef.current?.focus();
    }
  }, [state]);

  // Auto-reset alert states back to idle after 8 seconds so screen never gets stuck
  useEffect(() => {
    if (state === 'found-not-eligible' || state === 'not-found' || state === 'duplicate') {
      const timer = setTimeout(() => {
        reset();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [state]);



  const currentMealSession = getMealSession();
  const activeTerminalDate = todayStr;

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
      playTerminalChime('error');
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
        session: res.existingToken.session || currentMealSession,
        status: 'Issued',
        category: res.student?.category,
        startupName: res.student?.startupName,
        department: res.student?.department,
        year: res.student?.year,
      });
      setState('duplicate');
      playTerminalChime('warning');
      return;
    }

    if (!res.isEligible) {
      setState('found-not-eligible');
      playTerminalChime('error');
      return;
    }

    setState('found-eligible');
    playTerminalChime('success');
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

    const res = await issueFoodToken(student.id, undefined, todayStr);

    if (!res.success || !res.token) {
      if (res.message?.includes('already issued') || res.message?.includes('already generated')) {
        setMessage(res.message);
        setState('duplicate');
        playTerminalChime('warning');
      } else {
        setMessage(res.message || 'Failed to issue token');
        setState('found-eligible');
        playTerminalChime('error');
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
      session: t.session || currentMealSession,
      status: t.status,
      category: t.category || student.category,
      startupName: t.startupName || student.startupName,
      department: student.department,
      year: student.year,
    });

    setState('token-generated');
    playTerminalChime('success');
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Portal Container for Thermal Receipt Printing */}
      <TokenPrintSlip token={generatedToken} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mess Verification Terminal</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Scan student ID barcode card using hardware handheld scanner gun
          </p>
        </div>

        {/* Hardware Scanner Active Status Badge, Printer Setup & Sound Toggle */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>⚡ Scanner Active</span>
          </span>

          <button
            type="button"
            onClick={toggleSound}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-100/90 border-emerald-300 text-emerald-900 hover:bg-emerald-200'
                : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
            }`}
            title={soundEnabled ? 'Beep chime enabled on scan' : 'Sound muted'}
          >
            <span>{soundEnabled ? '🔔 Sound On' : '🔕 Muted'}</span>
          </button>
        </div>
      </div>

      {/* Food List Status Banner */}
      <div className="p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 font-medium bg-emerald-50 border-emerald-200 text-emerald-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {foodListInfo && foodListInfo.entries.length > 0 ? (
            <span>Daily Food Eligibility List ({formatISTDateDMY(activeTerminalDate)}): <strong className="text-emerald-950 font-bold">{foodListInfo.entries.length} students approved</strong></span>
          ) : (currentMealSession === 'BREAKFAST' || currentMealSession === 'LUNCH') && yesterdayFoodListInfo && yesterdayFoodListInfo.entries.length > 0 ? (
            <span>Overnight Night-Stay Cycle ({formatISTDateDMY(getPreviousISTDateString(activeTerminalDate))}): <strong className="text-emerald-950 font-bold">{yesterdayFoodListInfo.entries.length} students approved</strong> for {currentMealSession}</span>
          ) : (
            <span>Daily Food Eligibility List ({formatISTDateDMY(activeTerminalDate)}): <strong className="text-amber-800 font-bold">0 approved today</strong></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(currentMealSession === 'BREAKFAST' || currentMealSession === 'LUNCH') && yesterdayFoodListInfo && yesterdayFoodListInfo.entries.length > 0 && foodListInfo && foodListInfo.entries.length > 0 && (
            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold border border-emerald-300">
              +{yesterdayFoodListInfo.entries.length} Night Stay
            </span>
          )}
          <div className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px] uppercase tracking-wide">
            Active Session: {currentMealSession}
          </div>
        </div>
      </div>

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
              placeholder="SCAN BARCODE OR TYPE ROLL NO / 4-DIGIT CODE (E.G. 23CS101, INT-3210, 3210)..."
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
              <span>Quick Test ID Card Tap (Registered Members):</span>
              <span className="text-[10px] text-indigo-400 font-mono">{dbStudents.length} Members</span>
            </div>
            {dbStudents.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-1">No registered students found in database</div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                {dbStudents.map(studentItem => {
                  const isEligibleToday = (foodListInfo?.entries || []).some(e => e.studentId === studentItem.id);
                  const isEligibleNightStay = (currentMealSession === 'BREAKFAST' || currentMealSession === 'LUNCH') &&
                    (yesterdayFoodListInfo?.entries || []).some(e => e.studentId === studentItem.id);
                  const isApproved = isEligibleToday || isEligibleNightStay;

                  return (
                    <button
                      key={studentItem.id}
                      type="button"
                      onClick={() => handleQuickTapScan(studentItem.id)}
                      className={`px-3 py-1.5 border text-xs font-mono font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isApproved
                          ? 'bg-slate-800 hover:bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                          : 'bg-slate-800 hover:bg-indigo-900 border-slate-700 text-slate-300'
                      }`}
                      title={`${studentItem.name} (${studentItem.department}) - ${
                        isApproved
                          ? (isEligibleNightStay && !isEligibleToday ? 'Overnight Stay Approved' : 'Approved Today')
                          : 'Not on food list'
                      }`}
                    >
                      {isApproved && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      <span>Tap {studentItem.id}</span>
                      <span className="text-[10px] font-sans text-slate-400 font-normal">({studentItem.name.split(' ')[0]})</span>
                      {isEligibleNightStay && !isEligibleToday && (
                        <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1 py-0.2 rounded border border-indigo-700/60">🌙 Night</span>
                      )}
                    </button>
                  );
                })}
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
      {state === 'found-eligible' && (
        <div className="bg-white border border-emerald-200 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-100 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
              ✓
            </div>
            <h3 className="text-lg font-bold text-emerald-800">
              {student?.category === 'Intern' ? 'Startup Intern Eligible for Meal' : 'Student Eligible for Meal'}
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Approved on today's food eligibility list</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Member Name:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{student?.name || 'Eligible Member'}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      student?.category === 'Intern'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                    }`}
                  >
                    {student?.category === 'Intern' ? '💼 INTERN' : '🎓 STUDENT'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ID Number / Code:</span>
                <span className="font-bold font-mono text-indigo-700">{student?.id || scannedId}</span>
              </div>
              {student?.category === 'Intern' ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">Startup:</span>
                  <span className="font-semibold text-slate-800">
                    💼 {student.startupName || student.department}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-500">Department & Year:</span>
                  <span className="font-medium text-slate-800">
                    {student?.department || '—'} {student?.year ? `· Year ${student.year}` : ''}
                  </span>
                </div>
              )}
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
      {state === 'token-generated' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-6 p-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
              Token Sequence Number
            </div>
            <div className="text-3xl font-black font-mono tracking-wider text-indigo-900 my-1">
              {generatedToken?.tokenNumber || 'ISSUED'}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              Issued at: <span className="font-bold text-slate-800">{formatISTTime(generatedToken?.time)}</span> · Session: <span className="font-bold text-indigo-900 uppercase">{generatedToken?.session || currentMealSession}</span>
            </div>
          </div>

          {/* Thermal Receipt Preview */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
              Thermal Receipt Slip Preview
            </div>
            <div className="max-w-xs mx-auto bg-white border border-slate-300 rounded-lg p-5 text-xs leading-tight shadow-sm text-slate-900">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
                <div className="font-bold text-[12px]">SRI SAIRAM TECHNO INCUBATOR FOUNDATION</div>
                <div className="text-[10px] text-slate-600">FOOD TOKEN SYSTEM</div>
                <div className="font-bold text-[13px] mt-1 text-indigo-900">FOOD TOKEN SLIP</div>
              </div>

              <div className="flex flex-col items-center justify-center my-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">TOKEN NUMBER</div>
                <div className="text-xl font-black font-mono tracking-widest text-indigo-900">{generatedToken?.tokenNumber || '—'}</div>
              </div>

              <div className="space-y-1.5 border-t border-b border-dashed border-slate-300 py-2.5 my-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {generatedToken?.category === 'Intern' || student?.category === 'Intern' ? 'INTERN:' : 'STUDENT:'}
                  </span>
                  <span className="font-bold">{generatedToken?.studentName || student?.name || 'Member'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ID NO:</span>
                  <span className="font-bold font-mono">{generatedToken?.studentId || student?.id || scannedId}</span>
                </div>
                {generatedToken?.category === 'Intern' || student?.category === 'Intern' ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">STARTUP:</span>
                    <span className="font-bold text-right truncate">
                      {generatedToken?.startupName || student?.startupName || student?.department || 'Startup Intern'}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-500">DEPT:</span>
                    <span>{student?.department || '—'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">SESSION:</span>
                  <span className="font-bold text-indigo-900 uppercase">{generatedToken?.session || currentMealSession}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ISSUED:</span>
                  <span>{formatISTTime(generatedToken?.time)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1 border-t border-dashed border-slate-200">
                <div>Present this slip at mess counter</div>
                <div>Valid for 1 meal only · Non-transferable</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🖨️</span>
              <span>Print Slip</span>
            </button>
            <button
              onClick={reset}
              className="flex-1 bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-800 transition-colors shadow-xs cursor-pointer"
            >
              Scan Next Student
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setState('printer-failure')}
              className="text-xs text-slate-400 hover:text-amber-700 transition-colors cursor-pointer underline underline-offset-2"
            >
              Printer did not respond or jammed? View troubleshooting & retry
            </button>
          </div>
        </div>
      )}

      {/* NOT ELIGIBLE */}
      {state === 'found-not-eligible' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="bg-rose-50 border-b border-rose-100 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
              ✕
            </div>
            <h3 className="text-lg font-bold text-rose-800">Student Not Eligible</h3>
          </div>
          <div className="p-6 space-y-3 text-center">
            <div className="font-bold text-slate-800">{student?.name || 'Student Ineligible'}</div>
            <div className="text-sm text-slate-400 font-medium font-mono">
              {student?.id || scannedId} {student?.department ? `· ${student.department}` : ''}
            </div>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {message || `This student is not included in today's food eligibility list (${formatISTDateDMY(todayStr)}). No food token was issued.`}
            </p>
            <div className="pt-2">
              <button
                onClick={reset}
                className="bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                Scan Another Student
              </button>
            </div>
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
                  <div className="text-xs text-slate-500 mt-0.5">Issued: {formatISTTime(generatedToken.time)} ({formatISTDateDMY(generatedToken.date)})</div>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🖨️</span>
                <span>Print Token Slip</span>
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

      {/* PRINTER FAILURE STATE (Figma Section 30) */}
      {state === 'printer-failure' && (
        <div className="bg-white border border-amber-300 rounded-xl shadow-xs overflow-hidden animate-in fade-in duration-200">
          <div className="bg-amber-50 border-b border-amber-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
              ⚠
            </div>
            <h3 className="text-lg font-bold text-amber-900">Printing Failed</h3>
            <p className="text-xs text-amber-800 mt-1 max-w-md mx-auto">
              The food token was generated, but the thermal printer did not respond.
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Database Reassurance: Clarify token was safely created */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
              <span className="text-emerald-600 font-bold text-sm">✓</span>
              <div>
                <strong className="font-semibold text-emerald-950">Meal Token Recorded in Database:</strong>
                <p className="mt-0.5 text-emerald-800">
                  The food token has already been successfully registered for{' '}
                  <span className="font-bold text-slate-900">{generatedToken?.studentName || student?.name}</span> ({generatedToken?.studentId || student?.id}). The counter record is valid.
                </p>
              </div>
            </div>

            {/* Token Badge */}
            {generatedToken && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  Valid Token Number
                </div>
                <div className="text-2xl font-black font-mono text-indigo-950 tracking-wider">
                  {generatedToken.tokenNumber}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Session: <span className="font-bold uppercase text-slate-800">{generatedToken.session || currentMealSession}</span> · Issued: <span className="font-semibold">{formatISTTime(generatedToken.time)}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Retry Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSlipModalOpen(true)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🧾</span>
                  <span>View Token Slip</span>
                </button>
              </div>

              <button
                type="button"
                onClick={reset}
                className="w-full py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Print Again Later & Scan Next Student →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAIL-SAFE FALLBACK CARD (Guarantees screen is never blank if in any unhandled state) */}
      {!['idle', 'scanning', 'found-eligible', 'generating', 'token-generated', 'found-not-eligible', 'not-found', 'duplicate', 'printer-failure'].includes(state) && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 mx-auto flex items-center justify-center text-2xl font-bold mb-2">
            🔄
          </div>
          <div className="font-bold text-slate-800 text-base">Terminal Ready</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Terminal state ready for next student verification.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
          >
            Reset Scanner
          </button>
        </div>
      )}

      {/* Slip Modal Preview */}
      <TokenSlipModal
        isOpen={isSlipModalOpen}
        token={generatedToken}
        onClose={() => setIsSlipModalOpen(false)}
      />



    </div>
  );
}
