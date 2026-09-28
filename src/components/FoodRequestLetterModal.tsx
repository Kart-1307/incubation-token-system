'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface StudentInfo {
  studentId: string;
  name: string;
}

interface FoodRequestLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  foodDate: string;
  studentsList: StudentInfo[];
}

export default function FoodRequestLetterModal({
  isOpen,
  onClose,
  foodDate,
  studentsList,
}: FoodRequestLetterModalProps) {
  const [fromName, setFromName] = useState('Incubation Centre In-charge');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<'both' | 'page1' | 'page2'>('both');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen) return null;

  // Format date as DD-MM-YYYY
  let formattedDate = foodDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(foodDate)) {
    const [y, m, d] = foodDate.split('-');
    formattedDate = `${d}-${m}-${y}`;
  }

  const validate = (): boolean => {
    if (studentsList.length === 0) {
      setErrorMessage(
        'No students have been added to the Daily Food List. Please add students before generating the food request letter.'
      );
      return false;
    }
    if (!fromName.trim()) {
      setErrorMessage('Please enter the From name before generating the letter.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleDownloadPdf = async () => {
    if (!validate()) return;
    const { generateFoodRequestLetterPdf } = await import('../utils/generateFoodLetterPdf');
    generateFoodRequestLetterPdf(fromName.trim(), foodDate, studentsList);
  };

  const handlePrint = () => {
    if (!validate()) return;
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
            <span className="font-semibold">Date:</span> {formattedDate}
          </div>

          {/* FROM & TO */}
          <div className="space-y-6 text-sm font-serif leading-relaxed mb-6">
            <div>
              <div className="font-bold uppercase text-xs tracking-wider text-slate-500 mb-1">FROM:</div>
              <div className="font-semibold text-base">{fromName.trim() || '[From Name]'}</div>
              <div>Incubation Centre</div>
              <div>Sri Sairam Engineering College</div>
            </div>

            <div>
              <div className="font-bold uppercase text-xs tracking-wider text-slate-500 mb-1">TO:</div>
              <div className="font-semibold">The Principal</div>
              <div>Sri Sairam Engineering College</div>
              <div>West Tambaram, Chennai</div>
            </div>
          </div>

          {/* SUBJECT */}
          <div className="text-sm font-serif font-bold my-5 pb-1 border-b border-slate-300">
            <span>SUBJECT: </span>
            <span className="font-bold">Request for Food Arrangement for Night-Stay Students</span>
          </div>

          {/* LETTER BODY */}
          <div className="space-y-4 text-sm font-serif leading-relaxed text-justify">
            <div className="font-bold">RESPECTED SIR,</div>
            <p>
              I kindly request you to arrange food facilities for the students who are staying at the college for night stay.
            </p>
            <div>
              <p className="mb-2">The required food arrangements are requested for:</p>
              <ol className="list-decimal list-inside space-y-1 pl-4 font-medium">
                <li>Dinner</li>
                <li>Next day's Breakfast</li>
                <li>Next day's Lunch</li>
              </ol>
            </div>
            <p>
              Kindly make the necessary arrangements for the above-mentioned students.
            </p>
            <p>
              The list of students requiring food arrangements is provided on the following page for your reference.
            </p>
            <p className="pt-2">Thank you for your kind consideration and support.</p>
          </div>

          {/* SIGN OFF */}
          <div className="mt-12 text-sm font-serif flex items-start justify-between">
            <div>
              <div>Yours faithfully,</div>
              <div className="mt-12 font-bold text-base">{fromName.trim() || '[From Name]'}</div>
              <div>Incubation Centre</div>
              <div>Sri Sairam Engineering College</div>
            </div>
            <div className="text-right">
              <div>Approved by,</div>
              <div className="mt-12 font-bold text-base">Principal</div>
              <div>Sri Sairam Engineering College</div>
            </div>
          </div>
        </div>

        <div className="text-center text-xs font-serif text-slate-400 pt-6">Page 1 of 2</div>
      </div>

      {/* PAGE 2 (PRINT) - Only List of Students */}
      <div className="print-page-2">
        <div>
          <div className="text-center mb-6 pt-4">
            <h2 className="text-base font-bold font-serif uppercase tracking-wide text-slate-900">
              List of Students Requiring Food Arrangement
            </h2>
            <p className="text-xs font-serif text-slate-500 mt-1">
              Food Date: <span className="font-semibold">{formattedDate}</span> &nbsp;|&nbsp; Total Students:{' '}
              <span className="font-semibold">{studentsList.length}</span>
            </p>
          </div>

          {/* Compact Centered 3-Column Table: fits 20+ students comfortably */}
          <table className="max-w-xl mx-auto w-full text-xs font-serif border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 text-slate-900">
                <th className="border border-slate-400 px-3 py-1.5 w-14 text-center font-bold">S.No</th>
                <th className="border border-slate-400 px-4 py-1.5 text-left font-bold">Student Name</th>
                <th className="border border-slate-400 px-4 py-1.5 w-40 text-center font-bold">Student ID</th>
              </tr>
            </thead>
            <tbody>
              {studentsList.map((st, idx) => (
                <tr key={st.studentId} className="border-b border-slate-300">
                  <td className="border border-slate-400 px-3 py-1.5 text-center text-slate-600">{idx + 1}</td>
                  <td className="border border-slate-400 px-4 py-1.5 font-medium text-slate-800">{st.name}</td>
                  <td className="border border-slate-400 px-4 py-1.5 text-center font-semibold text-slate-900 tracking-wide">
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

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">

      {/* Main UI Modal (hidden during window.print) */}
      <div className="print:hidden bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="bg-indigo-900 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-800 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                Official Document
              </span>
              <span className="text-xs text-indigo-200">2-Page College Request Letter</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
              Food Request Letter Generator
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-800 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Form Control Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* A. From Name Input */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                From Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => {
                  setFromName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. Dr. ABC or Mr. S. Kumar"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Appears in "FROM" and sign-off
              </p>
            </div>

            {/* B. Food Date Display (Auto-taken) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Food Date (Auto-fetched)
              </label>
              <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 flex items-center justify-between">
                <span>{formattedDate}</span>
                <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium tracking-wide">
                  {foodDate}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Synchronized with Daily Food List
              </p>
            </div>

            {/* C. Student Count (Auto-fetched) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Students Included (Page 2)
              </label>
              <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 flex items-center justify-between">
                <span>{studentsList.length} Students</span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                  {studentsList.length > 0 ? 'Ready' : 'Empty'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Auto-populated from Daily Food List
              </p>
            </div>
          </div>

          {/* Validation Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <span className="text-slate-500 px-2">Preview:</span>
              <button
                onClick={() => setViewMode('both')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === 'both' ? 'bg-white shadow-xs font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Both Pages
              </button>
              <button
                onClick={() => setViewMode('page1')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === 'page1' ? 'bg-white shadow-xs font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Page 1 (Letter)
              </button>
              <button
                onClick={() => setViewMode('page2')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === 'page2' ? 'bg-white shadow-xs font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Page 2 (Table)
              </button>
            </div>

            {/* D. Main Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Letter
              </button>

              <button
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable A4 Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-200/80 flex flex-col items-center gap-8">
          {/* ========================================================= */}
          {/* A4 PAGE 1 PREVIEW: OFFICIAL REQUEST LETTER */}
          {/* ========================================================= */}
          {(viewMode === 'both' || viewMode === 'page1') && (
            <div className="w-full max-w-[210mm] bg-white rounded-sm shadow-xl p-10 sm:p-14 font-serif text-slate-900 border border-slate-300 relative min-h-[297mm] flex flex-col justify-between">
              <div>
                {/* Date */}
                <div className="text-right text-sm mb-6 pt-2 font-serif">
                  <span className="font-semibold">Date:</span> {formattedDate}
                </div>

                {/* FROM Section */}
                <div className="space-y-6 text-sm font-serif leading-relaxed mb-6">
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">FROM:</div>
                    <div className="font-bold text-slate-900 text-base">
                      {fromName.trim() ? (
                        fromName
                      ) : (
                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded italic">
                          [Enter From Name above]
                        </span>
                      )}
                    </div>
                    <div className="text-slate-700">Incubation Centre</div>
                    <div className="text-slate-700">Sri Sairam Engineering College</div>
                  </div>

                  {/* TO Section */}
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">TO:</div>
                    <div className="font-semibold text-slate-900">The Principal</div>
                    <div className="text-slate-700">Sri Sairam Engineering College</div>
                    <div className="text-slate-700">West Tambaram, Chennai</div>
                  </div>
                </div>

                {/* SUBJECT */}
                <div className="text-sm font-serif font-bold my-5 pb-1 border-b border-slate-200">
                  <span>SUBJECT: </span>
                  <span className="font-bold">Request for Food Arrangement for Night-Stay Students</span>
                </div>

                {/* LETTER BODY */}
                <div className="space-y-4 text-sm font-serif leading-relaxed text-slate-800 text-justify">
                  <div className="font-bold text-slate-900">RESPECTED SIR,</div>
                  <p>
                    I kindly request you to arrange food facilities for the students who are staying at the college for night stay.
                  </p>
                  <div>
                    <p className="mb-2">The required food arrangements are requested for:</p>
                    <ol className="list-decimal list-inside space-y-1.5 pl-4 font-semibold text-slate-900">
                      <li>Dinner</li>
                      <li>Next day's Breakfast</li>
                      <li>Next day's Lunch</li>
                    </ol>
                  </div>
                  <p>
                    Kindly make the necessary arrangements for the above-mentioned students.
                  </p>
                  <p>
                    The list of students requiring food arrangements is provided on the following page for your reference.
                  </p>
                  <p className="pt-2">Thank you for your kind consideration and support.</p>
                </div>

                {/* SIGN OFF */}
                <div className="mt-12 text-sm font-serif flex items-start justify-between">
                  <div>
                    <div>Yours faithfully,</div>
                    <div className="mt-10 font-bold text-base text-slate-900">
                      {fromName.trim() ? (
                        fromName
                      ) : (
                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded italic">
                          [From Name]
                        </span>
                      )}
                    </div>
                    <div className="text-slate-700">Incubation Centre</div>
                    <div className="text-slate-700">Sri Sairam Engineering College</div>
                  </div>
                  <div className="text-right">
                    <div>Approved by,</div>
                    <div className="mt-10 font-bold text-base text-slate-900">
                      Principal
                    </div>
                    <div className="text-slate-700">Sri Sairam Engineering College</div>
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
          {/* A4 PAGE 2 PREVIEW: STUDENT DETAILS TABLE */}
          {/* (College header removed as requested - only list of students alone) */}
          {/* (Compact width & low row padding so 20+ names fit easily without congestion) */}
          {/* ========================================================= */}
          {(viewMode === 'both' || viewMode === 'page2') && (
            <div className="w-full max-w-[210mm] bg-white rounded-sm shadow-xl p-10 sm:p-14 font-serif text-slate-900 border border-slate-300 relative min-h-[297mm] flex flex-col justify-between">
              <div>
                <div className="text-center mb-6 pt-2">
                  <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
                    List of Students Requiring Food Arrangement
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Food Date: <span className="font-semibold text-slate-800">{formattedDate}</span> &nbsp;|&nbsp;
                    Total Students: <span className="font-semibold text-slate-800">{studentsList.length}</span>
                  </p>
                </div>

                {/* Compact, centered 3-column table: low height & width so 20 names fit comfortably */}
                <div className="max-w-xl mx-auto border border-slate-300 rounded overflow-hidden my-3">
                  <table className="w-full text-xs font-serif border-collapse">
                    <thead>
                      <tr className="bg-indigo-900 text-white">
                        <th className="py-2 px-3 w-14 text-center font-bold border-r border-indigo-800">S.No</th>
                        <th className="py-2 px-4 text-left font-bold border-r border-indigo-800">Student Name</th>
                        <th className="py-2 px-4 w-40 text-center font-bold">Student ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {studentsList.length > 0 ? (
                        studentsList.map((st, idx) => (
                          <tr key={st.studentId} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="py-1.5 px-3 text-center text-slate-500 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-4 font-medium text-slate-900 border-r border-slate-200">
                              {st.name}
                            </td>
                            <td className="py-1.5 px-4 text-center font-semibold text-slate-800 tracking-wide">
                              {st.studentId}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-xs text-slate-400 italic">
                            No students currently eligible for this date.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="max-w-xl mx-auto text-[11px] text-slate-500 italic mt-3">
                  * Note: The students listed above are authorized for night-stay incubation work and are entitled to meals as per college incubation guidelines.
                </div>
              </div>

              {/* Page 2 Footer */}
              <div className="text-center text-xs text-slate-400 pt-6 border-t border-slate-100">
                Page 2 of 2
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Document format: <span className="font-semibold text-slate-700">Official A4 (2 Pages)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF (2 Pages)
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
);
}
