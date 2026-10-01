'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Badge from '@/components/Badge';
import FoodRequestLetterModal from '@/components/FoodRequestLetterModal';
import TokenPrintSlip from '@/components/TokenPrintSlip';
import {
  getDailyFoodList,
  addStudentToDailyList,
  addBulkStudentsToDailyList,
  removeStudentFromDailyList,
  getDatewiseFoodLogs,
  getNightStayBatchAudit,
  scanStudentIntoDailyFoodList,
  type FoodListDetails,
  type FoodListEntry,
  type DatewiseLogSummary,
  type NightStayBatchAuditDetails,
} from '@/actions/foodListActions';
import { getFoodTokens } from '@/actions/tokenActions';
import { getStudents, getProjects, getDashboardBundle, type StudentRecord, type ProjectRecord } from '@/actions/studentActions';
import { getTodayISTDateString, getNextISTDateString, formatISTDateDMY, formatISTTime } from '@/utils/timeUtils';

type ActiveTab = 'list' | 'tokens' | 'logs';

interface CachedDailyFoodListPayload {
  date: string;
  list: FoodListDetails;
  students: StudentRecord[];
  projects: ProjectRecord[];
  tokens: any[];
  timestamp: number;
}

// Module-level in-memory cache that persists across Next.js client-side route transitions
const globalDateCache = new Map<string, FoodListDetails>();
let globalStudentsCache: StudentRecord[] = [];
let globalProjectsCache: ProjectRecord[] = [];
let globalTokensCache: any[] = [];

function getInitialWorkingDate(searchParams: { get: (k: string) => string | null }, todayStr: string): string {
  // 1. Check URL query param ?date=YYYY-MM-DD
  const dateParam = searchParams.get('date');
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return dateParam;
  }
  // 2. Check sessionStorage
  if (typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem('active_food_list_date');
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        return saved;
      }
    } catch {}
  }
  // 3. Fallback to today
  return todayStr;
}

function getInitialFoodListData(targetDate: string): {
  list: FoodListDetails;
  students: StudentRecord[];
  projects: ProjectRecord[];
  tokens: any[];
} {
  // 1. Check in-memory global cache (survives client-side page transitions in 0ms)
  if (globalDateCache.has(targetDate)) {
    return {
      list: globalDateCache.get(targetDate)!,
      students: globalStudentsCache,
      projects: globalProjectsCache,
      tokens: globalTokensCache,
    };
  }

  // 2. Check sessionStorage for foodlist cache
  if (typeof window !== 'undefined') {
    try {
      const storedFoodList = sessionStorage.getItem('incubation_foodlist_cache');
      if (storedFoodList) {
        const parsed = JSON.parse(storedFoodList);
        if (parsed && parsed.date === targetDate && parsed.list) {
          globalDateCache.set(targetDate, parsed.list);
          if (parsed.students?.length) globalStudentsCache = parsed.students;
          if (parsed.projects?.length) globalProjectsCache = parsed.projects;
          if (parsed.tokens?.length) globalTokensCache = parsed.tokens;
          return {
            list: parsed.list,
            students: globalStudentsCache,
            projects: globalProjectsCache,
            tokens: globalTokensCache,
          };
        }
      }

      // 3. Fallback to dashboard cache (if user was on dashboard, data is already ready!)
      const storedDashboard = sessionStorage.getItem('incubation_dashboard_cache');
      if (storedDashboard) {
        const parsed = JSON.parse(storedDashboard);
        if (parsed && parsed.date === targetDate) {
          const list: FoodListDetails = parsed.foodList || {
            date: targetDate,
            status: 'Draft',
            finalizedBy: null,
            finalizedAt: null,
            entries: [],
          };
          globalDateCache.set(targetDate, list);
          if (parsed.students?.length) globalStudentsCache = parsed.students;
          if (parsed.projects?.length) globalProjectsCache = parsed.projects;
          if (parsed.tokens?.length) globalTokensCache = parsed.tokens;
          return {
            list,
            students: globalStudentsCache,
            projects: globalProjectsCache,
            tokens: globalTokensCache,
          };
        }
      }
    } catch (e) {
      console.error('Session cache read error:', e);
    }
  }

  // 4. Default instant empty draft (0ms load time, never block on spinner)
  const defaultList: FoodListDetails = {
    date: targetDate,
    status: 'Draft',
    finalizedBy: null,
    finalizedAt: null,
    entries: [],
  };
  globalDateCache.set(targetDate, defaultList);
  return {
    list: defaultList,
    students: globalStudentsCache,
    projects: globalProjectsCache,
    tokens: globalTokensCache,
  };
}

export default function DailyFoodListPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-slate-500">Loading food list & tokens...</p>
        </div>
      }
    >
      <DailyFoodListContent />
    </Suspense>
  );
}

function DailyFoodListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const todayStr = useMemo(() => getTodayISTDateString(), []);
  const initialDate = useMemo(() => getInitialWorkingDate(searchParams, todayStr), [searchParams, todayStr]);
  const initialData = useMemo(() => getInitialFoodListData(initialDate), [initialDate]);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'tokens') return 'tokens';
    if (tabParam === 'logs') return 'logs';
    return 'list';
  });

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [currentList, setCurrentList] = useState<FoodListDetails>(() => initialData.list);
  const [studentRegistry, setStudentRegistry] = useState<StudentRecord[]>(() => initialData.students);
  const [projectRegistry, setProjectRegistry] = useState<ProjectRecord[]>(() => initialData.projects);
  // Never show a blocking full-page loading spinner if initial shell exists!
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tokens state
  const [tokens, setTokens] = useState<any[]>(() => initialData.tokens);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [tokenDateFilter, setTokenDateFilter] = useState<string>(initialDate);
  const [tokenSessionFilter, setTokenSessionFilter] = useState('ALL');
  const [selectedPrintToken, setSelectedPrintToken] = useState<any | null>(null);

  // Datewise logs state
  const [datewiseLogs, setDatewiseLogs] = useState<DatewiseLogSummary[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedBatchAudit, setSelectedBatchAudit] = useState<NightStayBatchAuditDetails | null>(null);
  const [batchAuditLoading, setBatchAuditLoading] = useState(false);
  const [showBatchAuditModal, setShowBatchAuditModal] = useState(false);

  // Modals state for daily list
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);

  // Dedicated Hardware Barcode Scanner State (<5ms instant UI)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('incubation_scanner_sound');
      return saved !== 'false';
    }
    return true;
  });
  const [lastScannedStudent, setLastScannedStudent] = useState<{
    studentId: string;
    studentName: string;
    time: string;
  } | null>(null);
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('incubation_scanner_sound', String(next));
      }
      return next;
    });
  };

  const selectedDateRef = useRef<string>(selectedDate);
  const currentCountRef = useRef<number>(currentList?.entries.length || 0);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    currentCountRef.current = currentList?.entries.length || 0;
  }, [currentList]);

  const [searchId, setSearchId] = useState('');
  const [foundStudent, setFoundStudent] = useState<StudentRecord | null | 'not-found'>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [bulkProject, setBulkProject] = useState('');
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [toast, setToast] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // Play subtle feedback chime (respects soundEnabled toggle)
  const playChime = useCallback((type: 'success' | 'warning' | 'error') => {
    if (!soundEnabled) return;
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
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(349.23, ctx.currentTime);
        osc.frequency.setValueAtTime(261.63, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  }, [soundEnabled]);

  // Sync tab with URL while preserving selectedDate
  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'list') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    if (selectedDate && selectedDate !== todayStr) {
      params.set('date', selectedDate);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
  };

  // Load master student & project registries ONCE on mount (cached in memory)
  useEffect(() => {
    let isMounted = true;
    if (globalStudentsCache.length === 0 || globalProjectsCache.length === 0) {
      Promise.all([getStudents(), getProjects()])
        .then(([students, projects]) => {
          if (isMounted) {
            globalStudentsCache = students;
            globalProjectsCache = projects;
            setStudentRegistry(students);
            setProjectRegistry(projects);
          }
        })
        .catch(err => console.error('Registry load error:', err));
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Lightning-fast food list loader (<30ms, or 0ms from client cache)
  const loadData = useCallback(async (date: string, isBackground = false) => {
    const cached = globalDateCache.get(date);
    if (cached) {
      if (selectedDateRef.current === date) {
        setCurrentList(cached);
      }
      isBackground = true;
    } else if (!isBackground) {
      setLoading(true);
    }

    if (isBackground) {
      setIsRefreshing(true);
    }

    try {
      const list = await getDailyFoodList(date);
      globalDateCache.set(date, list);
      if (selectedDateRef.current === date) {
        setCurrentList(list);
      }

      // Persist to session storage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(
            'incubation_foodlist_cache',
            JSON.stringify({
              date,
              list,
              students: globalStudentsCache,
              projects: globalProjectsCache,
              tokens: globalTokensCache,
              timestamp: Date.now(),
            })
          );
        } catch {}
      }
    } catch (e) {
      console.error(e);
      if (!isBackground) {
        showToast('Failed to load food list data from server.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load Tokens data
  const loadTokens = useCallback(async (date?: string) => {
    setTokensLoading(true);
    try {
      const data = await getFoodTokens(date || undefined);
      globalTokensCache = data;
      setTokens(data);
    } catch (e) {
      console.error('Error fetching tokens:', e);
    } finally {
      setTokensLoading(false);
    }
  }, []);

  // Load Datewise Logs data
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const logs = await getDatewiseFoodLogs();
      setDatewiseLogs(logs);
    } catch (e) {
      console.error('Error loading logs:', e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Load detailed student-level audit for a night stay batch
  const openBatchAudit = useCallback(async (date: string) => {
    setBatchAuditLoading(true);
    setShowBatchAuditModal(true);
    try {
      const details = await getNightStayBatchAudit(date);
      setSelectedBatchAudit(details);
    } catch (e) {
      console.error(e);
      showToast('Error loading batch audit details.');
    } finally {
      setBatchAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    selectedDateRef.current = selectedDate;

    // Persist active working date to sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('active_food_list_date', selectedDate);
      } catch {}

      // Synchronize browser URL query param without triggering full component remount
      const params = new URLSearchParams(window.location.search);
      if (selectedDate === todayStr) {
        params.delete('date');
      } else {
        params.set('date', selectedDate);
      }
      const query = params.toString();
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }

    // Automatically sync tokens subtab date filter to active working date
    setTokenDateFilter(selectedDate);

    const hasCached = globalDateCache.has(selectedDate);
    if (hasCached) {
      const cached = globalDateCache.get(selectedDate)!;
      setCurrentList(cached);
      setLoading(false);
      loadData(selectedDate, true);
    } else {
      loadData(selectedDate, false);
    }
  }, [selectedDate, todayStr, loadData]);

  useEffect(() => {
    if (activeTab === 'tokens') {
      loadTokens(tokenDateFilter);
    }
  }, [activeTab, tokenDateFilter, loadTokens]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, loadLogs]);

  // Adaptive 2-second Micro-Poll to sync multi-operator list updates in background
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (document.hidden) return;
      const targetDate = selectedDateRef.current;
      const knownCount = currentCountRef.current;

      try {
        const res = await fetch(`/api/food-list-sync?date=${targetDate}&knownCount=${knownCount}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.changed && data.entries) {
          const updated: FoodListDetails = {
            date: targetDate,
            status: data.status || 'Draft',
            finalizedBy: data.finalizedBy || null,
            finalizedAt: data.finalizedAt || null,
            entries: data.entries,
          };

          globalDateCache.set(targetDate, updated);
          if (selectedDateRef.current === targetDate) {
            setCurrentList(updated);
            setLoading(false);
          }
        }
      } catch {}
    }, 2000);

    return () => clearInterval(pollInterval);
  }, []);

  // Process Quick Scan with Instant In-Memory Optimistic UI Insertion (<5ms)
  const processQuickScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;

      // 1. Instant duplicate check in currentList (<0.1ms)
      const currentEntries = currentList?.entries || [];
      if (currentEntries.some(e => e.studentId.toUpperCase() === code)) {
        playChime('warning');
        showToast(`ℹ️ Student ${code} is already on today's food list.`);
        return;
      }

      // 2. Instant institutional registry verification (<0.1ms)
      const student =
        studentRegistry.find(s => s.id.toUpperCase() === code) ||
        globalStudentsCache.find(s => s.id.toUpperCase() === code);

      const proj = projectRegistry.find(p => p.members.some(m => m.studentId.toUpperCase() === code));
      const projectCode = proj?.code || 'INC-GENERAL';
      const projectName = proj?.name || 'Incubation Member';

      // 3. Instant Optimistic UI Update (<5ms)
      const newEntry: FoodListEntry = {
        studentId: student?.id || code,
        studentName: student?.name || code,
        department: student?.department || '—',
        year: student?.year || 0,
        projectCode,
        projectName,
        addedBy: 'Barcode Scanner Gun',
        status: 'Eligible',
      };

      setCurrentList(prev => {
        const existing = prev?.entries || [];
        if (existing.some(e => e.studentId.toUpperCase() === code)) return prev;
        const updated: FoodListDetails = {
          date: selectedDate,
          status: (prev?.status || 'Draft') as 'Draft' | 'Finalized',
          finalizedBy: prev?.finalizedBy || null,
          finalizedAt: prev?.finalizedAt || null,
          entries: [newEntry, ...existing],
        };
        globalDateCache.set(selectedDate, updated);
        return updated;
      });

      // Visual & Audio feedback
      setHighlightedStudentId(code);
      setTimeout(() => setHighlightedStudentId(null), 2500);

      const scanTimeStr = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastScannedStudent({
        studentId: student?.id || code,
        studentName: student?.name || code,
        time: scanTimeStr,
      });

      playChime('success');
      showToast(`⚡ Scanned: ${student?.name || code} approved for food list!`);

      // 4. Background DB persistence
      try {
        const res = await scanStudentIntoDailyFoodList(code, selectedDate, 'Barcode Gun');
        if (!res.success && !res.alreadyAdded) {
          // Revert optimistic insertion if invalid student or server error
          setCurrentList(prev => {
            if (!prev) return prev;
            const filtered = prev.entries.filter(e => e.studentId !== code);
            const reverted = { ...prev, entries: filtered };
            globalDateCache.set(selectedDate, reverted);
            return reverted;
          });
          playChime('error');
          showToast(`❌ ${res.message}`);
        }
      } catch (err) {
        console.error('Background scan error:', err);
      }
    },
    [selectedDate, currentList, studentRegistry, projectRegistry, playChime]
  );

  // Global Hardware USB / Bluetooth Barcode Gun Scanner Listener with Smart Burst Detection
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();
    let isBurstScan = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only listen when on Daily Food List tab
      if (activeTab !== 'list') return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Barcode scanners transmit characters with very short delay (<45ms)
      if (timeDiff < 45 && buffer.length > 0) {
        isBurstScan = true;
      } else if (timeDiff > 120) {
        isBurstScan = false;
        buffer = '';
      }

      const target = e.target as HTMLElement;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      // If user is typing normally in an input field (slow typing > 60ms), let it type normally!
      if (isInput && !isBurstScan && timeDiff > 60) {
        return;
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          if (isInput) (target as HTMLInputElement).blur();
          const scannedCode = buffer.trim().toUpperCase();
          buffer = '';
          isBurstScan = false;
          processQuickScan(scannedCode);
        } else {
          buffer = '';
          isBurstScan = false;
        }
        return;
      }

      if (e.key.length === 1) {
        if (isBurstScan && isInput) {
          // Prevent barcode gun burst from polluting focused input field
          e.preventDefault();
        }
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTab, processQuickScan]);



  // Daily list actions
  const searchStudent = () => {
    const query = searchId.trim().toUpperCase();
    const s = studentRegistry.find(st => st.id.toUpperCase() === query);
    if (!s) {
      setFoundStudent('not-found');
      return;
    }
    setFoundStudent(s);
    const proj = projectRegistry.find(p => p.members.some(m => m.studentId === s.id));
    setSelectedProject(proj?.code || projectRegistry[0]?.code || 'AGRI-01');
  };

  const handleAddStudent = async () => {
    if (!foundStudent || foundStudent === 'not-found') return;
    if (currentList?.entries.some(e => e.studentId === foundStudent.id)) {
      showToast(`Student ${foundStudent.id} is already in the list for ${selectedDate}.`);
      setShowAddStudent(false);
      setFoundStudent(null);
      setSearchId('');
      return;
    }

    const res = await addStudentToDailyList(selectedDate, foundStudent.id, selectedProject || 'AGRI-01');
    if (res.success) {
      showToast(res.message);
      setShowAddStudent(false);
      setFoundStudent(null);
      setSearchId('');
      await loadData(selectedDate);
    } else {
      showToast(res.message);
    }
  };

  const handleRemoveEntry = async (studentId: string) => {
    const res = await removeStudentFromDailyList(selectedDate, studentId);
    if (res.success) {
      showToast(res.message);
      await loadData(selectedDate);
    } else {
      showToast(res.message);
    }
  };

  const bulkProjectMembers = bulkProject
    ? (projectRegistry
        .find(p => p.code === bulkProject)
        ?.members.map(m => studentRegistry.find(s => s.id === m.studentId))
        .filter(Boolean) as StudentRecord[] ?? [])
    : [];

  const handleAddBulkStudents = async () => {
    if (bulkSelected.length === 0 || !bulkProject) return;
    const res = await addBulkStudentsToDailyList(selectedDate, bulkSelected, bulkProject);
    showToast(res.message);
    setBulkSelected([]);
    setBulkProject('');
    setShowBulkAdd(false);
    await loadData(selectedDate);
  };

  // Pagination & Search states for 100+ student handling
  const [foodListPage, setFoodListPage] = useState(1);
  const [foodListPageSize, setFoodListPageSize] = useState<number>(20);
  const [foodListSearch, setFoodListSearch] = useState('');

  // Reset pagination when date or search query changes
  useEffect(() => {
    setFoodListPage(1);
  }, [selectedDate, foodListSearch]);

  const [tokensPage, setTokensPage] = useState(1);
  const TOKENS_PAGE_SIZE = 10;

  useEffect(() => {
    setTokensPage(1);
  }, [tokenSearch, tokenDateFilter, tokenSessionFilter]);

  // Instant in-memory search for Daily Food List across all fields (<0.5ms)
  const filteredFoodListEntries = useMemo(() => {
    const raw = currentList?.entries || [];
    if (!foodListSearch.trim()) return raw;
    const q = foodListSearch.trim().toLowerCase();
    return raw.filter(
      e =>
        e.studentId.toLowerCase().includes(q) ||
        e.studentName.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        (e.projectName || e.projectCode || '').toLowerCase().includes(q)
    );
  }, [currentList?.entries, foodListSearch]);

  const foodListEntries = filteredFoodListEntries;
  const foodListTotalPages = Math.ceil(foodListEntries.length / foodListPageSize) || 1;
  const foodListStartIndex = (foodListPage - 1) * foodListPageSize;
  const paginatedFoodList = foodListEntries.slice(foodListStartIndex, foodListStartIndex + foodListPageSize);

  // Smart pagination helper to prevent button overflow with 10+ pages
  const getVisiblePageNumbers = (current: number, total: number): (number | string)[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  // Filtered tokens
  const filteredTokens = tokens.filter(t => {
    const q = tokenSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      t.tokenNumber?.toLowerCase().includes(q) ||
      t.studentId?.toLowerCase().includes(q) ||
      t.studentName?.toLowerCase().includes(q) ||
      t.project?.toLowerCase().includes(q);

    const matchSession =
      tokenSessionFilter === 'ALL' || (t.session || '').toUpperCase() === tokenSessionFilter;

    return matchSearch && matchSession;
  });

  const tokensTotalPages = Math.ceil(filteredTokens.length / TOKENS_PAGE_SIZE) || 1;
  const tokensStartIndex = (tokensPage - 1) * TOKENS_PAGE_SIZE;
  const paginatedTokens = filteredTokens.slice(tokensStartIndex, tokensStartIndex + TOKENS_PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Thermal Receipt Print Slip Portal */}
      <TokenPrintSlip token={selectedPrintToken} />

      {/* Page Title & Top Navigation Tabs */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Food Management</h1>
            <p className="text-sm text-slate-500 mt-1">
              Approve student mess eligibility, monitor live issued tokens, and export verified records.
            </p>
          </div>

          {/* Segmented Subtab Switcher */}
          <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 self-start sm:self-auto">
            <button
              onClick={() => switchTab('list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>▤</span>
              <span>Daily Food List</span>
              {currentList && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700">
                  {currentList.entries.length}
                </span>
              )}
            </button>

            <button
              onClick={() => switchTab('tokens')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'tokens'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>▣</span>
              <span>Food Tokens</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {tokens.length}
              </span>
            </button>

            <button
              onClick={() => switchTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📅</span>
              <span>Datewise Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY FOOD LIST (ELIGIBILITY & MESS APPROVAL)                       */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Hardware Barcode Scanner Banner */}
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="font-bold text-emerald-950 text-sm">Hardware Barcode Scanner Active</strong>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-200/80 text-emerald-900 border border-emerald-300">
                    Hands-Free Ready
                  </span>
                </div>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  Point and scan any student barcode card directly. Keystrokes are captured automatically with instant verification.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lastScannedStudent && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Last: {lastScannedStudent.studentName} ({lastScannedStudent.studentId})</span>
                </div>
              )}

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

          {/* Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {selectedDate === todayStr ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  Today
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full transition-colors cursor-pointer"
                  title="Jump to Today's Food List"
                >
                  Jump to Today
                </button>
              )}

              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Open & Dynamic List</span>
              </span>

              {isRefreshing && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-500 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"></span>
                  <span>Syncing...</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowBulkAdd(true)}
                className="border border-indigo-300 text-indigo-700 text-sm px-3.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium cursor-pointer"
              >
                + Add by Project
              </button>
              <button
                onClick={() => setShowAddStudent(true)}
                className="bg-indigo-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium shadow-xs cursor-pointer"
              >
                + Add Student
              </button>

              <button
                onClick={() => {
                  if (!currentList || currentList.entries.length === 0) {
                    showToast('No students added yet for this date. Please add students first.');
                    return;
                  }
                  setShowLetterModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
                title="Generate and download official PDF request letter for college mess"
              >
                <svg className="w-4 h-4 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Mess Letter (PDF)
              </button>

              {/* Enhanced CSV Export Button */}
              <a
                href={`/api/reports/export?type=foodlist&date=${selectedDate}&format=csv`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
                title="Export cleanly formatted CSV compatible with Excel (No ##### date overflow)"
              >
                <span>📥</span>
                <span>Export CSV</span>
              </a>
            </div>
          </div>

          {/* Batch Headcount & Summary Metrics Strip for 100+ Students */}
          {currentList && currentList.entries.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-900 text-sm">{currentList.entries.length}</span>
                  <span className="font-medium text-slate-500">Students Approved</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-indigo-700">{new Set(currentList.entries.map(e => e.department)).size}</span>
                  <span className="text-slate-500">Departments</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sky-700">{new Set(currentList.entries.map(e => e.projectName || e.projectCode)).size}</span>
                  <span className="text-slate-500">Active Projects</span>
                </div>
              </div>

              {foodListSearch && (
                <div className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-lg">
                  Showing {filteredFoodListEntries.length} of {currentList.entries.length} matches
                </div>
              )}
            </div>
          )}

          {/* Search & Density Controls Toolbar */}
          {currentList && currentList.entries.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <input
                  type="text"
                  value={foodListSearch}
                  onChange={e => setFoodListSearch(e.target.value)}
                  placeholder="Search student roll no, name, department, or project..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-800 placeholder:text-slate-400"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                {foodListSearch && (
                  <button
                    type="button"
                    onClick={() => setFoodListSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 cursor-pointer"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <label className="font-semibold text-slate-500">Rows per page:</label>
                  <select
                    value={foodListPageSize}
                    onChange={e => {
                      setFoodListPageSize(Number(e.target.value));
                      setFoodListPage(1);
                    }}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>All ({currentList.entries.length})</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Students Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading food list for {selectedDate}...
              </div>
            ) : !currentList || currentList.entries.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">🍽️</div>
                <div className="font-medium text-slate-700">No students in food list for this date</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Scan student ID cards using a USB gun or webcam, or click &ldquo;+ Add Student&rdquo; above.
                </p>
              </div>
            ) : filteredFoodListEntries.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <div className="text-2xl mb-2">🔍</div>
                <div className="font-semibold text-slate-800">No students match &ldquo;{foodListSearch}&rdquo;</div>
                <p className="text-xs text-slate-400 mt-1">Try searching by roll number, name, department, or project code.</p>
                <button
                  type="button"
                  onClick={() => setFoodListSearch('')}
                  className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Clear Search Filter
                </button>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-3 text-center w-14">S.No</th>
                        <th className="px-4 py-3">Roll No / ID</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Dept & Year</th>
                        <th className="px-4 py-3">Incubation Project</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedFoodList.map((entry, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors duration-500 ${
                            highlightedStudentId === entry.studentId
                              ? 'bg-emerald-100/90 ring-2 ring-emerald-400 font-semibold shadow-xs'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-3 py-3 text-center text-xs text-slate-500 font-medium">
                            {foodListStartIndex + idx + 1}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                            {entry.studentId}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {entry.studentName}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {entry.department} {entry.year ? `· Yr ${entry.year}` : ''}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {entry.projectName || entry.projectCode}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge status="Eligible" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveEntry(entry.studentId)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tab 1 Pagination Controls */}
                {foodListEntries.length > 0 && (
                  <div className="px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
                    <div>
                      Showing <span className="font-semibold text-slate-800">{foodListEntries.length > 0 ? foodListStartIndex + 1 : 0}</span> to{' '}
                      <span className="font-semibold text-slate-800">{Math.min(foodListStartIndex + foodListPageSize, foodListEntries.length)}</span> of{' '}
                      <span className="font-semibold text-slate-800">{foodListEntries.length}</span> students
                      {foodListSearch && (
                        <span className="ml-1 text-slate-400">
                          (filtered from {currentList?.entries.length || 0})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={foodListPage === 1}
                        onClick={() => setFoodListPage(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        ← Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {getVisiblePageNumbers(foodListPage, foodListTotalPages).map((p, i) =>
                          p === '...' ? (
                            <span key={`dots-${i}`} className="px-1 text-slate-400">...</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setFoodListPage(Number(p))}
                              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                foodListPage === p
                                  ? 'bg-indigo-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-200/70'
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        disabled={foodListPage >= foodListTotalPages}
                        onClick={() => setFoodListPage(p => Math.min(foodListTotalPages, p + 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ISSUED FOOD TOKENS (WITH REALTIME FILTER, SEARCH & THERMAL PRINT)   */}
      {/* ========================================================================= */}
      {activeTab === 'tokens' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={tokenSearch}
                onChange={e => setTokenSearch(e.target.value)}
                placeholder="Search token #, roll no, name, project…"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 bg-white"
              />

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={tokenDateFilter}
                  onChange={e => setTokenDateFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                {tokenDateFilter && (
                  <button
                    onClick={() => setTokenDateFilter('')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1.5 cursor-pointer font-medium"
                  >
                    Show All Dates
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Session Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                {(['ALL', 'BREAKFAST', 'LUNCH', 'DINNER'] as const).map(sess => (
                  <button
                    key={sess}
                    onClick={() => setTokenSessionFilter(sess)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      tokenSessionFilter === sess
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sess === 'ALL' ? 'All Sessions' : sess}
                  </button>
                ))}
              </div>

              {/* Export Tokens CSV Button */}
              <a
                href={`/api/reports/export?type=tokens&date=${tokenDateFilter || 'all'}&session=${tokenSessionFilter}&format=csv`}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
                title="Export token audit CSV cleanly formatted for Excel"
              >
                <span>📥</span>
                <span>Export CSV</span>
              </a>
            </div>
          </div>

          {/* Tokens Count & Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {filteredTokens.length} Token{filteredTokens.length !== 1 ? 's' : ''} Generated
                {tokenDateFilter ? ` for ${formatISTDateDMY(tokenDateFilter)}` : ' (All Dates)'}
              </h3>
              <span className="text-xs text-slate-400">
                Sorted by most recent issue time
              </span>
            </div>

            {tokensLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading tokens...
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">🎫</div>
                <div className="font-medium text-slate-700">No food tokens found</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No tokens have been issued matching the selected date and filters. Scan student ID cards at the mess terminal to issue tokens.
                </p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-3 text-center w-14">S.No</th>
                        <th className="px-4 py-3">Token Number</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Roll No / ID</th>
                        <th className="px-4 py-3">Dept & Year</th>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Session</th>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTokens.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-3 text-center text-xs text-slate-500 font-medium">
                            {tokensStartIndex + idx + 1}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-indigo-700 text-xs">
                            {t.tokenNumber}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {t.studentName}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">
                            {t.studentId}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {t.department} {t.year ? `· ${t.year}` : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                              {t.project}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                (t.session || '').toLowerCase().includes('breakfast')
                                  ? 'bg-amber-100 text-amber-800'
                                  : (t.session || '').toLowerCase().includes('lunch')
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {t.session}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatISTDateDMY(t.date)} · {formatISTTime(t.issuedAt || t.time)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedPrintToken(t)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                            >
                              View Slip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tab 2 Pagination Controls */}
                {filteredTokens.length > 0 && (
                  <div className="px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
                    <div>
                      Showing <span className="font-semibold text-slate-800">{filteredTokens.length > 0 ? tokensStartIndex + 1 : 0}</span> to{' '}
                      <span className="font-semibold text-slate-800">{Math.min(tokensStartIndex + TOKENS_PAGE_SIZE, filteredTokens.length)}</span> of{' '}
                      <span className="font-semibold text-slate-800">{filteredTokens.length}</span> tokens
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={tokensPage === 1}
                        onClick={() => setTokensPage(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        ← Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: tokensTotalPages }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setTokensPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              tokensPage === p
                                ? 'bg-indigo-700 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-200/70'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <button
                        disabled={tokensPage === tokensTotalPages}
                        onClick={() => setTokensPage(p => Math.min(tokensTotalPages, p + 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DATEWISE HISTORICAL LOGS & AUDIT                                   */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
                <span>📊</span>
                <span>Mess Turnout &amp; Food Token Audit</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Accurately tracking the 3-meal night-stay cycle (Dinner → Breakfast → Lunch) per incubation cohort.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={loadLogs}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              >
                ↻ Refresh
              </button>

              <a
                href="/api/reports/export?type=logs&format=csv"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <span>📥</span>
                <span>Export CSV</span>
              </a>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {logsLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                Analyzing historical night-stay cohorts...
              </div>
            ) : datewiseLogs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl mb-3">📅</div>
                <div className="font-medium text-slate-700">No historical logs found</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Night-stay food lists and issued token logs will appear here automatically.
                </p>
              </div>
            ) : (
              /* NIGHT-STAY COHORT AUDIT (DINNER -> BREAKFAST -> LUNCH) */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Night-Stay Batch</th>
                      <th className="px-4 py-3">Shift Status</th>
                      <th className="px-4 py-3 text-center">Diners Approved</th>
                      <th className="px-4 py-3 text-center">Meal 1: Dinner</th>
                      <th className="px-4 py-3 text-center">Meal 2: Breakfast</th>
                      <th className="px-4 py-3 text-center">Meal 3: Lunch</th>
                      <th className="px-4 py-3">Cycle Turnout</th>
                      <th className="px-4 py-3 text-right">Audit &amp; Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datewiseLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span>{formatISTDateDMY(log.date)} Stay</span>
                            {log.date === todayStr && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                                Tonight
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                            Dinner ({formatISTDateDMY(log.date)}) → B&apos;fast &amp; Lunch ({formatISTDateDMY(log.nextDate)})
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              log.cycleStatus === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : log.cycleStatus === 'In Progress'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {log.cycleStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                          {log.totalEligible}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold font-mono">
                            {log.dinnerCount} / {log.totalEligible}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold font-mono">
                            {log.breakfastCount} / {log.totalEligible}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-semibold font-mono">
                            {log.lunchCount} / {log.totalEligible}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                              <div
                                className="bg-indigo-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, log.turnoutPercentage)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                              {log.turnoutPercentage}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({log.totalMealsServed}/{log.maxPossibleMeals})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openBatchAudit(log.date)}
                            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          >
                            <span>📋</span>
                            <span>Batch Audit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS & OVERLAYS                                                         */}
      {/* ========================================================================= */}

      {/* 1. Night Stay Batch Student-Level Audit Modal */}
      {showBatchAuditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>🌙</span>
                  <span>Night-Stay Cohort Audit: {selectedBatchAudit ? formatISTDateDMY(selectedBatchAudit.date) : 'Loading...'}</span>
                </h3>
                {selectedBatchAudit && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cycle: Dinner ({formatISTDateDMY(selectedBatchAudit.date)}) → Breakfast &amp; Lunch ({formatISTDateDMY(selectedBatchAudit.nextDate)})
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBatchAuditModal(false);
                  setSelectedBatchAudit(null);
                }}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {batchAuditLoading ? (
                <div className="py-20 text-center text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Loading student-level batch attendance...
                </div>
              ) : !selectedBatchAudit ? (
                <div className="py-16 text-center text-slate-500">
                  No audit details found for this batch.
                </div>
              ) : (
                <>
                  {/* Summary KPI Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approved Diners</div>
                      <div className="text-lg font-black text-slate-900 mt-0.5">{selectedBatchAudit.totalEligible}</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Meal 1: Dinner</div>
                      <div className="text-lg font-black text-purple-900 mt-0.5">
                        {selectedBatchAudit.dinnerCount} / {selectedBatchAudit.totalEligible}
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Meal 2: Breakfast</div>
                      <div className="text-lg font-black text-amber-900 mt-0.5">
                        {selectedBatchAudit.breakfastCount} / {selectedBatchAudit.totalEligible}
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Meal 3: Lunch</div>
                      <div className="text-lg font-black text-emerald-900 mt-0.5">
                        {selectedBatchAudit.lunchCount} / {selectedBatchAudit.totalEligible}
                      </div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                      <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Cycle Turnout</div>
                      <div className="text-lg font-black text-indigo-900 mt-0.5">
                        {selectedBatchAudit.turnoutPercentage}%
                      </div>
                    </div>
                  </div>

                  {/* Student Attendance Roster Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">Roll ID</th>
                          <th className="px-3 py-2.5">Student Name</th>
                          <th className="px-3 py-2.5">Project</th>
                          <th className="px-3 py-2.5 text-center">Meal 1: Dinner</th>
                          <th className="px-3 py-2.5 text-center">Meal 2: Breakfast</th>
                          <th className="px-3 py-2.5 text-center">Meal 3: Lunch</th>
                          <th className="px-3 py-2.5 text-center">Meals Claimed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {selectedBatchAudit.students.map((st, sIdx) => (
                          <tr key={st.studentId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 text-slate-400 font-mono">{sIdx + 1}</td>
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{st.studentId}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{st.studentName}</td>
                            <td className="px-3 py-2.5 font-mono text-indigo-700">{st.projectCode}</td>
                            <td className="px-3 py-2.5 text-center">
                              {st.dinner.issued ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold text-[11px]">
                                  <span>✓</span>
                                  <span>{st.dinner.time || 'Claimed'}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {st.breakfast.issued ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[11px]">
                                  <span>✓</span>
                                  <span>{st.breakfast.time || 'Claimed'}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {st.lunch.issued ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                                  <span>✓</span>
                                  <span>{st.lunch.time || 'Claimed'}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  st.mealsClaimed === 3
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : st.mealsClaimed > 0
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {st.mealsClaimed} / 3 Meals
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Official attendance record of Sri Sairam Techno Incubator Foundation
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowBatchAuditModal(false);
                  setSelectedBatchAudit(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 3. Add Single Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 text-lg">Add Student to Daily Food List</h3>
            <p className="text-xs text-slate-500">
              Enter college student roll ID (e.g. SEC24CS110 or 23CS101) to verify eligibility.
            </p>
            <div className="flex gap-2">
              <input
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchStudent()}
                placeholder="Student Roll No / ID..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                autoFocus
              />
              <button
                onClick={searchStudent}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>

            {foundStudent === 'not-found' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                Student ID not found in system registry. Please register student first.
              </div>
            )}

            {foundStudent && foundStudent !== 'not-found' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="font-medium text-slate-800 text-sm">{foundStudent.name}</div>
                <div className="text-slate-500 font-mono">
                  ID: {foundStudent.id} | {foundStudent.department} Yr {foundStudent.year}
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Assign Project:</label>
                  <select
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {projectRegistry.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowAddStudent(false);
                  setFoundStudent(null);
                  setSearchId('');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={!foundStudent || foundStudent === 'not-found'}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Confirm Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Bulk Add by Project Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-lg">Add All Project Members</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select an incubation project to batch-add all members.
              </p>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Select Incubation Project:
                </label>
                <select
                  value={bulkProject}
                  onChange={e => {
                    setBulkProject(e.target.value);
                    const members =
                      projectRegistry.find(p => p.code === e.target.value)?.members ?? [];
                    setBulkSelected(members.map(m => m.studentId));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Project --</option>
                  {projectRegistry.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {p.name} ({p.members.length} members)
                    </option>
                  ))}
                </select>
              </div>

              {bulkProject && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">Select Members:</span>
                    <button
                      onClick={() =>
                        setBulkSelected(
                          bulkSelected.length === bulkProjectMembers.length
                            ? []
                            : bulkProjectMembers.map(s => s.id)
                        )
                      }
                      className="text-xs text-indigo-600 hover:underline cursor-pointer"
                    >
                      {bulkSelected.length === bulkProjectMembers.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2.5">
                    {bulkProjectMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">
                        No registered members in this project.
                      </p>
                    ) : (
                      bulkProjectMembers.map(s => {
                        const alreadyIn = currentList?.entries.some(e => e.studentId === s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={bulkSelected.includes(s.id)}
                              onChange={e => {
                                if (e.target.checked) setBulkSelected(prev => [...prev, s.id]);
                                else setBulkSelected(prev => prev.filter(id => id !== s.id));
                              }}
                              className="accent-indigo-600 rounded"
                            />
                            <span className="font-mono text-indigo-700 font-semibold">{s.id}</span>
                            <span className="text-slate-800 font-medium">{s.name}</span>
                            <span className="text-slate-400">({s.department})</span>
                            {alreadyIn && (
                              <span className="ml-auto text-[10px] text-amber-600 font-medium">
                                Already on list
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowBulkAdd(false);
                  setBulkProject('');
                  setBulkSelected([]);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBulkStudents}
                disabled={!bulkProject || bulkSelected.length === 0}
                className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Add {bulkSelected.length} Student{bulkSelected.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Official Food Request Letter Modal */}
      <FoodRequestLetterModal
        isOpen={showLetterModal}
        onClose={() => setShowLetterModal(false)}
        foodDate={selectedDate}
        projectsList={Array.from(
          new Set(
            (currentList?.entries ?? [])
              .map(entry => entry.projectName || entry.projectCode)
              .filter(Boolean)
          )
        )}
        studentsList={(currentList?.entries ?? []).map(entry => ({
          studentId: entry.studentId,
          name: entry.studentName,
        }))}
      />

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl z-50 border border-slate-700 max-w-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
