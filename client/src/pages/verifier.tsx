import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function VerifierPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [struct, setStruct] = useState<any | null>(null);
  const [, navigate] = useLocation();

  const handleVerify = async () => {
    setResult("Verifying...");
    const resp = await fetch("/api/zkp/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await resp.json();
    if (data.valid) {
      setStruct(data);
      setResult(null);
    } else {
      setStruct(null);
      setResult(`❌ ${data.message || 'Invalid code or proof'}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 relative">
        {/* Back Button */}
        <button
          className="absolute -top-4 -left-4 bg-white border border-slate-200 rounded-full shadow p-2 hover:bg-blue-50 transition flex items-center"
          onClick={() => navigate("/")}
          aria-label="Back"
        >
          <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold text-blue-700 mb-2 text-center">ZK-MedPass Verifier</h1>
        <p className="text-slate-600 text-center mb-6">Verify a patient's health proof offline using a 6-digit code or QR data.</p>
        <label className="block mb-2 font-medium text-slate-700">Enter 6-digit Code or Paste QR Data</label>
        <input
          className="border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg p-3 w-full text-lg mb-4 transition"
          value={code}
          onChange={e => setCode(e.target.value)}
          maxLength={32}
          placeholder="e.g. 932841 or paste QR payload"
        />
        <div className="flex gap-2 mb-4">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex-1 transition"
            onClick={handleVerify}
          >
            Verify
          </button>
          <button
            className="bg-slate-100 hover:bg-slate-200 text-blue-700 px-4 py-2 rounded-lg font-semibold flex-1 transition cursor-not-allowed"
            disabled
          >
            Scan QR (soon)
          </button>
        </div>
        {result && (
          <div className={`mt-4 text-lg font-semibold text-center ${result.includes('VALID') ? 'text-green-600' : 'text-red-600'}`}>{result.split('\n').map((line, i) => <div key={i}>{line}</div>)}</div>
        )}
        {struct && (
          <div className="mt-4 space-y-3">
            <div className="text-green-700 font-bold text-center">✅ Proofs VALID ({struct.totalProofs})</div>
            {struct.summary?.contagious && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 text-center">Contagious condition</div>
            )}
            {Array.isArray(struct.summary?.categories) && struct.summary.categories.length > 0 && (
              <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <div className="font-semibold mb-1">ICD‑11 Categories:</div>
                <ul className="list-disc ml-5">
                  {struct.summary.categories.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              {struct.proofs?.map((p: any) => (
                <div key={p.proofId} className="border border-slate-200 rounded-lg p-3">
                  <div className="text-xs uppercase text-slate-500">{p.type === 'icd_category' ? 'ICD‑11 Category' : p.type === 'contagious_flag' ? 'Contagious Flag' : p.type}</div>
                  <div className="font-medium text-slate-800">{p.statement}</div>
                  <div className="text-xs text-slate-500 mt-1">Expires: {p.expiresAt ? new Date(p.expiresAt).toLocaleString() : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 text-xs text-slate-500 text-center border-t pt-4">
          <p><b>How it works:</b> Enter the code or scan the QR from a patient's phone or printout. This page will verify the proof instantly, even offline.</p>
        </div>
      </div>
    </div>
  );
} 