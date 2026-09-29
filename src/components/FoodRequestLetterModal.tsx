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
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeRollNo, setRepresentativeRollNo] = useState('');
  const [projectsText, setProjectsText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<'both' | 'page1' | 'page2'>('both');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen) return null;

  // Format date as DD/MM/YY (matching handwritten letter style: 23/09/26)
  let formattedDate = foodDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(foodDate)) {
    const [y, m, d] = foodDate.split('-');
    formattedDate = `${d}/${m}/${y.slice(2)}`;
  }

  const validate = (): boolean => {
    if (studentsList.length === 0) {
      setErrorMessage(
        'No students have been added to the Daily Food List. Please add students before generating the food request letter.'
      );
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleDownloadPdf = async () => {
    if (!validate()) return;
    const { generateFoodRequestLetterPdf } = await import('../utils/generateFoodLetterPdf');
    generateFoodRequestLetterPdf(
      representativeName.trim(),
      representativeRollNo.trim(),
      projectsText.trim(),
      foodDate,
      studentsList
    );
  };

  const handlePrint = () => {
    if (!validate()) return;
    window.print();
  };

  // Dedicated 2-page print document portal (rendered directly in body to avoid modal overflow/clipping)
  const printableDocument = (
    <div id="food-letter-printable" className="hidden print:block text-slate-900 bg-white">
      {/* PAGE 1 (PRINT) - Official Letter verbatim from handwritten sample */}
      <div className="print-page-1">
        <div>
          {/* Date (Right aligned: "DATE: DD/MM/YY") */}
          <div className="text-right text-sm font-serif mb-6 pt-2">
            <span className="font-semibold">DATE:</span> {formattedDate}
          </div>

          {/* FROM & TO */}
          <div className="space-y-6 text-sm font-serif leading-relaxed mb-6">
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">FROM,</div>
              <div className="font-bold text-base">{representativeName.trim() || '____________________'}</div>
              <div className="font-mono text-xs">{representativeRollNo.trim() || (representativeName.trim() ? '' : '____________________')}</div>
              <div>Sri Sai Ram Engineering College</div>
              <div>Chennai – 44</div>
            </div>

            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">TO,</div>
              <div className="font-semibold">The Principal</div>
              <div>Sri Sai Ram Engineering College</div>
              <div>Chennai – 44</div>
            </div>
          </div>

          {/* SUBJECT (sub: Request for Night stay in Incubation on ...) */}
          <div className="text-sm font-serif my-5">
            <span className="font-bold">Sub: </span>
            <span>Request for Night stay in Incubation on {formattedDate}</span>
          </div>

          {/* LETTER BODY */}
          <div className="space-y-4 text-sm font-serif leading-relaxed text-justify">
            <div className="font-bold">Respected Sir,</div>
            <p className="leading-relaxed">
              Our Incubation teams has involved in {projectsText.trim() || '__________________________________'}. So, I request you to give permission for night stay on {formattedDate}. I also request you to provide food tokens. The student's list is attached with this letter.
            </p>
          </div>

          {/* SIGN OFF (Right aligned: "Yours Truly,") */}
          <div className="mt-16 text-sm font-serif flex flex-col items-end">
            <div className="text-right">
              <div>Yours Truly,</div>
              <div className="h-14"></div>
              <div className="font-bold text-base">{representativeName.trim() || '____________________'}</div>
              {representativeRollNo.trim() && (
                <div className="text-xs font-mono">{representativeRollNo.trim()}</div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-xs font-serif text-slate-400 pt-6">Page 1 of 2</div>
      </div>

      {/* PAGE 2 (PRINT) - List of Students Attachment */}
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

          {/* Compact Centered 3-Column Table */}
          <table className="max-w-xl mx-auto w-full text-xs font-sans border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 text-slate-900">
                <th className="border border-slate-400 px-3 py-1.5 w-14 text-center font-bold">S.No</th>
                <th className="border border-slate-400 px-4 py-1.5 text-left font-bold">Student Name</th>
                <th className="border border-slate-400 px-4 py-1.5 w-44 text-center font-bold">Student ID</th>
              </tr>
            </thead>
            <tbody>
              {studentsList.map((st, idx) => (
                <tr key={st.studentId} className="border-b border-slate-300">
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
                <span className="text-xs text-indigo-200">Night Stay Permission & Food Tokens Request</span>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* 1. Representative Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Representative Name
                </label>
                <input
                  type="text"
                  value={representativeName}
                  onChange={(e) => {
                    setRepresentativeName(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter Student / Representative Name"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              {/* 2. Roll Number / ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Roll No / Student ID
                </label>
                <input
                  type="text"
                  value={representativeRollNo}
                  onChange={(e) => setRepresentativeRollNo(e.target.value)}
                  placeholder="Enter Roll Number / Student ID"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono uppercase"
                />
              </div>

              {/* 3. Incubation Projects */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Involved Incubation Projects
                </label>
                <input
                  type="text"
                  value={projectsText}
                  onChange={(e) => setProjectsText(e.target.value)}
                  placeholder="Enter Active Incubation Project Names"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
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
                  className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'both' ? 'bg-white shadow-xs font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Both Pages
                </button>
                <button
                  onClick={() => setViewMode('page1')}
                  className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'page1' ? 'bg-white shadow-xs font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Page 1 (Letter)
                </button>
                <button
                  onClick={() => setViewMode('page2')}
                  className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'page2' ? 'bg-white shadow-xs font-bold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Page 2 (Table)
                </button>
              </div>

              {/* Action Buttons */}
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
                  {/* Date (Right aligned: "DATE: DD/MM/YY") */}
                  <div className="text-right text-sm mb-6 pt-2 font-serif">
                    <span className="font-semibold">DATE:</span> {formattedDate}
                  </div>

                  {/* FROM Section */}
                  <div className="space-y-6 text-sm font-serif leading-relaxed mb-6">
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">FROM,</div>
                      <div className="font-bold text-slate-900 text-base">
                        {representativeName.trim() || '____________________'}
                      </div>
                      <div className="font-mono text-xs text-slate-700">
                        {representativeRollNo.trim() || (representativeName.trim() ? '' : '____________________')}
                      </div>
                      <div className="text-slate-700">Sri Sai Ram Engineering College</div>
                      <div className="text-slate-700">Chennai – 44</div>
                    </div>

                    {/* TO Section */}
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">TO,</div>
                      <div className="font-semibold text-slate-900">The Principal</div>
                      <div className="text-slate-700">Sri Sai Ram Engineering College</div>
                      <div className="text-slate-700">Chennai – 44</div>
                    </div>
                  </div>

                  {/* SUBJECT */}
                  <div className="text-sm font-serif my-5">
                    <span className="font-bold">sub: </span>
                    <span>Request for Night stay in Incubation on {formattedDate}</span>
                  </div>

                  {/* LETTER BODY */}
                  <div className="space-y-4 text-sm font-serif leading-relaxed text-slate-800 text-justify">
                    <div className="font-bold text-slate-900">Respected Sir,</div>
                    <p className="leading-relaxed">
                      Our Incubation teams has involved in {projectsText.trim() || '__________________________________'}. So, I request you to give permission for night stay on {formattedDate}. I also request you to provide food tokens. The student's list is attached with this letter.
                    </p>
                  </div>

                  {/* SIGN OFF */}
                  <div className="mt-16 text-sm font-serif flex flex-col items-end">
                    <div className="text-right">
                      <div>Yours Truly,</div>
                      <div className="h-14"></div>
                      <div className="font-bold text-base text-slate-900">
                        {representativeName.trim() || '____________________'}
                      </div>
                      {representativeRollNo.trim() && (
                        <div className="text-xs font-mono text-slate-600">
                          {representativeRollNo.trim()}
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
            {/* A4 PAGE 2 PREVIEW: STUDENT DETAILS TABLE */}
            {/* ========================================================= */}
            {(viewMode === 'both' || viewMode === 'page2') && (
              <div className="w-full max-w-[210mm] bg-white rounded-sm shadow-xl p-10 sm:p-14 font-serif text-slate-900 border border-slate-300 relative min-h-[297mm] flex flex-col justify-between">
                <div>
                  <div className="text-center mb-6 pt-2">
                    <h2 className="text-base font-bold font-serif uppercase tracking-wide text-slate-900">
                      List of Students Requiring Food Arrangement
                    </h2>
                    <p className="text-xs font-serif text-slate-500 mt-1">
                      Food Date: <span className="font-semibold">{formattedDate}</span> &nbsp;|&nbsp; Total Students:{' '}
                      <span className="font-semibold">{studentsList.length}</span>
                    </p>
                  </div>

                  {/* Compact Centered 3-Column Table */}
                  <table className="max-w-xl mx-auto w-full text-xs font-sans border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-400 text-slate-900">
                        <th className="border border-slate-400 px-3 py-1.5 w-14 text-center font-bold">S.No</th>
                        <th className="border border-slate-400 px-4 py-1.5 text-left font-bold">Student Name</th>
                        <th className="border border-slate-400 px-4 py-1.5 w-44 text-center font-bold">Student ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsList.map((st, idx) => (
                        <tr key={st.studentId} className="border-b border-slate-300">
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
