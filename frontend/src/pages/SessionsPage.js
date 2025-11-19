import React from "react";
import SessionsByDay from "../components/SessionsByDay";

export default function SessionsPage({ sessions }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // mois courant

  return (
    <div className="p-4">
      <SessionsByDay
        sessions={sessions}
        year={year}
        month={month}
        onOpenSession={(session) => {
          // ouvrir ta vue / ton modal actuel de séance
          console.log("Ouvrir séance:", session);
        }}
        onEditSession={(session) => {
          // logique existante pour modifier
          console.log("Éditer séance:", session);
        }}
        onDeleteSession={(session) => {
          // logique existante pour supprimer (si tu en as une)
          console.log("Supprimer séance:", session);
        }}
      />
    </div>
  );
}
