'use client';

import { useState, useEffect } from 'react';
import { getFoodTokens } from '@/actions/tokenActions';
import TokenPrintSlip from '@/components/TokenPrintSlip';
import { getMealSession } from '@/utils/timeUtils';

export default function FoodTokens() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getFoodTokens(dateFilter || undefined);
        setTokens(data);
      } catch (e) {
        console.error('Error fetching tokens:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateFilter]);

  const filtered = tokens.filter(t => {
    const matchQ =
      !search ||
      t.tokenNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.studentId.toLowerCase().includes(search.toLowerCase()) ||
      (t.studentName && t.studentName.toLowerCase().includes(search.toLowerCase())) ||
      (t.project && t.project.toLowerCase().includes(search.toLowerCase()));
    return matchQ;
  });

  const selectedPrintToken = selected ? {
    tokenNumber: selected.tokenNumber,
    studentId: selected.studentId,
    studentName: selected.studentName || selected.studentId,
    project: selected.project || '—',
    date: selected.date,
    time: selected.time,
    session: selected.session || getMealSession(),
  } : null;

  return (
    <div className="space-y-5">
      {/* Portal Container for Thermal Receipt Printing */}
      <TokenPrintSlip token={selectedPrintToken} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Food Tokens</h2>
          <p className="text-sm text-slate-500">
            {filtered.length} token{filtered.length !== 1 ? 's' : ''} generated for mess terminal
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search token #, roll no, name, project…"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72 bg-white"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-2 cursor-pointer font-medium"
          >
            Show All Dates
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading token records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-3">🎫</div>
            <div className="font-medium text-slate-700">No food tokens found</div>
            <div className="text-sm text-slate-400 mt-1">Try adjusting your filters or date selection.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Token Number', 'Student Name', 'Roll No / ID', 'Project', 'Session', 'Date & Time', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-xs font-semibold text-indigo-700 tracking-wide font-mono tabular-nums">{t.tokenNumber}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{t.studentName || '—'}</td>
                  <td className="py-3 px-4 text-xs text-slate-500 font-mono font-medium tracking-wide">{t.studentId}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs">{t.project || '—'}</td>
                  <td className="py-3 px-4 text-xs font-bold text-indigo-900 uppercase">{t.session || getMealSession()}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs font-mono">{t.date} · {t.time}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelected(t)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer"
                    >
                      View Slip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Token Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Token Details</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl cursor-pointer">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex flex-col items-center">
                <div className="text-xs text-indigo-500 uppercase font-semibold tracking-wider mb-1">Token Number</div>
                <div className="text-2xl font-bold text-indigo-900 tracking-wide font-mono tabular-nums mb-2">{selected.tokenNumber}</div>
                <div className="px-2.5 py-1 bg-indigo-200 text-indigo-900 rounded-lg font-bold text-xs uppercase">
                  {selected.session || getMealSession()}
                </div>
              </div>
              <div className="space-y-2 text-sm bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                {[
                  { l: 'Student Name', v: selected.studentName },
                  { l: 'Student Roll ID', v: selected.studentId },
                  { l: 'Project', v: selected.project || '—' },
                  { l: 'Meal Session', v: selected.session || getMealSession() },
                  { l: 'Food Date', v: selected.date },
                  { l: 'Issued Time', v: selected.time },
                  { l: 'Issued By', v: selected.generatedBy },
                ].map(r => (
                  <div key={r.l} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500">{r.l}</span>
                    <span className="font-semibold text-slate-800">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Print Slip
              </button>
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-xs font-semibold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
