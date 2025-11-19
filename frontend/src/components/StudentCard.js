import React from "react";

/**
 * student = {
 *   name: string,
 *   className?: string,
 *   status?: string,
 *   progress?: number, // 0–100
 *   score?: number,
 *   sessions?: string[],
 *   flags?: string[]
 * }
 *
 * onSave?: () => void
 */

export default function StudentCard({ student = {}, onSave }) {
  const {
    name = "",
    className = "",
    status = "",
    progress = 0,
    score,
    sessions = [],
    flags = [],
  } = student;

  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const initial = name ? name.charAt(0).toUpperCase() : "?";

  return (
    <section className="w-full max-w-xl rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      {/* Bandeau titre bleu marine */}
      <header className="bg-slate-900 text-white px-5 py-3">
        <h2 className="text-lg font-semibold">Élève</h2>
      </header>

      <div className="px-5 py-4 space-y-5">
        {/* En-tête élève */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-sm font-semibold">
              {initial}
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-slate-900">
                {name || "Élève"}
              </div>
              {className && (
                <div className="text-xs text-slate-600">{className}</div>
              )}
            </div>
          </div>
          {status && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
              {status}
            </span>
          )}
        </div>

        {/* Progression */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <h3 className="font-semibold text-slate-900">Progression</h3>
            <span className="text-slate-700">{safeProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-2 bg-slate-900 transition-all duration-300"
              style={{ width: `${safeProgress}%` }}
            />
          </div>
        </div>

        {/* Résultats & séances suivies */}
        {(score != null || sessions.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900">Résultats</h3>
              {score != null && (
                <p className="text-slate-800">
                  Score :{" "}
                  <span className="font-semibold text-slate-900">{score}</span>
                </p>
              )}
            </div>

            {sessions.length > 0 && (
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-900">
                  Séances suivies
                </h3>
                <ul className="space-y-0.5 text-slate-800">
                  {sessions.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Points particuliers */}
        {flags.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Points particuliers
            </h3>
            <ul className="list-disc list-inside text-sm text-slate-800 space-y-0.5">
              {flags.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Bouton action */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:opacity-90"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </section>
  );
}
