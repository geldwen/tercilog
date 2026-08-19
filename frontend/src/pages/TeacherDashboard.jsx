import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth.jsx";

const TABS = ["Élèves", "Planning", "Documents", "Ressources", "Export Qualiopi"];

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("Élèves");
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      const res = await api.get("/students");
      setStudents(res.data);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1>TerciForm — Espace formatrice</h1>
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

        {tab === "Élèves" && <StudentsPanel students={students} reload={loadStudents} setMessage={setMessage} />}
        {tab === "Planning" && <PlanningPanel students={students} setMessage={setMessage} />}
        {tab === "Documents" && <DocumentsPanel students={students} setMessage={setMessage} />}
        {tab === "Ressources" && <ResourcesPanel students={students} setMessage={setMessage} />}
        {tab === "Export Qualiopi" && <ExportPanel students={students} setMessage={setMessage} />}
      </div>
    </div>
  );
}

function StudentsPanel({ students, reload, setMessage }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", company: "", parcours: "" });
  const [loading, setLoading] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/students", { ...form, role: "student" });
      setMessage({ type: "success", text: `Élève ${form.name} créé — email de bienvenue envoyé.` });
      setForm({ name: "", email: "", password: "", company: "", parcours: "" });
      reload();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Ajouter un élève</h2>
        <form onSubmit={handleCreate}>
          <div className="grid-2">
            <div>
              <label>Nom complet</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label>Mot de passe temporaire</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label>Société / organisme</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label>Parcours</label>
              <input value={form.parcours} onChange={(e) => setForm({ ...form, parcours: e.target.value })} />
            </div>
          </div>
          <button className="btn" disabled={loading}>{loading ? "Création..." : "Créer l'élève"}</button>
        </form>
      </div>

      <div className="card">
        <h2>Élèves ({students.length})</h2>
        <table>
          <thead>
            <tr><th>Nom</th><th>Email</th><th>Société</th><th>Parcours</th></tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.email}</td><td>{s.company || "-"}</td><td>{s.parcours || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PlanningPanel({ students, setMessage }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    type: "session", title: "", event_date: "", start_time: "09:00", end_time: "10:00",
    student_id: "", modality: "presentiel", description: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get("/planning");
      setEvents(res.data.sort((a, b) => (a.event_date + a.start_time).localeCompare(b.event_date + b.start_time)));
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.type === "personal") payload.student_id = null;
      await api.post("/planning", payload);
      setMessage({ type: "success", text: "Événement ajouté au planning." });
      setForm({ ...form, title: "", event_date: "", description: "" });
      load();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/planning/${id}`);
      load();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  return (
    <>
      <div className="card">
        <h2>Ajouter un événement</h2>
        <form onSubmit={handleCreate}>
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="session">Séance (élève TerciLog)</option>
            <option value="personal">Rendez-vous personnel / externe</option>
          </select>
          <label>Titre</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          {form.type === "session" && (
            <>
              <label>Élève</label>
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
                <option value="">-- choisir --</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label>Modalité</label>
              <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
                <option value="presentiel">Présentiel</option>
                <option value="distanciel">Distanciel</option>
              </select>
            </>
          )}
          <div className="grid-2">
            <div>
              <label>Date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
            </div>
            <div />
            <div>
              <label>Heure de début</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div>
              <label>Heure de fin</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </div>
          </div>
          <label>Description (facultatif)</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn" disabled={loading}>{loading ? "Ajout..." : "Ajouter au planning"}</button>
        </form>
      </div>

      <div className="card">
        <h2>Planning ({events.length})</h2>
        {events.map((ev) => (
          <div className="list-item" key={ev.id}>
            <div>
              <b>{ev.title}</b> — {ev.event_date} de {ev.start_time} à {ev.end_time}
              <div className="muted">
                {ev.type === "session" ? `Séance • ${students.find((s) => s.id === ev.student_id)?.name || ""} • ${ev.modality}` : "Rendez-vous personnel"}
              </div>
            </div>
            <button className="btn secondary small" onClick={() => handleDelete(ev.id)}>Supprimer</button>
          </div>
        ))}
      </div>
    </>
  );
}

function DocumentsPanel({ students, setMessage }) {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({ title: "", category: "administratif", description: "", student_ids: [] });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get("/documents");
      setDocs(res.data);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  function toggleStudent(id) {
    setForm((f) => ({
      ...f,
      student_ids: f.student_ids.includes(id) ? f.student_ids.filter((x) => x !== id) : [...f.student_ids, id],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (form.student_ids.length === 0) {
      setMessage({ type: "error", text: "Sélectionne au moins un élève destinataire." });
      return;
    }
    setLoading(true);
    try {
      const data = new FormData();
      data.append("title", form.title);
      data.append("category", form.category);
      data.append("description", form.description);
      data.append("student_ids", form.student_ids.join(","));
      if (file) data.append("file", file);
      await api.post("/documents", data, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage({ type: "success", text: "Document envoyé aux élèves sélectionnés." });
      setForm({ title: "", category: "administratif", description: "", student_ids: [] });
      setFile(null);
      load();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Envoyer un document à signer</h2>
        <form onSubmit={handleCreate}>
          <label>Titre</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <label>Catégorie</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="administratif">Administratif (livret, contrat...)</option>
            <option value="emargement">Émargement de séance</option>
          </select>
          <label>Description (facultatif)</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Fichier PDF (facultatif)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
          <label>Destinataire(s)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {students.map((s) => (
              <button
                type="button"
                key={s.id}
                className={form.student_ids.includes(s.id) ? "btn small" : "btn secondary small"}
                onClick={() => toggleStudent(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button className="btn" disabled={loading}>{loading ? "Envoi..." : "Envoyer le document"}</button>
        </form>
      </div>

      <div className="card">
        <h2>Documents envoyés ({docs.length})</h2>
        {docs.map((d) => (
          <div key={d.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #eee" }}>
            <b>{d.title}</b> <span className="muted">({d.category})</span>
            <div style={{ marginTop: 6 }}>
              {d.assignments.map((a) => (
                <span key={a.student_id} style={{ marginRight: 10 }}>
                  {students.find((s) => s.id === a.student_id)?.name || a.student_id}{" "}
                  <span className={`badge ${a.status}`}>{a.status === "signed" ? "Signé" : "En attente"}</span>
                  {a.status === "signed" && (
                    <a
                      href={`${api.defaults.baseURL}/documents/${d.id}/certificate?student_id=${a.student_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: 6, fontSize: 12 }}
                    >
                      certificat
                    </a>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ResourcesPanel({ students, setMessage }) {
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", student_ids: [] });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get("/resources");
      setResources(res.data);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  function toggleStudent(id) {
    setForm((f) => ({
      ...f,
      student_ids: f.student_ids.includes(id) ? f.student_ids.filter((x) => x !== id) : [...f.student_ids, id],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (form.student_ids.length === 0) {
      setMessage({ type: "error", text: "Sélectionne au moins un élève destinataire." });
      return;
    }
    setLoading(true);
    try {
      const data = new FormData();
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("student_ids", form.student_ids.join(","));
      if (file) data.append("file", file);
      await api.post("/resources", data, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage({ type: "success", text: "Ressource envoyée." });
      setForm({ title: "", description: "", student_ids: [] });
      setFile(null);
      load();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Envoyer une ressource (consultation seule)</h2>
        <form onSubmit={handleCreate}>
          <label>Titre</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <label>Description (facultatif)</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Fichier (facultatif)</label>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <label>Destinataire(s)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {students.map((s) => (
              <button
                type="button"
                key={s.id}
                className={form.student_ids.includes(s.id) ? "btn small" : "btn secondary small"}
                onClick={() => toggleStudent(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button className="btn" disabled={loading}>{loading ? "Envoi..." : "Envoyer la ressource"}</button>
        </form>
      </div>

      <div className="card">
        <h2>Ressources envoyées ({resources.length})</h2>
        {resources.map((r) => (
          <div className="list-item" key={r.id}>
            <div>
              <b>{r.title}</b>
              <div className="muted">
                Envoyée à : {r.assignments.map((a) => students.find((s) => s.id === a.student_id)?.name || a.student_id).join(", ")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ExportPanel({ students, setMessage }) {
  const companies = [...new Set(students.map((s) => s.company).filter(Boolean))];

  async function exportStudent(id, name) {
    try {
      const res = await api.get(`/export/qualiopi/student/${id}`, { responseType: "blob" });
      downloadBlob(res.data, `qualiopi-${name}.pdf`);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  async function exportCompany(name) {
    try {
      const res = await api.get(`/export/qualiopi/company/${encodeURIComponent(name)}`, { responseType: "blob" });
      downloadBlob(res.data, `qualiopi-${name}.pdf`);
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err) });
    }
  }

  function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="card">
        <h2>Export par élève</h2>
        {students.map((s) => (
          <div className="list-item" key={s.id}>
            <span>{s.name} {s.company ? `(${s.company})` : ""}</span>
            <button className="btn small" onClick={() => exportStudent(s.id, s.name)}>Exporter en PDF</button>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Export par société</h2>
        {companies.length === 0 && <p className="muted">Aucune société renseignée pour l'instant.</p>}
        {companies.map((c) => (
          <div className="list-item" key={c}>
            <span>{c}</span>
            <button className="btn small" onClick={() => exportCompany(c)}>Exporter en PDF</button>
          </div>
        ))}
      </div>
    </>
  );
}
