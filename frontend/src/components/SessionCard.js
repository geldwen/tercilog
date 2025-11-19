import React from "react";

/**
 * session = {
 *   title: string,
 *   date: string,
 *   duration: string,
 *   status: string,
 *   objectives?: string[],
 *   activities?: string[],
 *   resources?: { label: string, url?: string }[],
 *   notes?: string
 * }
 *
 * onEdit?: () => void
 */

export default function SessionCard({ session = {}, onEdit }) {
  const {
    title = "",
    date = "",
    duration = "",
    status = "",
    objectives = [],
    activities = [],
    resources = [],
    notes = "",
  } = session;

  return (
    <section className="w-full max-w-xl rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      {/* Bandeau titre bleu marine */}
      <header className="bg-slate-900 text-white px-5 py-3">
        <h2 className="text-lg font-semibold">Séance</h2>
      </header>

      <div className="px-5 py-4 space-y-5">
        {/* Informations générales */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Informations générales
          </h3>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <div className="font-medium text-slate-900 truncate">
              {title || "Sans titre"}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
              {date && <span>{date}</span>}
              {duration && <span>• {duration}</span>}
            </div>
            {status && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-medium text-slate-800">
                {status}
              </span>
            )}
          </div>
        </div>

        {/* Objectifs */}
        {objectives.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Objectifs de la séance
            </h3>
            <ul className="list-disc list-inside text-sm text-slate-800 space-y-0.5">
              {objectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Contenu / activités */}
        {activities.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Contenu / activités
            </h3>
            <div className="space-y-1.5">
              {activities.map((act, idx) => (
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
        {resources.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Ressources</h3>
            <ul className="space-y-1 text-sm">
              {resources.map((res, idx) => (
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
        {notes && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Suivi / notes
            </h3>
            <p className="text-sm text-slate-800 whitespace-pre-line">
              {notes}
            </p>
          </div>
        )}

        {/* Bouton action (garde ta logique actuelle via onEdit) */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:opacity-90"
          >
            Modifier
          </button>
        </div>
      </div>
    </section>
  );
}
