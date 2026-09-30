'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMealSession, getTodayISTDateString, formatISTDateDMY } from '@/utils/timeUtils';

type ScanStatus =
  | 'idle'
  | 'scanning'
  | 'verifying'
  | 'success'
  | 'duplicate'
  | 'ineligible'
  | 'not-found'
  | 'error'
  | 'food-list-added'
  | 'food-list-duplicate';

interface ScanResultData {
  tokenNumber?: string;
  studentName?: string;
  studentId?: string;
  department?: string;
  year?: number | string;
  session?: string;
  project?: string;
  message?: string;
}

// Module-level cached import promise to eliminate delay on camera start
let html5QrcodePromise: Promise<any> | null = null;
function getHtml5QrcodeModule() {
  if (!html5QrcodePromise && typeof window !== 'undefined') {
    html5QrcodePromise = import('html5-qrcode');
  }
  return html5QrcodePromise;
}

export default function MobileScanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading scanner engine...</p>
        </div>
      }
    >
      <MobileScanContent />
    </Suspense>
  );
}

function MobileScanContent() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get('mode') === 'intake' ? 'intake' : 'token';
  const urlDate = searchParams.get('date');
  const todayStr = getTodayISTDateString();

  const [scanMode, setScanMode] = useState<'token' | 'intake'>(urlMode);
  const [targetDate, setTargetDate] = useState<string>(() => urlDate || todayStr);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to start camera');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [resultData, setResultData] = useState<ScanResultData | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [sessionName] = useState(() => getMealSession());

  const scannerRef = useRef<any>(null);
  const isProcessingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const statusRef = useRef<ScanStatus>(status);
  const resultDataRef = useRef<ScanResultData | null>(resultData);
  const scanModeRef = useRef<'token' | 'intake'>(scanMode);
  const targetDateRef = useRef<string>(targetDate);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  useEffect(() => {
    statusRef.current = status;
    resultDataRef.current = resultData;
    scanModeRef.current = scanMode;
    targetDateRef.current = targetDate;
  }, [status, resultData, scanMode, targetDate]);

  // Synthesize audio feedback via Web Audio API (instant, no external file download)
  const playSound = useCallback((type: 'success' | 'warning' | 'error') => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(329.63, ctx.currentTime);
        osc.frequency.setValueAtTime(261.63, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  }, []);

  const triggerVibration = (pattern: number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const handleBarcodeDecoded = useCallback(
    async (decodedText: string) => {
      const cleanCode = decodedText.trim().toUpperCase();
      if (!cleanCode || isProcessingRef.current) return;

      // 1. Throttle repeat scanning of the exact same student within 2.5 seconds
      const now = Date.now();
      if (cleanCode === lastScannedCodeRef.current && now - lastScanTimeRef.current < 2500) {
        return;
      }

      lastScannedCodeRef.current = cleanCode;
      lastScanTimeRef.current = now;
      isProcessingRef.current = true;
      setStatus('verifying');
      setLastScannedCode(cleanCode);

      const currentMode = scanModeRef.current;
      setStatusMessage(
        currentMode === 'intake'
          ? `Adding ${cleanCode} to ${formatISTDateDMY(targetDateRef.current)} List...`
          : `Verifying ${cleanCode} for Token...`
      );

      try {
        const res = await fetch('/api/scan-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: cleanCode,
            mode: currentMode,
            date: targetDateRef.current,
          }),
        });

        const data = await res.json();

        // =====================================================================
        // MODE 1: FOOD LIST INTAKE RESPONSES (ZERO TOKENS GENERATED)
        // =====================================================================
        if (currentMode === 'intake') {
          if (data.status === 'FOOD_LIST_ADDED') {
            setStatus('food-list-added');
            setResultData({
              studentId: data.student?.id || cleanCode,
              studentName: data.student?.name || cleanCode,
              department: data.student?.department,
              year: data.student?.year,
              project: data.project,
              message: data.message,
            });
            setStatusMessage(`Added to Food List: ${data.student?.name || cleanCode}`);
            playSound('success');
            triggerVibration([100, 50, 100]);
          } else if (data.status === 'FOOD_LIST_DUPLICATE') {
            setStatus('food-list-duplicate');
            setResultData({
              studentId: data.student?.id || cleanCode,
              studentName: data.student?.name,
              project: data.project,
              message: data.message,
            });
            setStatusMessage(data.message || 'Already added to today’s food list');
            playSound('warning');
            triggerVibration([150, 80, 150]);
          } else if (data.status === 'NOT_FOUND') {
            setStatus('not-found');
            setResultData({
              studentId: cleanCode,
              message: data.message || 'Student Roll ID not found in database.',
            });
            setStatusMessage(data.message || 'Student not found in registry.');
            playSound('error');
            triggerVibration([300]);
          } else {
            setStatus('error');
            setResultData({
              studentId: cleanCode,
              message: data.message || 'Could not add student to food list.',
            });
            setStatusMessage(data.message || 'Failed to add student to food list.');
            playSound('error');
            triggerVibration([300]);
          }
          return;
        }

        // =====================================================================
        // MODE 2: TOKEN MODE RESPONSES
        // =====================================================================
        if (data.status === 'TOKEN_ISSUED') {
          setStatus('success');
          setResultData({
            tokenNumber: data.token?.tokenNumber,
            studentName: data.token?.studentName,
            studentId: data.token?.studentId,
            session: data.token?.session || sessionName,
            project: data.token?.project,
            message: data.message,
          });
          setStatusMessage(`Token ${data.token?.tokenNumber} Active · Ready for next scan`);
          playSound('success');
          triggerVibration([100, 50, 100]);
        } else if (data.status === 'DUPLICATE') {
          setStatus('duplicate');
          setResultData({
            tokenNumber: data.existingToken?.tokenNumber,
            studentName: data.student?.name,
            studentId: cleanCode,
            session: data.existingToken?.session || sessionName,
            message: data.message,
          });
          setStatusMessage(data.message || 'Token already issued for this session!');
          playSound('warning');
          triggerVibration([200, 100, 200]);
        } else if (data.status === 'INELIGIBLE') {
          setStatus('ineligible');
          setResultData({
            studentName: data.student?.name,
            studentId: cleanCode,
            message: data.message,
          });
          setStatusMessage(data.message || 'Student is not on today’s finalized food list.');
          playSound('error');
          triggerVibration([300]);
        } else {
          setStatus('not-found');
          setResultData({
            studentId: cleanCode,
            message: data.message || 'Student ID not found in database.',
          });
          setStatusMessage(data.message || 'Student ID not found in database.');
          playSound('error');
          triggerVibration([300]);
        }
      } catch (err) {
        console.error(err);
        setStatus('error');
        setStatusMessage('Network error submitting scan.');
        playSound('error');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [playSound, sessionName]
  );

  // Start Scanner directly with exact hardware deviceId from getCameras() without testStream collision
  const startScanner = useCallback(async () => {
    setCameraStarting(true);
    setPermissionDenied(false);
    setStatus('idle');
    setStatusMessage('Starting camera stream...');

    try {
      if (typeof window !== 'undefined' && window.isSecureContext === false && !navigator?.mediaDevices) {
        setStatus('error');
        setStatusMessage('HTTP Origin: Mobile browsers block camera on plain HTTP. Run "npm run tunnel" for HTTPS camera, or type Roll ID below to test.');
        setCameraStarting(false);
        return;
      }

      // 1. Complete teardown of previous instance and DOM cleanup to free camera HAL
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {}
        try {
          await scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      const container = document.getElementById('mobile-qr-reader');
      if (container) {
        container.innerHTML = '';
      }

      // 2. Load Html5Qrcode module
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await (getHtml5QrcodeModule() || import('html5-qrcode'));

      // 3. Request permissions and query hardware cameras directly
      let devices: any[] = [];
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (camErr: any) {
        console.warn('getCameras error:', camErr);
        const errName = camErr?.name || '';
        const errMsg = camErr?.message || String(camErr);
        if (errName === 'NotAllowedError' || errMsg.toLowerCase().includes('permission denied')) {
          setPermissionDenied(true);
          setStatus('error');
          setStatusMessage('Camera permission blocked. Tap lock icon in address bar to Allow.');
          setCameraStarting(false);
          return;
        }
      }

      const scannerId = 'mobile-qr-reader';
      const scanner = new Html5Qrcode(scannerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Native C++ BarcodeDetector on Chrome / Safari
        },
      });
      scannerRef.current = scanner;

      const config = {
        fps: 15,
        qrbox: undefined, // Scan full viewfinder area
      };

      const onScanSuccess = (decodedText: string) => {
        handleBarcodeDecoded(decodedText);
      };

      // 4. Start with exact back-camera hardware ID
      let started = false;
      if (devices && devices.length > 0) {
        const backCamera =
          devices.find((d: any) => {
            const label = (d.label || '').toLowerCase();
            return label.includes('back') || label.includes('rear') || label.includes('environment');
          }) || (devices.length > 1 ? devices[devices.length - 1] : devices[0]);

        try {
          await scanner.start(backCamera.id, config, onScanSuccess, () => {});
          started = true;
        } catch (idErr) {
          console.warn('Direct deviceId start failed, trying facingMode fallback:', idErr);
        }
      }

      // Fallback to facingMode if deviceId not available or failed
      if (!started) {
        await scanner.start(
          { facingMode: cameraFacing },
          config,
          onScanSuccess,
          () => {}
        );
      }

      // Ensure video element plays inline on mobile Safari/Chrome
      const videoEl = document.querySelector('#mobile-qr-reader video') as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.muted = true;
      }

      setCameraActive(true);
      setStatus('scanning');
      setStatusMessage('Camera active · Point at student ID card');
    } catch (err: any) {
      console.error('Camera init error:', err);
      const errName = err?.name || '';
      const errMsg = err?.message || String(err);
      setStatus('error');

      if (errName === 'NotAllowedError' || errMsg.toLowerCase().includes('permission denied')) {
        setPermissionDenied(true);
        setStatusMessage('Camera permission blocked. Tap lock icon in address bar to Allow.');
      } else {
        setStatusMessage(`Camera access error: ${errMsg || 'Ensure camera permissions are allowed'}`);
      }
    } finally {
      setCameraStarting(false);
    }
  }, [cameraFacing, handleBarcodeDecoded]);

  // Pre-warm module, check granted permission, and release camera on tab hide
  useEffect(() => {
    getHtml5QrcodeModule();

    // Auto-start if permission was already granted previously
    if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: 'camera' })
        .then((perm: any) => {
          if (perm.state === 'granted') {
            startScanner();
          }
        })
        .catch(() => {});
    }

    // Release camera hardware sensor immediately when user switches tabs or minimizes browser
    const handleVisibilityChange = () => {
      if (document.hidden && scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
          setCameraActive(false);
          setStatus('idle');
          setStatusMessage('Camera paused. Tap to start.');
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          scannerRef.current?.clear();
        });
      }
    };
  }, [startScanner]);

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const track = scannerRef.current.getRunningTrackCameraCapabilities?.();
      if (track?.torchFeature?.()) {
        await track.torchFeature().apply(!torchOn);
        setTorchOn(!torchOn);
      } else {
        const stream = (scannerRef.current as any)?.localMediaStream;
        const videoTrack = stream?.getVideoTracks()?.[0];
        if (videoTrack?.applyConstraints) {
          await videoTrack.applyConstraints({
            advanced: [{ torch: !torchOn } as any],
          });
          setTorchOn(!torchOn);
        }
      }
    } catch (e) {
      console.warn('Torch toggle not supported:', e);
    }
  };

  const flipCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'));
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-500 font-sans">
      {/* Top Header Bar */}
      <header className="p-3.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                scanMode === 'intake' ? 'bg-sky-400' : 'bg-emerald-400'
              }`}
            />
            <h1 className="font-bold text-xs tracking-wide text-white uppercase">
              {scanMode === 'intake' ? 'Food List Intake Scanner' : 'Mess Token Terminal'}
            </h1>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
            <span>Session: <strong className="text-amber-400 uppercase">{sessionName}</strong></span>
            <span>·</span>
            <span className={scanMode === 'intake' ? 'text-sky-400 font-semibold' : 'text-emerald-400 font-semibold'}>
              {scanMode === 'intake' ? 'Eligibility Desk' : 'Meal Token Issue'}
            </span>
          </div>
        </div>

        {/* Camera Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTorch}
            type="button"
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors ${
              torchOn
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Flashlight"
          >
            <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>
          <button
            onClick={flipCamera}
            type="button"
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
            title="Flip Camera"
          >
            <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 1.5.4 2.9 1.1 4.1L3 17h6v-6l-2.1 2.1C6.3 12.1 6 11.1 6 10c0-3.314 2.686-6 6-6s6 2.686 6 6c0 1.7-.7 3.2-1.8 4.2l1.4 1.4C19.1 14.1 20 12.2 20 10z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mode Switcher Banner */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
          <button
            onClick={() => {
              setScanMode('intake');
              setStatus('idle');
              setStatusMessage('Switched to Food List Intake Mode (Zero Tokens)');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'intake'
                ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📋</span>
            <span>Food List Mode</span>
          </button>

          <button
            onClick={() => {
              setScanMode('token');
              setStatus('idle');
              setStatusMessage('Switched to Meal Token Mode');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'token'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🎟️</span>
            <span>Meal Token Mode</span>
          </button>
        </div>

        <div className="mt-1.5 text-center">
          <span className="text-[10px] text-slate-400">
            {scanMode === 'intake' ? (
              <span className="text-sky-300">
                Scanned students are added to today’s food list.
              </span>
            ) : (
              <span className="text-emerald-300">
                ⚡ <strong>Mess Counter:</strong> Issues meal tokens for students already on the food list.
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Dynamic Target Food List Banner for Intake Mode */}
      {scanMode === 'intake' && (
        <div className="px-4 py-2.5 bg-sky-950/90 border-b border-sky-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <div>
              <div className="text-[10px] uppercase font-bold text-sky-300 tracking-wider">
                Intake Target List
              </div>
              <div className="font-bold text-white text-xs flex items-center gap-1.5 mt-0.5">
                <span>{formatISTDateDMY(targetDate)}</span>
                {targetDate === todayStr && (
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-semibold border border-emerald-500/30">
                    Today
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-sky-300 font-medium">Switch Date:</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => {
                if (e.target.value) setTargetDate(e.target.value);
              }}
              className="bg-slate-900 text-sky-200 border border-sky-700/80 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Main Viewfinder Center */}
      <main className="relative flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* html5-qrcode video viewport container */}
        <div className="relative w-full max-w-md aspect-3/4 sm:aspect-square rounded-3xl overflow-hidden border-2 border-slate-800 bg-black shadow-2xl">
          <div id="mobile-qr-reader" className="w-full h-full object-cover" />

          {/* Tap to Activate Camera Overlay */}
          {!cameraActive && (
            <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-6 text-center z-10">
              <button
                onClick={startScanner}
                disabled={cameraStarting}
                type="button"
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50 cursor-pointer mb-3 text-white ${
                  scanMode === 'intake'
                    ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-900/50'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50'
                }`}
              >
                {cameraStarting ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-8 h-8 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </button>

              <h4 className="text-white font-bold text-sm mb-1">
                {cameraStarting ? 'Starting Camera...' : 'Tap to Start Camera'}
              </h4>
              <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
                {permissionDenied
                  ? 'Camera permission was blocked. Tap the 🔒 lock icon in your address bar → Allow Camera, then retry.'
                  : 'Instant camera startup. Grant permission once and scan student barcodes.'}
              </p>

              {permissionDenied && (
                <button
                  onClick={startScanner}
                  type="button"
                  className="mt-3 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                >
                  ↻ Retry Permission
                </button>
              )}
            </div>
          )}

          {/* Viewfinder Overlay Reticle */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            <div
              className={`relative w-[92%] h-48 sm:h-44 border rounded-2xl ${
                scanMode === 'intake' ? 'border-sky-400/30' : 'border-emerald-400/30'
              }`}
            >
              <div
                className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl ${
                  scanMode === 'intake' ? 'border-sky-400' : 'border-emerald-400'
                }`}
              />
              <div
                className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl ${
                  scanMode === 'intake' ? 'border-sky-400' : 'border-emerald-400'
                }`}
              />
              <div
                className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl ${
                  scanMode === 'intake' ? 'border-sky-400' : 'border-emerald-400'
                }`}
              />
              <div
                className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-xl ${
                  scanMode === 'intake' ? 'border-sky-400' : 'border-emerald-400'
                }`}
              />

              {/* Animated Laser Scanning Beam */}
              {cameraActive && (status === 'scanning' || status === 'success' || status === 'food-list-added') && (
                <div
                  className={`absolute left-2 right-2 h-0.5 animate-laser ${
                    scanMode === 'intake'
                      ? 'bg-sky-400 shadow-[0_0_14px_#38bdf8]'
                      : 'bg-emerald-400 shadow-[0_0_14px_#34d399]'
                  }`}
                />
              )}
            </div>
            <div
              className={`mt-3 text-[11px] uppercase tracking-wider font-semibold bg-slate-950/85 px-3 py-1 rounded-full border shadow-sm ${
                scanMode === 'intake'
                  ? 'text-sky-300 border-sky-500/40'
                  : 'text-emerald-300 border-emerald-500/40'
              }`}
            >
              Whole Viewfinder Active · Aim at Student Barcode
            </div>
          </div>

          {/* DOCKED INTAKE CARD: Confirms student added to food list (NO TOKEN GENERATED) */}
          {status === 'food-list-added' && resultData && (
            <div className="absolute inset-x-0 bottom-0 p-4 bg-slate-950/95 backdrop-blur-md border-t border-sky-500/40 rounded-b-3xl text-center space-y-2.5 z-10 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  Added to Daily Food List
                </span>
                <span className="text-[10px] text-sky-300/80 font-mono">
                  Zero Tokens Issued ➔
                </span>
              </div>

              <div className="bg-sky-950/60 border border-sky-500/30 rounded-2xl py-2.5 px-3">
                <div className="text-[10px] uppercase tracking-widest text-sky-300 font-bold">STUDENT APPROVED FOR MESS</div>
                <div className="text-xl font-black text-white my-0.5 truncate">{resultData.studentName}</div>
                <div className="text-xs text-sky-200 font-mono">
                  ID: <strong className="text-white">{resultData.studentId}</strong>
                  {resultData.department ? ` · ${resultData.department}` : ''}
                </div>
                {resultData.project && (
                  <div className="mt-1 text-[11px] text-slate-300 font-medium">
                    Project: <span className="text-sky-300 font-semibold">{resultData.project}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[10px] text-slate-400 text-left">
                  Student is now eligible for mess token pickup
                </span>
                <button
                  onClick={() => {
                    setStatus('scanning');
                    setStatusMessage('Ready for next student ID barcode');
                  }}
                  type="button"
                  className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-[11px] rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Next Student ↗
                </button>
              </div>
            </div>
          )}

          {/* DOCKED TOKEN CARD: Holds generated meal token */}
          {status === 'success' && resultData && (
            <div className="absolute inset-x-0 bottom-0 p-4 bg-slate-950/95 backdrop-blur-md border-t border-emerald-500/40 rounded-b-3xl text-center space-y-2.5 z-10 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Meal Token Issued
                </span>
                <span className="text-[10px] text-emerald-300/80 font-mono">
                  Ready for next scan ➔
                </span>
              </div>

              <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-2xl py-2.5 px-3">
                <div className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">MEAL TOKEN NUMBER</div>
                <div className="text-3xl font-black font-mono tracking-wider text-white my-0.5">{resultData.tokenNumber}</div>
                <div className="text-sm font-bold text-emerald-100 truncate">{resultData.studentName}</div>
                <div className="text-xs text-emerald-300 font-mono mt-0.5">
                  ID: {resultData.studentId} · <span className="uppercase text-amber-300 font-bold">{resultData.session}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-slate-400 text-left">
                  Aim at next ID card to scan next student
                </span>
                <button
                  onClick={() => {
                    setStatus('scanning');
                    setStatusMessage('Point camera at student ID barcode');
                  }}
                  type="button"
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Full Camera ↗
                </button>
              </div>
            </div>
          )}

          {/* Result Card Overlay (For other non-docked states) */}
          {status !== 'scanning' && status !== 'idle' && status !== 'success' && status !== 'food-list-added' && (
            <div
              className={`absolute inset-0 p-6 flex flex-col items-center justify-center text-center backdrop-blur-md transition-all duration-300 ${
                status === 'duplicate' || status === 'food-list-duplicate'
                  ? 'bg-rose-950/90 text-rose-100'
                  : status === 'ineligible'
                  ? 'bg-amber-950/90 text-amber-100'
                  : status === 'verifying'
                  ? 'bg-slate-900/90 text-indigo-200'
                  : 'bg-slate-950/90 text-slate-200'
              }`}
            >
              {status === 'verifying' && (
                <div className="space-y-3">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="font-bold text-base">Processing with Server...</div>
                  <div className="text-xs text-indigo-300 font-mono">{lastScannedCode}</div>
                </div>
              )}

              {(status === 'duplicate' || status === 'food-list-duplicate') && resultData && (
                <div className="space-y-2">
                  <div className="w-14 h-14 bg-rose-500 text-white rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-lg">
                    !
                  </div>
                  <div className="text-xs uppercase tracking-widest font-bold text-rose-400">
                    {status === 'food-list-duplicate' ? 'ALREADY ON FOOD LIST' : 'DUPLICATE TOKEN SCAN'}
                  </div>
                  <div className="text-lg font-bold text-white">{resultData.studentName || resultData.studentId}</div>
                  <div className="text-xs text-rose-200 leading-relaxed px-2">{resultData.message}</div>
                  {resultData.tokenNumber && (
                    <div className="text-xs font-mono font-bold text-amber-300 mt-1">
                      Existing Token: {resultData.tokenNumber}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setStatus('scanning');
                      setStatusMessage('Point camera at student ID barcode');
                    }}
                    type="button"
                    className="mt-3 px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    Scan Next Student →
                  </button>
                </div>
              )}

              {status === 'ineligible' && resultData && (
                <div className="space-y-2">
                  <div className="w-14 h-14 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-lg">
                    ✕
                  </div>
                  <div className="text-xs uppercase tracking-widest font-bold text-amber-400">NOT ON TODAY’S FOOD LIST</div>
                  <div className="text-base font-bold text-white">{resultData.studentName || resultData.studentId}</div>
                  <div className="text-xs text-amber-200 leading-relaxed px-2">{resultData.message}</div>
                  <button
                    onClick={() => {
                      setStatus('scanning');
                      setStatusMessage('Point camera at student ID barcode');
                    }}
                    type="button"
                    className="mt-3 px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    Scan Next Student →
                  </button>
                </div>
              )}

              {(status === 'not-found' || status === 'error') && (
                <div className="space-y-2">
                  <div className="w-14 h-14 bg-slate-700 text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-lg">
                    ?
                  </div>
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-400">
                    {status === 'not-found' ? 'STUDENT NOT REGISTERED' : 'SCAN FAILED'}
                  </div>
                  <div className="text-sm font-semibold text-white px-2">{statusMessage}</div>
                  <div className="text-xs font-mono text-slate-400">{lastScannedCode}</div>
                  <button
                    onClick={() => {
                      setStatus('scanning');
                      setStatusMessage('Point camera at student ID barcode');
                    }}
                    type="button"
                    className="mt-3 px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold text-xs rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    Scan Next Student →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status pill under viewfinder */}
        <div className="mt-4 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-2 shadow-sm max-w-sm text-center">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              status === 'success' || status === 'food-list-added'
                ? 'bg-emerald-500'
                : status === 'duplicate' || status === 'food-list-duplicate'
                ? 'bg-rose-500'
                : status === 'ineligible'
                ? 'bg-amber-500'
                : 'bg-indigo-500 animate-pulse'
            }`}
          />
          <span className="truncate">{statusMessage}</span>
        </div>

        {/* Quick Manual Entry Fallback */}
        <div className="mt-3 w-full max-w-sm">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (manualInput.trim()) {
                handleBarcodeDecoded(manualInput.trim());
                setManualInput('');
              }
            }}
            className="flex gap-2"
          >
            <input
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder="Or type Roll ID (e.g. SEC24CS110)..."
              style={{ color: '#ffffff' }}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:opacity-50"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className={`px-3 py-2 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                scanMode === 'intake'
                  ? 'bg-sky-600 hover:bg-sky-500'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {scanMode === 'intake' ? '+ Add' : 'Issue'}
            </button>
          </form>
        </div>
      </main>

      {/* Global CSS to hide html5-qrcode's default white corner brackets */}
      <style jsx global>{`
        #mobile-qr-reader #qr-shaded-region {
          display: none !important;
        }
        #mobile-qr-reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>

      {/* Bottom Instructions Footer */}
      <footer className="p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-center">
        <div className="text-xs font-semibold text-slate-300">
          {scanMode === 'intake' ? '📋 Food List Mode Active' : '🎟️ Meal Token Terminal Active'}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {scanMode === 'intake'
            ? 'Scanning adds student to Daily Food List · Zero tokens generated'
            : 'Scanning generates meal tokens for eligible students'}
        </div>
      </footer>
    </div>
  );
}
