'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getMealSession } from '@/utils/timeUtils';

type ScanStatus = 'idle' | 'scanning' | 'verifying' | 'success' | 'duplicate' | 'ineligible' | 'not-found' | 'error';

interface ScanResultData {
  tokenNumber?: string;
  studentName?: string;
  studentId?: string;
  session?: string;
  project?: string;
  message?: string;
}

export default function MobileScanPage() {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Camera...');
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
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  useEffect(() => {
    statusRef.current = status;
    resultDataRef.current = resultData;
  }, [status, resultData]);

  // Synthesize audio feedback via Web Audio API
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
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }, []);

  const triggerVibration = (pattern: number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const handleBarcodeDecoded = useCallback(async (decodedText: string) => {
    const cleanCode = decodedText.trim().toUpperCase();
    if (!cleanCode || isProcessingRef.current) return;

    // 1. If currently displaying an active token for THIS SAME student, hold the screen and ignore repeat frames
    if (statusRef.current === 'success' && resultDataRef.current?.studentId === cleanCode) {
      return;
    }

    // 2. Throttle repeat scanning of the exact same code within 2 seconds
    const now = Date.now();
    if (cleanCode === lastScannedCodeRef.current && now - lastScanTimeRef.current < 2000) {
      return;
    }

    lastScannedCodeRef.current = cleanCode;
    lastScanTimeRef.current = now;
    isProcessingRef.current = true;
    setStatus('verifying');
    setLastScannedCode(cleanCode);
    setStatusMessage(`Verifying student ${cleanCode} with database...`);

    try {
      const res = await fetch('/api/scan-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: cleanCode }),
      });

      const data = await res.json();

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
  }, [playSound, sessionName]);

// Pre-warm scanner module in memory to eliminate download latency on tap
let html5QrcodePromise: Promise<any> | null = null;
function getHtml5QrcodeModule() {
  if (!html5QrcodePromise && typeof window !== 'undefined') {
    html5QrcodePromise = import('html5-qrcode');
  }
  return html5QrcodePromise;
}

  // Start Scanner with instant preloaded engine, 1080p HD, and native BarcodeDetector
  const startScanner = useCallback(async () => {
    setCameraStarting(true);
    setPermissionDenied(false);
    setStatus('idle');
    setStatusMessage('Starting camera stream...');

    try {
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setStatus('error');
        setStatusMessage('Insecure Context: Camera requires HTTPS or localhost.');
        setCameraStarting(false);
        return;
      }

      // 1. Instantly get pre-warmed library (0ms network delay)
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await (getHtml5QrcodeModule() || import('html5-qrcode'));

      // Clean up previous instance if running
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {}
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
          // Native hardware GPU acceleration on iOS Safari & Android Chrome
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = scanner;

      // 1080p Full HD camera constraints with continuous auto-focus for sharp ID barcode lines
      const cameraConstraints = {
        facingMode: { ideal: cameraFacing },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      };

      const config = {
        fps: 15, // Optimal 15 fps: silky smooth, zero CPU throttling, maximum decode accuracy
        qrbox: undefined, // Scans across full sensor view
        videoConstraints: cameraConstraints,
      };

      const onScanSuccess = (decodedText: string) => {
        handleBarcodeDecoded(decodedText);
      };

      // Try 1: High-definition continuous auto-focus rear camera
      try {
        await scanner.start(
          cameraConstraints,
          config,
          onScanSuccess,
          () => {}
        );
      } catch (err1) {
        console.warn('High-res start failed, falling back to basic facingMode:', err1);
        // Try 2: Standard facingMode fallback
        try {
          await scanner.start(
            { facingMode: cameraFacing },
            { fps: 15, qrbox: undefined },
            onScanSuccess,
            () => {}
          );
        } catch (err2) {
          // Try 3: Query device camera list
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCam = cameras.find((c: any) =>
              (c.label || '').toLowerCase().includes('back') ||
              (c.label || '').toLowerCase().includes('rear') ||
              (c.label || '').toLowerCase().includes('environment')
            ) || cameras[cameras.length - 1];
            await scanner.start(backCam.id, config, onScanSuccess, () => {});
          } else {
            await scanner.start({ facingMode: 'user' }, config, onScanSuccess, () => {});
          }
        }
      }

      setCameraActive(true);
      setStatus('scanning');
      setStatusMessage('Camera active · Point at ID barcode');
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

  // Pre-warm scanner on mount; avoid auto-start on mobile to prevent OS gesture permission hang
  useEffect(() => {
    // Pre-warm scanner module in memory immediately
    getHtml5QrcodeModule();

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      // Auto-start on desktop only
      startScanner();
    }

    return () => {
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
        // Fallback using direct stream track
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
      <header className="p-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="font-bold text-sm tracking-wide text-white">SAIRAM INCUBATION SCANNER</h1>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
            <span>Session: <strong className="text-amber-400 uppercase">{sessionName}</strong></span>
            <span>·</span>
            <span>Mobile Verifier</span>
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

      {/* Main Viewfinder Center */}
      <main className="relative flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* html5-qrcode video viewport container - spacious 3:4 aspect */}
        <div className="relative w-full max-w-md aspect-[3/4] sm:aspect-square rounded-3xl overflow-hidden border-2 border-slate-800 bg-black shadow-2xl">
          <div id="mobile-qr-reader" className="w-full h-full object-cover" />

          {/* Tap to Activate Camera Overlay (If not active yet or needs user gesture) */}
          {!cameraActive && (
            <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-6 text-center z-10">
              <button
                onClick={startScanner}
                disabled={cameraStarting}
                type="button"
                className="w-16 h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50 cursor-pointer mb-3"
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
                  ? 'Camera permission was blocked. Tap the 🔒 lock icon in your browser address bar → Allow Camera, then tap here to retry.'
                  : 'Tap the button above to grant camera permission and start scanning.'}
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

          {/* Viewfinder Overlay Reticle - Spacious Wide Guide */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            <div className="relative w-[92%] h-48 sm:h-44 border border-emerald-400/25 rounded-2xl">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

              {/* Animated Laser Scanning Beam */}
              {cameraActive && (status === 'scanning' || status === 'success') && (
                <div className="absolute left-2 right-2 h-0.5 bg-rose-500 shadow-[0_0_14px_#f43f5e] animate-laser" />
              )}
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-wider font-semibold text-emerald-300 bg-slate-950/80 px-3 py-1 rounded-full border border-emerald-500/40 shadow-sm">
              Whole Screen Active · Hold ID Card Anywhere
            </div>
          </div>

          {/* DOCKED TOKEN CARD: Holds the generated token on screen until next scan while camera stays live */}
          {status === 'success' && resultData && (
            <div className="absolute inset-x-0 bottom-0 p-4 bg-slate-950/95 backdrop-blur-md border-t border-emerald-500/40 rounded-b-3xl text-center space-y-2.5 z-10 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Token Generated · Active
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

          {/* Result Card Overlay (For other non-success states) */}
          {status !== 'scanning' && status !== 'idle' && status !== 'success' && (
            <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center text-center backdrop-blur-md transition-all duration-300 ${
              status === 'duplicate' ? 'bg-rose-950/90 text-rose-100' :
              status === 'ineligible' ? 'bg-amber-950/90 text-amber-100' :
              status === 'verifying' ? 'bg-slate-900/90 text-indigo-200' :
              'bg-slate-950/90 text-slate-200'
            }`}>
              {status === 'verifying' && (
                <div className="space-y-3">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="font-bold text-base">Verifying with Database...</div>
                  <div className="text-xs text-indigo-300 font-mono">{lastScannedCode}</div>
                </div>
              )}

              {status === 'duplicate' && resultData && (
                <div className="space-y-2">
                  <div className="w-14 h-14 bg-rose-500 text-white rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-lg">
                    !
                  </div>
                  <div className="text-xs uppercase tracking-widest font-bold text-rose-400">DUPLICATE SCAN</div>
                  <div className="text-lg font-bold text-white">{resultData.studentName}</div>
                  <div className="text-xs text-rose-200 leading-relaxed px-2">{resultData.message}</div>
                  <div className="text-xs font-mono font-bold text-amber-300 mt-1">Existing: {resultData.tokenNumber}</div>
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
                  <div className="text-xs uppercase tracking-widest font-bold text-amber-400">NOT ELIGIBLE TODAY</div>
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
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-400">SCAN FAILED</div>
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
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            status === 'success' ? 'bg-emerald-500' :
            status === 'duplicate' ? 'bg-rose-500' :
            status === 'ineligible' ? 'bg-amber-500' :
            'bg-indigo-500 animate-pulse'
          }`} />
          <span className="truncate">{statusMessage}</span>
        </div>

        {/* Quick Manual Entry Fallback */}
        <div className="mt-3 w-full max-w-sm">
          <form
            onSubmit={(e) => {
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
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Verify
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
      <footer className="p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 text-center">
        <div className="text-xs font-medium text-slate-300">
          Point camera at Student ID Badge QR Code
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Scan from your laptop screen PDF or printed card
        </div>
      </footer>
    </div>
  );
}
