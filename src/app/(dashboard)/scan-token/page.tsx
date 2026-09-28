'use client';

import { useState, useEffect, useRef } from 'react';
import TokenPrintSlip from '@/components/TokenPrintSlip';
import { verifyStudentScan, issueFoodToken, type VerificationResult } from '@/actions/tokenActions';
import { getDailyFoodList, type FoodListDetails } from '@/actions/foodListActions';
import { getMealSession } from '@/utils/timeUtils';
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
}

export default function ScanToken() {
  const [scannedId, setScannedId] = useState('');
  const [state, setState] = useState<ScanState>('idle');
  const [student, setStudent] = useState<VerificationResult['student'] | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [generatedToken, setGeneratedToken] = useState<TokenDisplay | null>(null);
  const [todayStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [foodListInfo, setFoodListInfo] = useState<FoodListDetails | null>(null);
  const [dbStudents, setDbStudents] = useState<StudentRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDailyFoodList(todayStr).then(res => setFoodListInfo(res)).catch(() => {});
    getStudents().then(res => setDbStudents(res)).catch(() => {});
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mess Verification Terminal</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Scan student ID barcode/QR card or type Roll Number for food token
        </p>
      </div>

      {/* Food List Status Banner */}
      {foodListInfo && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between font-medium ${
          foodListInfo.status === 'Finalized'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${foodListInfo.status === 'Finalized' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>Daily Food Eligibility List ({todayStr}): <strong>{foodListInfo.status}</strong> ({foodListInfo.entries.length} students)</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px] uppercase">
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

          {/* Viewfinder Target Frame with Animated Red Laser */}
          <div className="relative w-full h-56 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center p-4">
            {/* Viewfinder Corner Reticles */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-400 rounded-tl" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-400 rounded-tr" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-400 rounded-bl" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-400 rounded-br" />

            {/* Animated Laser Beam */}
            <div className="absolute left-4 right-4 h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-laser" />

            {/* Center Barcode Scanner Icon */}
            <div className="text-slate-700 mb-2">
              <svg className="w-16 h-16 stroke-current stroke-[1.2] fill-none" viewBox="0 0 24 24">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="7" y="7" width="10" height="10" rx="1" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="text-sm font-semibold text-slate-300">Point Handheld Scanner or Swipe ID Card</div>
            <div className="text-xs text-slate-500 mt-1">Automatic detection active</div>
          </div>

          {/* Auto-focused Input Form for Scanner & Manual Typing */}
          <form onSubmit={handleVerifyForm} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={scannedId}
              onChange={(e) => setScannedId(e.target.value)}
              placeholder="SCAN BARCODE OR TYPE ROLL NO (E.G. 23CS101)..."
              className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 text-white rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase placeholder:text-slate-500"
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-white space-y-3">
          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-mono font-semibold text-amber-300">Verifying ID {scannedId}...</div>
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
    </div>
  );
}
