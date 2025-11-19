import React from "react";

export const SessionCard = ({ session, onEdit }) => {
  return (
    <section className="w-full max-w-xl rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      {/* Bandeau titre en bleu marine */}
      <header className="bg-slate-900 text-white px-5 py-3">
        <h2 className="text-lg font-semibold">Séance</h2>
      </header>

      <div className="px-5 py-4 space-y-5">
        {/* Bloc infos générales */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Informations générales
          </h3>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <div className="font-medium text-slate-900 truncate">
              {session.title}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
              <span>{session.date}</span>
              <span>• {session.duration}</span>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-medium text-slate-800">
              {session.status}
            </span>
          </div>
        </div>

        {/* Objectifs */}
        {session.objectives && session.objectives.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Objectifs de la séance
            </h3>
            <ul className="list-disc list-inside text-sm text-slate-800 space-y-0.5">
              {session.objectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Contenu / activités */}
        {session.activities && session.activities.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Contenu / activités
            </h3>
            <div className="space-y-1.5">
              {session.activities.map((act, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800"
                >
                  {act}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ressources */}
        {session.resources && session.resources.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Ressources</h3>
            <ul className="space-y-1 text-sm">
              {session.resources.map((res, idx) => (
                <li key={idx} className="flex items-center gap-2 text-slate-800">
                  <span className="text-base leading-none">🔗</span>
                  {res.url ? (
                    <a
                      href={res.url}
                      className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {res.label}
                    </a>
                  ) : (
                    <span>{res.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suivi / notes */}
        {session.notes && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Suivi / notes
            </h3>
            <p className="text-sm text-slate-800 whitespace-pre-line">
              {session.notes}
            </p>
          </div>
        )}

        {/* Bouton */}
        {onEdit && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onEdit}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:opacity-90 transition-opacity"
            >
              Modifier
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
