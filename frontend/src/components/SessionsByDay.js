import React from "react";

/**
 * sessions: [
 *   {
 *     id: string | number,
 *     title: string,
 *     date: string,    // "2025-11-19" ou ISO
 *     status?: string, // optionnel
 *   }
 * ]
 *
 * year: number
 * month: number // 0 = janvier, 11 = décembre
 *
 * onOpenSession?: (session) => void
 * onEditSession?: (session) => void
 * onDeleteSession?: (session) => void
 */

function parseDate(dateString) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function SessionsByDay({
  sessions = [],
  year,
  month,
  onOpenSession,
  onEditSession,
  onDeleteSession,
}) {
  // Filtrer les séances qui appartiennent au mois / année donnés
  const filtered = sessions.filter((session) => {
    const d = parseDate(session.date);
    if (!d) return false;
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Regrouper par jour (clé = "YYYY-MM-DD")
  const groupsMap = filtered.reduce((acc, session) => {
    const d = parseDate(session.date);
    if (!d) return acc;
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!acc[key]) acc[key] = { date: d, sessions: [] };
    acc[key].sessions.push(session);
    return acc;
  }, {});

  // Transformer en tableau et trier par date
  const groups = Object.values(groupsMap).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const monthLabel = new Date(year, month, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="w-full max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Séances – {monthLabel}
        </h2>
        {/* Ici plus tard tu pourras ajouter des boutons mois précédent / suivant */}
      </header>

      {groups.length === 0 && (
        <p className="text-sm text-slate-600">
          Aucune séance pour ce mois.
        </p>
      )}

      <div className="space-y-5">
        {groups.map(({ date, sessions: daySessions }) => {
          const label = date.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });

          return (
            <div key={date.toISOString()} className="space-y-2">
              {/* Titre du jour */}
              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-slate-200" />
                <div className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                  {label}
                </div>
                <div className="h-[1px] flex-1 bg-slate-200" />
              </div>

              {/* Cartes de séances du jour : GRANDES et cliquables */}
              <div className="space-y-3">
                {daySessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1 flex-1">
                      {/* Titre cliquable pour ouvrir la séance */}
                      <button
                        type="button"
                        onClick={() =>
                          onOpenSession && onOpenSession(session)
                        }
                        className="text-sm md:text-base font-semibold text-slate-900 text-left hover:underline"
                      >
                        {session.title || "Séance"}
                      </button>
                      {session.status && (
                        <span className="inline-flex items-center rounded-full bg-slate-900 text-white text-xs px-2.5 py-1">
                          {session.status}
                        </span>
                      )}
                    </div>

                    {/* Boutons bien larges */}
                    <div className="flex flex-wrap gap-2 mt-2 md:mt-0 md:ml-4">
                      {onEditSession && (
                        <button
                          type="button"
                          onClick={() => onEditSession(session)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-900 text-white hover:opacity-90"
                        >
                          Modifier
                        </button>
                      )}
                      {onDeleteSession && (
                        <button
                          type="button"
                          onClick={() => onDeleteSession(session)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
