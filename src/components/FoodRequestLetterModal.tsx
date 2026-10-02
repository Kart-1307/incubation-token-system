'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLetterMealSessionCounts } from '@/actions/foodListActions';
import { formatDepartmentShort, formatYearRoman } from '@/utils/departmentUtils';

export interface StudentInfo {
  studentId: string;
  name: string;
  department?: string;
  year?: number | string;
}

interface FoodRequestLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  foodDate: string;
  studentsList: StudentInfo[];
  projectsList?: string[];
}

export interface LetterDocState {
  date: string;
  fromName: string;
  fromRollNo: string;
  fromCollege: string;
  fromLocation: string;
  recipientTitle: string;
  recipientCollege: string;
  recipientLocation: string;
  subject: string;
  salutation: string;
  involvedProjects: string;
  bodyText: string;
  signOffText: string;
  page2Title: string;
  page2Subtitle: string;
  studentsList: StudentInfo[];
  breakfastCount?: number | string;
  lunchCount?: number | string;
  dinnerCount?: number | string;
}

const STORAGE_KEY = 'incubation_letter_draft';

export default function FoodRequestLetterModal({
  isOpen,
  onClose,
  foodDate,
  studentsList,
  projectsList = [],
}: FoodRequestLetterModalProps) {
  const [viewMode, setViewMode] = useState<'both' | 'page1' | 'page2'>('both');
  const [isEditMode, setIsEditMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  // Format date as DD/MM/YY (matching handwritten letter style: 23/09/26, 29/09/26)
  let formattedDate = foodDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(foodDate)) {
    const [y, m, d] = foodDate.split('-');
    formattedDate = `${d}/${m}/${y.slice(2)}`;
  }

  const formatBody = (projects: string, date: string) => {
    const p = projects.trim() || '____________________';
    return `Our Incubation teams has involved in ${p}, So, i request you to give permission for night stay on ${date}. I also request you to provide food tokens. The student's list is attached with this letter.`;
  };

  const defaultProjects = Array.isArray(projectsList) && projectsList.length > 0
    ? projectsList.join(', ')
    : '';

  // Generate initial default document state matching the physical handwritten letter
  const buildDefaultDoc = (dateStr: string = formattedDate): LetterDocState => ({
    date: dateStr,
    fromName: '',
    fromRollNo: '',
    fromCollege: 'Sri Sai Ram Engineering College',
    fromLocation: 'Chennai – 44',
    recipientTitle: 'The Principal',
    recipientCollege: 'Sri Sai Ram Engineering College',
    recipientLocation: 'Chennai -44',
    subject: `sub: Request for Night stay in Incubation on ${dateStr}`,
    salutation: 'Respected Sir,',
    involvedProjects: defaultProjects,
    bodyText: formatBody(defaultProjects, dateStr),
    signOffText: 'Yours Truly,',
    page2Title: 'List of Students Requiring Food Arrangement',
    page2Subtitle: `Food Date: ${dateStr}   |   Total Students: ${studentsList.length}`,
    studentsList: studentsList.map(s => ({ ...s })),
    breakfastCount: 0,
    lunchCount: 0,
    dinnerCount: studentsList.length,
  });

  const [letterDoc, setLetterDoc] = useState<LetterDocState>(() => buildDefaultDoc());

  useEffect(() => {
    setMounted(true);
  }, []);

  // When modal opens, load saved persistent draft from localStorage and fetch current meal session counts
  useEffect(() => {
    if (!isOpen) return;

    try {
      localStorage.removeItem('incubation_food_letter_doc_v3');
      localStorage.removeItem('incubation_food_letter_doc');
      sessionStorage.removeItem('incubation_food_letter_doc_v3');

      const stored = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<LetterDocState>;
        const mergedProjects = parsed.involvedProjects !== undefined
          ? parsed.involvedProjects
          : defaultProjects;

        const savedName = parsed.fromName && parsed.fromName !== 'Karthikeyan S' ? parsed.fromName : '';
        const savedRollNo = parsed.fromRollNo && parsed.fromRollNo !== 'SEC24CS110' ? parsed.fromRollNo : '';

        const merged: LetterDocState = {
          date: formattedDate,
          fromName: savedName,
          fromRollNo: savedRollNo,
          fromCollege: parsed.fromCollege || 'Sri Sai Ram Engineering College',
          fromLocation: parsed.fromLocation || 'Chennai – 44',
          recipientTitle: parsed.recipientTitle || 'The Principal',
          recipientCollege: parsed.recipientCollege || 'Sri Sai Ram Engineering College',
          recipientLocation: parsed.recipientLocation || 'Chennai -44',
          subject: `Sub: Request for Night stay in Incubation on ${formattedDate}`,
          salutation: parsed.salutation || 'Respected Sir,',
          involvedProjects: mergedProjects,
          bodyText: parsed.bodyText && !parsed.bodyText.includes('has involved in .')
            ? parsed.bodyText
            : formatBody(mergedProjects, formattedDate),
          signOffText: parsed.signOffText || 'Yours Truly,',
          page2Title: parsed.page2Title || 'List of Students Requiring Food Arrangement',
          page2Subtitle: `Food Date: ${formattedDate}   |   Total Students: ${studentsList.length}`,
          studentsList: studentsList.length > 0 ? studentsList.map(s => ({ ...s })) : (parsed.studentsList || []),
          breakfastCount: parsed.breakfastCount !== undefined ? parsed.breakfastCount : 0,
          lunchCount: parsed.lunchCount !== undefined ? parsed.lunchCount : 0,
          dinnerCount: parsed.dinnerCount !== undefined ? parsed.dinnerCount : studentsList.length,
        };

        if (parsed.fromName === 'Karthikeyan S' || parsed.fromRollNo === 'SEC24CS110') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }

        setLetterDoc(merged);

        // Fetch live counts for letter date in background
        getLetterMealSessionCounts(foodDate).then(counts => {
          setLetterDoc(curr => {
            const updated = {
              ...curr,
              breakfastCount: curr.breakfastCount !== undefined && curr.breakfastCount !== '' && curr.breakfastCount !== 0 ? curr.breakfastCount : counts.breakfastConsumed,
              lunchCount: curr.lunchCount !== undefined && curr.lunchCount !== '' && curr.lunchCount !== 0 ? curr.lunchCount : counts.lunchConsumed,
              dinnerCount: curr.dinnerCount !== undefined && curr.dinnerCount !== '' && curr.dinnerCount !== 0 ? curr.dinnerCount : (counts.dinnerToConsume || studentsList.length),
            };
            return updated;
          });
        }).catch(console.error);

        return;
      }
    } catch { }

    const freshDoc = buildDefaultDoc(formattedDate);
    setLetterDoc(freshDoc);

    // Fetch live counts
    getLetterMealSessionCounts(foodDate).then(counts => {
      setLetterDoc(curr => ({
        ...curr,
        breakfastCount: counts.breakfastConsumed,
        lunchCount: counts.lunchConsumed,
        dinnerCount: counts.dinnerToConsume || studentsList.length,
      }));
    }).catch(console.error);
  }, [isOpen, foodDate]);

  // Persist draft updates to localStorage immediately
  const persistDraft = (nextState: LetterDocState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch { }
  };

  const updateField = <K extends keyof LetterDocState>(field: K, value: LetterDocState[K]) => {
    setLetterDoc(prev => {
      const next = { ...prev, [field]: value };
      persistDraft(next);
      return next;
    });
  };

  const handleNameChange = (val: string) => {
    updateField('fromName', val);
  };

  const handleRollNoChange = (val: string) => {
    updateField('fromRollNo', val);
  };

  const handleProjectsChange = (val: string) => {
    setLetterDoc(prev => {
      const next: LetterDocState = {
        ...prev,
        involvedProjects: val,
        bodyText: formatBody(val, prev.date),
      };
      persistDraft(next);
      return next;
    });
  };

  const updateStudentRow = (index: number, field: 'name' | 'studentId' | 'department' | 'year', value: string) => {
    setLetterDoc(prev => {
      const nextList = [...prev.studentsList];
      nextList[index] = { ...nextList[index], [field]: value };
      const next = {
        ...prev,
        studentsList: nextList,
        page2Subtitle: `Food Date: ${prev.date}   |   Total Students: ${nextList.length}`,
      };
      persistDraft(next);
      return next;
    });
  };

  const handleAddStudentRow = () => {
    setLetterDoc(prev => {
      const nextList = [...prev.studentsList, { name: 'Student Name', studentId: 'SEC000', department: 'CSE', year: 'IV' }];
      const next = {
        ...prev,
        studentsList: nextList,
        page2Subtitle: `Food Date: ${prev.date}   |   Total Students: ${nextList.length}`,
      };
      persistDraft(next);
      return next;
    });
  };

  const handleDeleteStudentRow = (index: number) => {
    setLetterDoc(prev => {
      const nextList = prev.studentsList.filter((_, i) => i !== index);
      const next = {
        ...prev,
        studentsList: nextList,
        page2Subtitle: `Food Date: ${prev.date}   |   Total Students: ${nextList.length}`,
      };
      persistDraft(next);
      return next;
    });
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset this letter back to standard institutional defaults?')) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      } catch { }
      const fresh = buildDefaultDoc(formattedDate);
      setLetterDoc(fresh);
      persistDraft(fresh);
    }
  };

  if (!isOpen) return null;

  // Handle PDF Generation
  const handleDownloadPdf = async () => {
    if (letterDoc.studentsList.length === 0) {
      setErrorMessage('No students in list. Please add at least one student before downloading the PDF.');
      return;
    }
    setErrorMessage('');
    const { generateFoodRequestLetterPdf } = await import('../utils/generateFoodLetterPdf');
    generateFoodRequestLetterPdf(
      letterDoc.fromName,
      letterDoc.fromRollNo,
      letterDoc.involvedProjects,
      letterDoc.date,
      letterDoc.studentsList,
      letterDoc
    );
  };

  const handlePrint = () => {
    window.print();
  };

  // Dedicated 2-page print document portal (rendered directly in body to avoid modal overflow/fixed clipping)
  const printableDocument = (
    <div id="food-letter-printable" className="hidden print:block text-slate-900 bg-white">
      {/* PAGE 1 (PRINT) - Official Letter */}
      <div className="print-page-1">
        <div>
          {/* Date */}
          <div className="text-right text-sm font-serif mb-6 pt-2">
            <span className="font-semibold">DATE:</span> {letterDoc.date}
          </div>

          {/* FROM & TO */}
          <div className="space-y-6 text-sm font-serif leading-relaxed mb-6">
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">FROM,</div>
              <div className="font-bold text-base">{letterDoc.fromName || '____________________'}</div>
              {letterDoc.fromRollNo && <div className="font-mono text-xs">{letterDoc.fromRollNo}</div>}
              <div>{letterDoc.fromCollege}</div>
              <div>{letterDoc.fromLocation}</div>
            </div>

            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">TO,</div>
              <div className="font-semibold">{letterDoc.recipientTitle}</div>
              <div>{letterDoc.recipientCollege}</div>
              <div>{letterDoc.recipientLocation}</div>
            </div>
          </div>

          {/* SUBJECT */}
          <div className="text-sm font-serif my-5">
            <span>{letterDoc.subject}</span>
          </div>

          {/* LETTER BODY */}
          <div className="space-y-4 text-sm font-serif leading-relaxed text-justify">
            <div className="font-bold">{letterDoc.salutation}</div>
            <p className="leading-relaxed whitespace-pre-line">
              {letterDoc.bodyText}
            </p>
          </div>

          {/* SIGN OFF */}
          <div className="mt-16 text-sm font-serif flex flex-col items-end">
            <div className="text-right">
              <div>{letterDoc.signOffText}</div>
              <div className="h-14"></div>
              <div className="font-bold text-base">{letterDoc.fromName || '____________________'}</div>
              {letterDoc.fromRollNo && (
                <div className="text-xs font-mono">{letterDoc.fromRollNo}</div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-xs font-serif text-slate-400 pt-6">Page 1 of 2</div>
      </div>

      {/* PAGE 2 (PRINT) - Student Table */}
      <div className="print-page-2">
        <div>
          <div className="text-center mb-6 pt-4">
            <h2 className="text-base font-bold font-serif uppercase tracking-wide text-slate-900">
              {letterDoc.page2Title}
            </h2>
            <p className="text-xs font-serif text-slate-500 mt-1">
              {letterDoc.page2Subtitle}
            </p>
          </div>

          {/* Compact Centered 5-Column Table */}
          <table className="max-w-xl mx-auto w-full text-xs font-sans border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 text-slate-900">
                <th className="border border-slate-400 px-2 py-1.5 w-12 text-center font-bold">S.no</th>
                <th className="border border-slate-400 px-3 py-1.5 text-left font-bold">Name</th>
                <th className="border border-slate-400 px-3 py-1.5 w-32 text-center font-bold">College ID</th>
                <th className="border border-slate-400 px-2 py-1.5 w-24 text-center font-bold">Dept</th>
                <th className="border border-slate-400 px-2 py-1.5 w-16 text-center font-bold">Year</th>
              </tr>
            </thead>
            <tbody>
              {letterDoc.studentsList.map((st, idx) => (
                <tr key={`${st.studentId}-${idx}`} className="border-b border-slate-300">
                  <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-600 font-medium">{idx + 1}</td>
                  <td className="border border-slate-400 px-3 py-1.5 font-medium text-slate-800">{st.name}</td>
                  <td className="border border-slate-400 px-3 py-1.5 text-center font-bold text-slate-900 font-sans tracking-wider text-[11px]">
                    {st.studentId}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-slate-700 text-xs">
                    {formatDepartmentShort(st.department)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-slate-700 text-xs">
                    {formatYearRoman(st.year)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Meal Consumption Summary (B, L, D) */}
          <div className="mt-8 pt-4 border-t border-slate-300 max-w-xl mx-auto">
            <div className="text-xs font-serif font-bold text-slate-900 mb-2">
              Meal Consumption Summary:
            </div>
            <div className="space-y-1.5 text-xs font-serif text-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm w-10">B –</span>
                <span className="font-bold text-sm">{letterDoc.breakfastCount ?? 0}</span>
                <span className="text-slate-500 text-[11px]">(Breakfast consumed already)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm w-10">L –</span>
                <span className="font-bold text-sm">{letterDoc.lunchCount ?? 0}</span>
                <span className="text-slate-500 text-[11px]">(Lunch consumed already)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm w-10">D –</span>
                <span className="font-bold text-sm">{letterDoc.dinnerCount ?? letterDoc.studentsList.length}</span>
                <span className="text-slate-500 text-[11px]">(Dinner to be consumed tonight)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-xs font-serif text-slate-400 pt-6">Page 2 of 2</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Portal to document.body so window.print() is not constrained by fixed or overflow styles */}
      {mounted && typeof document !== 'undefined' && createPortal(printableDocument, document.body)}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
        {/* Main UI Modal (hidden during window.print) */}
        <div className="print:hidden bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

          {/* Top Dark Header with Field-Wise Inputs (Exactly as afternoon photo media_1790691392417.png) */}
          <div className="bg-slate-900 border-b border-indigo-900/60 p-4 sm:p-5 text-white shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    OFFICIAL DOCUMENT
                  </span>
                  <span className="text-xs text-slate-300">Night Stay Permission & Food Tokens Request</span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">Food Request Letter Generator</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 3 Dedicated Top Input Fields: Representative Name, Roll No / ID, Involved Incubation Projects */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Representative Name
                </label>
                <input
                  type="text"
                  value={letterDoc.fromName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter representative name"
                  className="w-full bg-white text-slate-900 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Roll No / Student ID
                </label>
                <input
                  type="text"
                  value={letterDoc.fromRollNo}
                  onChange={(e) => handleRollNoChange(e.target.value)}
                  placeholder="Enter Roll No / Student ID"
                  className="w-full bg-white text-slate-900 px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Involved Incubation Projects
                </label>
                <input
                  type="text"
                  value={letterDoc.involvedProjects}
                  onChange={(e) => handleProjectsChange(e.target.value)}
                  placeholder="Enter involved incubation projects"
                  className="w-full bg-white text-slate-900 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Action & View Mode Toolbar */}
          <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Left: View Mode Pills */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Preview:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('both')}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${viewMode === 'both' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Both Pages
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('page1')}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${viewMode === 'page1' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Page 1 (Letter)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('page2')}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${viewMode === 'page2' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Page 2 (Table)
                </button>
              </div>
            </div>

            {/* Right: Universal Edit Toggle & Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border ${isEditMode
                    ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                title="Toggle in-place text editing on any part of the letter"
              >
                <span>{isEditMode ? '✓ Done Editing' : '✏️ Edit Letter (Any Part)'}</span>
              </button>

              {isEditMode && (
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 transition cursor-pointer"
                  title="Reset all letter and table contents back to default"
                >
                  ↺ Reset
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>🖨️ Print Letter</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>📥 Download PDF</span>
              </button>
            </div>
          </div>

          {/* Active In-Place Editing Instructions Banner */}
          {isEditMode && (
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-semibold">In-Place Document Editing Mode Active:</span>
                <span>Click directly on any text, subject, body paragraph, or table cell on the letter below to customize.</span>
              </div>
              <button
                onClick={() => setIsEditMode(false)}
                className="font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer text-xs"
              >
                Done
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-xs text-rose-700 font-medium">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Scrollable Document Canvas Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/90 flex flex-col items-center gap-8">

            {/* ========================================================= */}
            {/* A4 PAGE 1: OFFICIAL REQUEST LETTER */}
            {/* ========================================================= */}
            {(viewMode === 'both' || viewMode === 'page1') && (
              <div className="w-full max-w-[210mm] bg-white rounded-sm shadow-xl p-8 sm:p-14 font-serif text-slate-900 border border-slate-300 relative min-h-[297mm] flex flex-col justify-between select-text">
                <div>
                  {/* Date (Right aligned: "DATE: DD/MM/YY") */}
                  <div className="text-right text-sm mb-6 pt-2 font-serif flex justify-end items-center gap-1">
                    <span className="font-semibold">DATE:</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={letterDoc.date}
                        onChange={(e) => updateField('date', e.target.value)}
                        placeholder="DD/MM/YY"
                        className="bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-2 py-0.5 text-right font-serif text-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                        style={{ width: '110px' }}
                      />
                    ) : (
                      <span>{letterDoc.date}</span>
                    )}
                  </div>

                  {/* FROM & TO Sections */}
                  <div className="space-y-6 text-sm font-serif leading-relaxed mb-6">
                    {/* FROM Section */}
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">FROM,</div>
                      {isEditMode ? (
                        <div className="space-y-1 max-w-sm">
                          <input
                            type="text"
                            value={letterDoc.fromName}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Representative Name"
                            className="w-full font-bold text-base bg-amber-50/80 px-2 py-0.5 border-b border-dashed border-amber-500 outline-none rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.fromRollNo}
                            onChange={(e) => handleRollNoChange(e.target.value)}
                            placeholder="Roll No / Student ID"
                            className="w-full font-mono text-xs bg-amber-50/80 px-2 py-0.5 border-b border-dashed border-amber-500 outline-none rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.fromCollege}
                            onChange={(e) => updateField('fromCollege', e.target.value)}
                            className="w-full text-xs bg-amber-50/80 px-2 py-0.5 border-b border-dashed border-amber-500 outline-none rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.fromLocation}
                            onChange={(e) => updateField('fromLocation', e.target.value)}
                            className="w-full text-xs bg-amber-50/80 px-2 py-0.5 border-b border-dashed border-amber-500 outline-none rounded"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-base">{letterDoc.fromName || '____________________'}</div>
                          {letterDoc.fromRollNo && (
                            <div className="font-mono text-xs">{letterDoc.fromRollNo}</div>
                          )}
                          <div>{letterDoc.fromCollege}</div>
                          <div>{letterDoc.fromLocation}</div>
                        </div>
                      )}
                    </div>

                    {/* TO Section */}
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">TO,</div>
                      {isEditMode ? (
                        <div className="space-y-1 max-w-sm">
                          <input
                            type="text"
                            value={letterDoc.recipientTitle}
                            onChange={(e) => updateField('recipientTitle', e.target.value)}
                            className="w-full font-semibold text-sm bg-amber-50/80 px-2 py-0.5 border-b border-dashed border-amber-500 outline-none rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.recipientCollege}
                            onChange={(e) => updateField('recipientCollege', e.target.value)}
                            className="w-full text-xs bg-amber-50/80 px-2 py-0.5 border-b border-dashed border-amber-500 outline-none rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.recipientLocation}
                            onChange={(e) => updateField('recipientLocation', e.target.value)}
                            className="w-full text-xs bg-amber-50/80 px-2 py-0.5 border-b border-dashed border-amber-500 outline-none rounded"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold">{letterDoc.recipientTitle}</div>
                          <div>{letterDoc.recipientCollege}</div>
                          <div>{letterDoc.recipientLocation}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SUBJECT */}
                  <div className="text-sm font-serif my-5">
                    {isEditMode ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={letterDoc.subject}
                          onChange={(e) => updateField('subject', e.target.value)}
                          className="w-full bg-amber-50/80 border-b border-dashed border-amber-500 px-2 py-0.5 font-serif text-sm outline-none rounded"
                        />
                      </div>
                    ) : (
                      <span>{letterDoc.subject}</span>
                    )}
                  </div>

                  {/* LETTER BODY */}
                  <div className="space-y-4 text-sm font-serif leading-relaxed text-justify">
                    {isEditMode ? (
                      <div>
                        <input
                          type="text"
                          value={letterDoc.salutation}
                          onChange={(e) => updateField('salutation', e.target.value)}
                          className="font-bold bg-amber-50/80 border-b border-dashed border-amber-500 px-2 py-0.5 mb-2 outline-none rounded text-sm block"
                        />
                        <textarea
                          rows={4}
                          value={letterDoc.bodyText}
                          onChange={(e) => updateField('bodyText', e.target.value)}
                          className="w-full bg-amber-50/80 border border-dashed border-amber-500 p-2.5 font-serif text-sm leading-relaxed rounded outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold mb-2">{letterDoc.salutation}</div>
                        <p className="leading-relaxed whitespace-pre-line">
                          {letterDoc.bodyText}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SIGN OFF */}
                  <div className="mt-16 text-sm font-serif flex flex-col items-end">
                    <div className="text-right">
                      {isEditMode ? (
                        <div className="space-y-1 w-56 text-right">
                          <input
                            type="text"
                            value={letterDoc.signOffText}
                            onChange={(e) => updateField('signOffText', e.target.value)}
                            className="w-full text-right bg-amber-50/80 border-b border-dashed border-amber-500 px-2 py-0.5 text-sm outline-none rounded"
                          />
                          <div className="h-10"></div>
                          <div className="font-bold text-base text-slate-900">
                            {letterDoc.fromName || '____________________'}
                          </div>
                          {letterDoc.fromRollNo && (
                            <div className="text-xs font-mono text-slate-600">{letterDoc.fromRollNo}</div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div>{letterDoc.signOffText}</div>
                          <div className="h-14"></div>
                          <div className="font-bold text-base text-slate-900">
                            {letterDoc.fromName || '____________________'}
                          </div>
                          {letterDoc.fromRollNo && (
                            <div className="text-xs font-mono text-slate-600">{letterDoc.fromRollNo}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Page 1 Footer */}
                <div className="text-center text-xs text-slate-400 pt-6 border-t border-slate-100">
                  Page 1 of 2
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* A4 PAGE 2: STUDENT DETAILS TABLE */}
            {/* ========================================================= */}
            {(viewMode === 'both' || viewMode === 'page2') && (
              <div className="w-full max-w-[210mm] bg-white rounded-sm shadow-xl p-8 sm:p-14 font-serif text-slate-900 border border-slate-300 relative min-h-[297mm] flex flex-col justify-between select-text">
                <div>
                  {/* Table Header & Title */}
                  <div className="text-center mb-6 pt-2">
                    {isEditMode ? (
                      <div className="space-y-1 max-w-lg mx-auto">
                        <input
                          type="text"
                          value={letterDoc.page2Title}
                          onChange={(e) => updateField('page2Title', e.target.value)}
                          className="w-full text-center font-bold font-serif text-base uppercase bg-amber-50/80 border-b border-dashed border-amber-500 px-2 py-0.5 outline-none rounded"
                        />
                        <input
                          type="text"
                          value={letterDoc.page2Subtitle}
                          onChange={(e) => updateField('page2Subtitle', e.target.value)}
                          className="w-full text-center text-xs font-serif text-slate-600 bg-amber-50/80 border-b border-dashed border-amber-500 px-2 py-0.5 outline-none rounded"
                        />
                      </div>
                    ) : (
                      <div>
                        <h2 className="text-base font-bold font-serif uppercase tracking-wide text-slate-900">
                          {letterDoc.page2Title}
                        </h2>
                        <p className="text-xs font-serif text-slate-500 mt-1">
                          {letterDoc.page2Subtitle}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Compact Centered 5-Column Table */}
                  <div className="overflow-x-auto">
                    <table className="max-w-xl mx-auto w-full text-xs font-sans border-collapse border border-slate-400">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-400 text-slate-900">
                          <th className="border border-slate-400 px-2 py-1.5 w-12 text-center font-bold">S.no</th>
                          <th className="border border-slate-400 px-3 py-1.5 text-left font-bold">Name</th>
                          <th className="border border-slate-400 px-3 py-1.5 w-32 text-center font-bold">College ID</th>
                          <th className="border border-slate-400 px-2 py-1.5 w-24 text-center font-bold">Dept</th>
                          <th className="border border-slate-400 px-2 py-1.5 w-16 text-center font-bold">Year</th>
                          {isEditMode && (
                            <th className="border border-slate-400 px-2 py-1 w-12 text-center text-slate-500">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {letterDoc.studentsList.map((st, idx) => (
                          <tr key={`${st.studentId}-${idx}`} className="border-b border-slate-300">
                            <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-600 font-medium">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-400 px-3 py-1 font-medium text-slate-800">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={st.name}
                                  onChange={(e) => updateStudentRow(idx, 'name', e.target.value)}
                                  className="w-full bg-amber-50/80 px-1.5 py-0.5 border-b border-dashed border-amber-400 outline-none rounded text-xs"
                                />
                              ) : (
                                <span>{st.name}</span>
                              )}
                            </td>
                            <td className="border border-slate-400 px-3 py-1 text-center font-bold text-slate-900 font-sans tracking-wider text-[11px]">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={st.studentId}
                                  onChange={(e) => updateStudentRow(idx, 'studentId', e.target.value)}
                                  className="w-full bg-amber-50/80 px-1.5 py-0.5 border-b border-dashed border-amber-400 outline-none rounded text-xs text-center font-bold"
                                />
                              ) : (
                                <span>{st.studentId}</span>
                              )}
                            </td>
                            <td className="border border-slate-400 px-2 py-1 text-center font-bold text-slate-700 text-xs">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={st.department || ''}
                                  onChange={(e) => updateStudentRow(idx, 'department', e.target.value)}
                                  placeholder="e.g. CSE"
                                  className="w-full bg-amber-50/80 px-1 py-0.5 border-b border-dashed border-amber-400 outline-none rounded text-xs text-center font-bold"
                                />
                              ) : (
                                <span>{formatDepartmentShort(st.department)}</span>
                              )}
                            </td>
                            <td className="border border-slate-400 px-2 py-1 text-center font-bold text-slate-700 text-xs">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={st.year !== undefined && st.year !== null ? String(st.year) : ''}
                                  onChange={(e) => updateStudentRow(idx, 'year', e.target.value)}
                                  placeholder="IV"
                                  className="w-full bg-amber-50/80 px-1 py-0.5 border-b border-dashed border-amber-400 outline-none rounded text-xs text-center font-bold"
                                />
                              ) : (
                                <span>{formatYearRoman(st.year)}</span>
                              )}
                            </td>
                            {isEditMode && (
                              <td className="border border-slate-400 px-2 py-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudentRow(idx)}
                                  className="text-red-500 hover:text-red-700 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                                  title="Remove student row"
                                >
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* In Edit Mode: Add New Row Button */}
                    {isEditMode && (
                      <div className="max-w-xl mx-auto mt-2 text-center">
                        <button
                          type="button"
                          onClick={handleAddStudentRow}
                          className="px-3 py-1 bg-amber-100 hover:bg-amber-200 border border-dashed border-amber-400 text-amber-900 rounded-lg text-xs font-semibold cursor-pointer transition"
                        >
                          + Add Student Row to Table
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Meal Consumption Summary (B, L, D) matching handwritten reference */}
                  <div className="mt-8 pt-4 border-t border-slate-300 max-w-xl mx-auto">
                    <div className="text-xs font-serif font-bold text-slate-900 mb-2">
                      Meal Consumption Summary:
                    </div>
                    <div className="space-y-2 text-xs font-serif text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm w-8">B –</span>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={letterDoc.breakfastCount ?? ''}
                            onChange={(e) => updateField('breakfastCount', e.target.value)}
                            className="w-16 bg-amber-50/80 border-b border-dashed border-amber-400 px-1 py-0.5 font-bold text-xs rounded text-center outline-none"
                            placeholder="0"
                          />
                        ) : (
                          <span className="font-bold text-sm">{letterDoc.breakfastCount ?? 0}</span>
                        )}
                        <span className="text-slate-500 text-[11px]">(Breakfast consumed already)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm w-8">L –</span>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={letterDoc.lunchCount ?? ''}
                            onChange={(e) => updateField('lunchCount', e.target.value)}
                            className="w-16 bg-amber-50/80 border-b border-dashed border-amber-400 px-1 py-0.5 font-bold text-xs rounded text-center outline-none"
                            placeholder="0"
                          />
                        ) : (
                          <span className="font-bold text-sm">{letterDoc.lunchCount ?? 0}</span>
                        )}
                        <span className="text-slate-500 text-[11px]">(Lunch consumed already)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm w-8">D –</span>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={letterDoc.dinnerCount ?? ''}
                            onChange={(e) => updateField('dinnerCount', e.target.value)}
                            className="w-16 bg-amber-50/80 border-b border-dashed border-amber-400 px-1 py-0.5 font-bold text-xs rounded text-center outline-none"
                            placeholder={String(letterDoc.studentsList.length)}
                          />
                        ) : (
                          <span className="font-bold text-sm">{letterDoc.dinnerCount ?? letterDoc.studentsList.length}</span>
                        )}
                        <span className="text-slate-500 text-[11px]">(Dinner to be consumed tonight)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Page 2 Footer */}
                <div className="text-center text-xs text-slate-400 pt-6 border-t border-slate-100">
                  Page 2 of 2
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
