import React from "react";
import SessionsByDay from "../components/SessionsByDay";

/**
 * IMPORTANT:
 * This page MUST reuse the existing sessions data that is already used
 * where the "Séances" view is currently rendered.
 *
 * Do NOT create new API calls or new backend code.
 * Use the same sessions array / state / props that the current "séances" page uses.
 */

export default function SessionsPage(props) {
  // Try to reuse sessions from props if available
  const sessions =
    props.sessions ||
    props.seances ||
    props.sessionList ||
    []; // fallback, will be wired from the existing page

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // current month

  const handleOpen = (session) => {
    // TODO: wire this to the existing "open session" logic
    // Example: props.onOpenSession?.(session) or navigate to detail
    // For now: console.log
    // console.log("Open session", session);
  };

  const handleEdit = (session) => {
    // TODO: wire this to the existing "edit session" logic
    // For now: console.log
    // console.log("Edit session", session);
  };

  const handleDelete = (session) => {
    // TODO: wire this to the existing "delete session" logic if it exists
    // For now: console.log
    // console.log("Delete session", session);
  };

  return (
    <div className="p-4">
      <SessionsByDay
        sessions={sessions}
        year={year}
        month={month}
        onOpenSession={handleOpen}
        onEditSession={handleEdit}
        onDeleteSession={handleDelete}
      />
    </div>
  );
}
