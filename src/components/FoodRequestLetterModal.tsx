'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface StudentInfo {
  studentId: string;
  name: string;
}

interface FoodRequestLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  foodDate: string;
  studentsList: StudentInfo[];
}

interface LetterDocState {
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
  bodyText: string;
  signOffText: string;
  page2Title: string;
  page2Subtitle: string;
  studentsList: StudentInfo[];
}

export default function FoodRequestLetterModal({
  isOpen,
  onClose,
  foodDate,
  studentsList,
}: FoodRequestLetterModalProps) {
  const [viewMode, setViewMode] = useState<'both' | 'page1' | 'page2'>('both');
  const [isEditMode, setIsEditMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  // Format date as DD/MM/YY (matching handwritten letter style: 23/09/26)
  let formattedDate = foodDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(foodDate)) {
    const [y, m, d] = foodDate.split('-');
    formattedDate = `${d}/${m}/${y.slice(2)}`;
  }

  // Generate initial default document state
  const buildDefaultDoc = (): LetterDocState => ({
    date: formattedDate,
    fromName: '',
    fromRollNo: '',
    fromCollege: 'Sri Sai Ram Engineering College',
    fromLocation: 'Chennai – 44',
    recipientTitle: 'The Principal',
    recipientCollege: 'Sri Sai Ram Engineering College',
    recipientLocation: 'Chennai – 44',
    subject: `Request for Night stay in Incubation on ${formattedDate}`,
    salutation: 'Respected Sir,',
    bodyText: `Our Incubation teams has involved in incubation development activities. So, I request you to give permission for night stay on ${formattedDate}. I also request you to provide food tokens. The student's list is attached with this letter.`,
    signOffText: 'Yours Truly,',
    page2Title: 'List of Students Requiring Food Arrangement',
    page2Subtitle: `Food Date: ${formattedDate}   |   Total Students: ${studentsList.length}`,
    studentsList: studentsList.map(s => ({ ...s })),
  });

  const [letterDoc, setLetterDoc] = useState<LetterDocState>(buildDefaultDoc);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When opening or when input props change, load default or saved session draft
  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = sessionStorage.getItem('incubation_letter_draft');
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft) as LetterDocState;
          setLetterDoc(parsed);
          return;
        }
      } catch {}
      setLetterDoc(buildDefaultDoc());
    }
  }, [isOpen, foodDate, studentsList]);

  // Persist edits to sessionStorage
  const updateField = <K extends keyof LetterDocState>(field: K, value: LetterDocState[K]) => {
    setLetterDoc(prev => {
      const next = { ...prev, [field]: value };
      try {
        sessionStorage.setItem('incubation_letter_draft', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const updateStudentRow = (index: number, field: 'name' | 'studentId', value: string) => {
    setLetterDoc(prev => {
      const nextList = [...prev.studentsList];
      nextList[index] = { ...nextList[index], [field]: value };
      const next = {
        ...prev,
        studentsList: nextList,
        page2Subtitle: `Food Date: ${prev.date}   |   Total Students: ${nextList.length}`,
      };
      try {
        sessionStorage.setItem('incubation_letter_draft', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleAddStudentRow = () => {
    setLetterDoc(prev => {
      const nextList = [...prev.studentsList, { name: 'Student Name', studentId: 'SEC000' }];
      const next = {
        ...prev,
        studentsList: nextList,
        page2Subtitle: `Food Date: ${prev.date}   |   Total Students: ${nextList.length}`,
      };
      try {
        sessionStorage.setItem('incubation_letter_draft', JSON.stringify(next));
      } catch {}
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
      try {
        sessionStorage.setItem('incubation_letter_draft', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all text, header, and table fields back to the original defaults?')) {
      try {
        sessionStorage.removeItem('incubation_letter_draft');
      } catch {}
      setLetterDoc(buildDefaultDoc());
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
      '',
      letterDoc.date,
      letterDoc.studentsList,
      letterDoc
    );
  };

  // Dedicated 2-page print document portal (rendered directly in body to avoid modal overflow/clipping)
  const printableDocument = (
    <div id="food-letter-printable" className="hidden print:block text-slate-900 bg-white">
      {/* PAGE 1 (PRINT) */}
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
            <span className="font-bold">Sub: </span>
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

      {/* PAGE 2 (PRINT) */}
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

          {/* Compact Centered Table */}
          <table className="max-w-xl mx-auto w-full text-xs font-sans border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 text-slate-900">
                <th className="border border-slate-400 px-3 py-1.5 w-14 text-center font-bold">S.No</th>
                <th className="border border-slate-400 px-4 py-1.5 text-left font-bold">Student Name</th>
                <th className="border border-slate-400 px-4 py-1.5 w-44 text-center font-bold">Student ID</th>
              </tr>
            </thead>
            <tbody>
              {letterDoc.studentsList.map((st, idx) => (
                <tr key={`${st.studentId}-${idx}`} className="border-b border-slate-300">
                  <td className="border border-slate-400 px-3 py-1.5 text-center text-slate-600 font-medium">{idx + 1}</td>
                  <td className="border border-slate-400 px-4 py-1.5 font-medium text-slate-800">{st.name}</td>
                  <td className="border border-slate-400 px-4 py-1.5 text-center font-bold text-slate-900 font-sans tracking-wider text-[11px]">
                    {st.studentId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          
          {/* Modal Top Header Bar */}
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
                📄
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tracking-tight">Official Food Request Letter</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 text-[10px] font-mono font-semibold">
                    DATE: {letterDoc.date}
                  </span>
                </div>
                <div className="text-xs text-slate-400">Night Stay Permission & Food Tokens Request</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
          </div>

          {/* Action & View Mode Toolbar */}
          <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Left: View Mode Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'both' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Pages
              </button>
              <button
                type="button"
                onClick={() => setViewMode('page1')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'page1' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Page 1 (Letter)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('page2')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  viewMode === 'page2' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Page 2 (Table)
              </button>
            </div>

            {/* Right: Universal Edit Toggle & Actions */}
            <div className="flex items-center gap-2">
              {/* Universal In-Place Edit Mode Button */}
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                  isEditMode
                    ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-300'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                <span>{isEditMode ? '✓ Editing Mode: Active' : '✏️ Edit Letter (Any Part)'}</span>
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
                onClick={() => window.print()}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <span>🖨️ Print</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>📥 Download PDF</span>
              </button>
            </div>
          </div>

          {/* Active Editing Instructions Banner */}
          {isEditMode && (
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-semibold">In-Place Document Editing Mode Active:</span>
                <span>Click directly on ANY text, name, subject, body paragraph, or table cell on the letter below to edit it.</span>
              </div>
              <button
                onClick={() => setIsEditMode(false)}
                className="font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer text-xs"
              >
                Done Editing
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
                  {/* Date (Right aligned) */}
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
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-1">FROM,</div>
                      {isEditMode ? (
                        <div className="space-y-1 max-w-sm">
                          <input
                            type="text"
                            value={letterDoc.fromName}
                            onChange={(e) => updateField('fromName', e.target.value)}
                            placeholder="Student Representative Name"
                            className="w-full font-bold text-base text-slate-900 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.fromRollNo}
                            onChange={(e) => updateField('fromRollNo', e.target.value)}
                            placeholder="Roll Number (e.g. 23CS101)"
                            className="w-full font-mono text-xs text-slate-700 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.fromCollege}
                            onChange={(e) => updateField('fromCollege', e.target.value)}
                            className="w-full text-slate-700 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.fromLocation}
                            onChange={(e) => updateField('fromLocation', e.target.value)}
                            className="w-full text-slate-700 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900 text-base">
                            {letterDoc.fromName.trim() || '____________________'}
                          </div>
                          {letterDoc.fromRollNo && (
                            <div className="font-mono text-xs text-slate-700">{letterDoc.fromRollNo}</div>
                          )}
                          <div className="text-slate-700">{letterDoc.fromCollege}</div>
                          <div className="text-slate-700">{letterDoc.fromLocation}</div>
                        </div>
                      )}
                    </div>

                    {/* TO Section */}
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-1">TO,</div>
                      {isEditMode ? (
                        <div className="space-y-1 max-w-sm">
                          <input
                            type="text"
                            value={letterDoc.recipientTitle}
                            onChange={(e) => updateField('recipientTitle', e.target.value)}
                            className="w-full font-semibold text-slate-900 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.recipientCollege}
                            onChange={(e) => updateField('recipientCollege', e.target.value)}
                            className="w-full text-slate-700 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          />
                          <input
                            type="text"
                            value={letterDoc.recipientLocation}
                            onChange={(e) => updateField('recipientLocation', e.target.value)}
                            className="w-full text-slate-700 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-900">{letterDoc.recipientTitle}</div>
                          <div className="text-slate-700">{letterDoc.recipientCollege}</div>
                          <div className="text-slate-700">{letterDoc.recipientLocation}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SUBJECT */}
                  <div className="text-sm font-serif my-5 flex items-baseline gap-1">
                    <span className="font-bold shrink-0">Sub: </span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={letterDoc.subject}
                        onChange={(e) => updateField('subject', e.target.value)}
                        className="w-full font-serif text-sm bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                      />
                    ) : (
                      <span>{letterDoc.subject}</span>
                    )}
                  </div>

                  {/* LETTER BODY */}
                  <div className="space-y-3 text-sm font-serif leading-relaxed text-slate-800 text-justify">
                    {isEditMode ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={letterDoc.salutation}
                          onChange={(e) => updateField('salutation', e.target.value)}
                          className="font-bold text-slate-900 bg-amber-50/80 hover:bg-amber-100 border-b border-dashed border-amber-500 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 rounded w-48"
                        />
                        <textarea
                          rows={6}
                          value={letterDoc.bodyText}
                          onChange={(e) => updateField('bodyText', e.target.value)}
                          className="w-full bg-amber-50/80 hover:bg-amber-100 border-2 border-dashed border-amber-500 p-2.5 leading-relaxed text-justify font-serif text-sm outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg resize-y"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 mb-2">{letterDoc.salutation}</div>
                        <p className="leading-relaxed whitespace-pre-line">
                          {letterDoc.bodyText}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SIGN OFF */}
                  <div className="mt-16 text-sm font-serif flex flex-col items-end">
                    <div className="text-right flex flex-col items-end">
                      {isEditMode ? (
                        <div className="space-y-1 w-64 text-right flex flex-col items-end">
                          <input
                            type="text"
                            value={letterDoc.signOffText}
                            onChange={(e) => updateField('signOffText', e.target.value)}
                            className="bg-amber-50/80 border-b border-dashed border-amber-500 px-1.5 py-0.5 text-right font-serif outline-none w-36"
                          />
                          <div className="h-10"></div>
                          <div className="font-bold text-base text-slate-900">
                            {letterDoc.fromName.trim() || '____________________'}
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
                            {letterDoc.fromName.trim() || '____________________'}
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

                  {/* Compact Centered 3-Column Table */}
                  <div className="overflow-x-auto">
                    <table className="max-w-xl mx-auto w-full text-xs font-sans border-collapse border border-slate-400">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-400 text-slate-900">
                          <th className="border border-slate-400 px-3 py-1.5 w-14 text-center font-bold">S.No</th>
                          <th className="border border-slate-400 px-4 py-1.5 text-left font-bold">Student Name</th>
                          <th className="border border-slate-400 px-4 py-1.5 w-44 text-center font-bold">Student ID</th>
                          {isEditMode && (
                            <th className="border border-slate-400 px-2 py-1 w-12 text-center text-slate-500">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {letterDoc.studentsList.map((st, idx) => (
                          <tr key={`${st.studentId}-${idx}`} className="border-b border-slate-300">
                            <td className="border border-slate-400 px-3 py-1.5 text-center text-slate-600 font-medium">
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
