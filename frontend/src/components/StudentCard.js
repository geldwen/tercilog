import React from "react";

export const StudentCard = ({ student, onSave }) => {
  const progress = Math.max(0, Math.min(100, student.progress || 0));

  return (
    <section className="w-full max-w-xl rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      {/* Bandeau titre en bleu marine */}
      <header className="bg-slate-900 text-white px-5 py-3">
        <h2 className="text-lg font-semibold">Élève</h2>
      </header>

      <div className="px-5 py-4 space-y-5">
        {/* En-tête élève */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-sm font-semibold">
              {student.name?.charAt(0).toUpperCase() || 'E'}
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-slate-900">
                {student.name}
              </div>
              {student.className && (
                <div className="text-xs text-slate-600">{student.className}</div>
              )}
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100">
            {student.status || 'Actif'}
          </span>
        </div>

        {/* Progression */}
        {student.progress != null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <h3 className="font-semibold text-slate-900">Progression</h3>
              <span className="text-slate-700">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-2 bg-slate-900 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Résultats & séances suivies */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {student.score != null && (
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900">Résultats</h3>
              <p className="text-slate-800">
                Score :{" "}
                <span className="font-semibold text-slate-900">
                  {student.score}
                </span>
              </p>
            </div>
          )}

          {student.sessions && student.sessions.length > 0 && (
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900">Séances suivies</h3>
              <ul className="space-y-0.5 text-slate-800">
                {student.sessions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Points particuliers */}
        {student.flags && student.flags.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Points particuliers
            </h3>
            <ul className="list-disc list-inside text-sm text-slate-800 space-y-0.5">
              {student.flags.map((f, idx) => (
                <li key={idx}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Bouton */}
        {onSave && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onSave}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:opacity-90 transition-opacity"
            >
              Enregistrer
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
