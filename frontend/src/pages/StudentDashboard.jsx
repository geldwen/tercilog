import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth.jsx";
import SignaturePad from "../components/SignaturePad.jsx";

const TABS = ["Planning", "Documents à signer", "Ressources"];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("Planning");
  const [message, setMessage] = useState(null);

  return (
    <div>
      <div className="topbar">
        <h1>TerciForm — Mon espace</h1>
        <div>
          <span style={{ marginRight: 16 }}>{user?.name}</span>
          <button onClick={logout}>Se déconnecter</button>
        </div>
      </div>
      <div className="container">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {message && (
          <div className={message.type === "error" ? "error" : "success"} onClick={() => setMessage(null)}>
            {message.text}
          </div>
        )}

        {tab === "Planning" && <PlanningView setMessage={setMessage} />}
        {tab === "Documents à signer" && <DocumentsView setMessage={setMessage} />}
        {tab === "Ressources" && <ResourcesView setMessage={setMessage} />}
      </div>
    </div>
  );
}

function PlanningView({ setMessage }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.get("/planning")
      .then((res) => setEvents(res.data.sort((a, b) => (a.event_date + a.start_time).localeCompare(b.event_date + b.start_time))))
      .catch((err) => setMessage({ type: "error", text: errorMessage(err) }));
  }, []);

  return (
    <div className="card">
      <h2>Mes séances à venir</h2>
      {events.length === 0 && <p className="muted">Aucune séance planifiée pour le moment.</p>}
      {events.map((ev) => (
        <div className="list-item" key={ev.id}>
          <div>
            <b>{ev.title}</b>
            <div className="muted">{ev.event_date} de {ev.start_time} à {ev.end_time} — {ev.modality}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentsView({ setMessage }) {
  const [docs, setDocs] = useState([]);
  const { user } = useAuth();
  const [signingId, setSigningId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get("/documents");
      setDocs(res.data);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  async function handleSign(docId, signatureData) {
    try {
      await api.post(`/documents/${docId}/sign`, { signature_data: signatureData });
      setMessage({ type: "success", text: "Document signé, merci !" });
      setSigningId(null);
      load();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  return (
    <div className="card">
      <h2>Mes documents</h2>
      {docs.length === 0 && <p className="muted">Aucun document pour le moment.</p>}
      {docs.map((d) => {
        const mine = d.assignments.find((a) => a.student_id === user.id);
        return (
          <div key={d.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #eee" }}>
            <div className="list-item" style={{ borderBottom: "none", padding: 0 }}>
              <div>
                <b>{d.title}</b> <span className="muted">({d.category})</span>
                {d.description && <div className="muted">{d.description}</div>}
              </div>
              <span className={`badge ${mine?.status}`}>{mine?.status === "signed" ? "Signé" : "À signer"}</span>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {d.file_path && (
                <a className="btn secondary small" href={`${api.defaults.baseURL}/documents/${d.id}/file`} target="_blank" rel="noreferrer">
                  Voir le document
                </a>
              )}
              {mine?.status !== "signed" && signingId !== d.id && (
                <button className="btn small" onClick={() => setSigningId(d.id)}>Signer</button>
              )}
            </div>
            {signingId === d.id && (
              <div style={{ marginTop: 12 }}>
                <p className="muted">Signe dans le cadre ci-dessous avec ta souris ou ton doigt :</p>
                <SignaturePad onSign={(data) => handleSign(d.id, data)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResourcesView({ setMessage }) {
  const [resources, setResources] = useState([]);

  useEffect(() => {
    api.get("/resources")
      .then((res) => setResources(res.data))
      .catch((err) => setMessage({ type: "error", text: errorMessage(err) }));
  }, []);

  return (
    <div className="card">
      <h2>Mes ressources</h2>
      {resources.length === 0 && <p className="muted">Aucune ressource pour le moment.</p>}
      {resources.map((r) => (
        <div className="list-item" key={r.id}>
          <div>
            <b>{r.title}</b>
            {r.description && <div className="muted">{r.description}</div>}
          </div>
          {r.file_path && (
            <a className="btn secondary small" href={`${api.defaults.baseURL}/resources/${r.id}/file`} target="_blank" rel="noreferrer">
              Consulter
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
