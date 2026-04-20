import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import './TerciCallCRM.css';
import {
  Building2, User, Phone, Mail, Globe, MapPin, FileText, Plus, Search,
  X, ChevronRight, Trash2, Download, Upload, Clock, CheckCircle,
  AlertCircle, LayoutGrid, List, LogOut, Users, Shield, Eye, Send,
  MessageSquare, Calendar, Star, TrendingUp, Briefcase, Hash, StickyNote, Pencil
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api/tercicall';

const STATUS_CONFIG = {
  vierge:  { label: 'Vierge', color: '#5a7099', bg: 'rgba(90,112,153,0.15)' },
  qualifie:{ label: 'Qualifié', color: '#4fc3f7', bg: 'rgba(79,195,247,0.15)' },
  negocie: { label: 'Négocié', color: '#ffd54f', bg: 'rgba(255,213,79,0.15)' },
  client1: { label: '1ère prestation', color: '#43a047', bg: 'rgba(67,160,71,0.15)' },
  fidele:  { label: 'Client fidèle', color: '#43a047', bg: 'rgba(67,160,71,0.25)' },
  perdu:   { label: 'Inactif', color: '#ef5350', bg: 'rgba(239,83,80,0.15)' },
};

const MARCHE_CONFIG = {
  direct: { label: 'Direct' },
  opco:   { label: 'OPCO' },
  ft:     { label: 'France Travail' },
  cci:    { label: 'CCI/CMA' },
  region: { label: 'Région IdF' },
  agefiph:{ label: 'AGEFIPH' },
  of:     { label: 'OF partenaires' },
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TerciCallCRM() {
  // Auth state
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [loginPrenom, setLoginPrenom] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Data
  const [fiches, setFiches] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, total_ca: 0, status_counts: {}, cat_counts: {}, marche_counts: {} });

  // UI state
  const [viewMode, setViewMode] = useState('cards');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMarche, setFilterMarche] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  // Panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedFiche, setSelectedFiche] = useState(null);
  const [panelTab, setPanelTab] = useState('fiche');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalCat, setModalCat] = useState('entreprise');
  const [editingFiche, setEditingFiche] = useState(null);
  const [formData, setFormData] = useState({});

  // Admin modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newUserPrenom, setNewUserPrenom] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');

  // Rappels du jour
  const [showRappels, setShowRappels] = useState(false);
  const [rappelsDuJour, setRappelsDuJour] = useState([]);

  // Action form in panel
  const [actionText, setActionText] = useState('');
  // Contact form
  const [contactForm, setContactForm] = useState({ nom: '', poste: '', tel: '', email: '' });
  // Rappel form
  const [rappelForm, setRappelForm] = useState({ date: '', note: '' });

  // Heartbeat
  const heartbeatRef = useRef(null);

  // --- Auth ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/login`, { prenom: loginPrenom, password: loginPassword });
      setSessionId(res.data.session_id);
      setCurrentUser(res.data);
      setLoggedIn(true);
      sessionStorage.setItem('tercicall_session', JSON.stringify(res.data));
      toast.success(`Bienvenue ${res.data.prenom} !`);
    } catch {
      toast.error('Identifiants incorrects');
    }
  };

  const handleLogout = async () => {
    if (sessionId) await axios.post(`${API}/logout`, { session_id: sessionId }).catch(() => {});
    setLoggedIn(false);
    setCurrentUser(null);
    setSessionId(null);
    sessionStorage.removeItem('tercicall_session');
  };

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem('tercicall_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCurrentUser(data);
        setSessionId(data.session_id);
        setLoggedIn(true);
      } catch { /* ignore */ }
    }
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!loggedIn || !sessionId) return;
    const beat = () => axios.post(`${API}/heartbeat`, { session_id: sessionId }).catch(() => {});
    beat();
    heartbeatRef.current = setInterval(beat, 15000);
    return () => clearInterval(heartbeatRef.current);
  }, [loggedIn, sessionId]);

  // --- Data Loading ---
  const loadFiches = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/fiches`);
      setFiches(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    loadFiches();
    loadStats();
    loadUsers();
    const interval = setInterval(() => { loadUsers(); }, 10000);
    return () => clearInterval(interval);
  }, [loggedIn, loadFiches, loadStats, loadUsers]);

  // --- Filtering & Sorting ---
  const getFiltered = useCallback(() => {
    let result = [...fiches];
    if (filterCat) result = result.filter(f => f.cat === filterCat);
    if (filterStatus) result = result.filter(f => f.status === filterStatus);
    if (filterMarche) result = result.filter(f => f.marche === filterMarche);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        (f.nom || '').toLowerCase().includes(q) ||
        (f.prenom || '').toLowerCase().includes(q) ||
        (f.email || '').toLowerCase().includes(q) ||
        (f.tel || '').includes(q) ||
        (f.siret || '').includes(q)
      );
    }
    // Sort
    if (sortBy === 'recent') result.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    else if (sortBy === 'alpha') result.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    else if (sortBy === 'status') {
      const order = ['vierge', 'qualifie', 'negocie', 'client1', 'fidele', 'perdu'];
      result.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    }
    return result;
  }, [fiches, filterCat, filterStatus, filterMarche, searchQuery, sortBy]);

  // --- CRUD ---
  const openNewModal = (cat) => {
    setEditingFiche(null);
    setModalCat(cat);
    setFormData({ cat, status: 'vierge', marche: 'direct' });
    setShowModal(true);
  };

  const openEditModal = (fiche) => {
    setEditingFiche(fiche);
    setModalCat(fiche.cat);
    setFormData({ ...fiche });
    setShowModal(true);
  };

  const saveFiche = async () => {
    try {
      if (editingFiche) {
        const res = await axios.put(`${API}/fiches/${editingFiche.id}`, formData);
        setSelectedFiche(res.data);
      } else {
        await axios.post(`${API}/fiches`, { ...formData, cat: modalCat });
      }
      setShowModal(false);
      await loadFiches();
      await loadStats();
      toast.success(editingFiche ? 'Fiche modifiée' : 'Fiche créée');
    } catch (err) {
      toast.error('Erreur: ' + (err.response?.data?.detail || 'Erreur inconnue'));
    }
  };

  const deleteFiche = async (id) => {
    if (!window.confirm('Supprimer cette fiche définitivement ?')) return;
    try {
      await axios.delete(`${API}/fiches/${id}`);
      setPanelOpen(false);
      setSelectedFiche(null);
      await loadFiches();
      await loadStats();
      toast.success('Fiche supprimée');
    } catch { toast.error('Erreur suppression'); }
  };

  const updateStatus = async (ficheId, newStatus) => {
    try {
      const res = await axios.put(`${API}/fiches/${ficheId}/status`, { status: newStatus });
      setSelectedFiche(res.data);
      await loadFiches();
      await loadStats();
    } catch { toast.error('Erreur mise à jour statut'); }
  };

  // Actions
  const addAction = async (ficheId, text) => {
    if (!text.trim()) return;
    try {
      await axios.post(`${API}/fiches/${ficheId}/actions`, { text });
      const res = await axios.get(`${API}/fiches`);
      setFiches(res.data);
      const updated = res.data.find(f => f.id === ficheId);
      if (updated) setSelectedFiche(updated);
      setActionText('');
    } catch { toast.error('Erreur ajout action'); }
  };

  const quickAction = async (ficheId, text) => {
    await addAction(ficheId, text);
  };

  const deleteAction = async (ficheId, index) => {
    try {
      await axios.delete(`${API}/fiches/${ficheId}/actions/${index}`);
      await loadFiches();
      const updated = fiches.find(f => f.id === ficheId);
      if (updated) {
        const res = await axios.get(`${API}/fiches`);
        const u = res.data.find(f => f.id === ficheId);
        if (u) setSelectedFiche(u);
      }
    } catch { toast.error('Erreur suppression'); }
  };

  // Contacts
  const addContact = async (ficheId) => {
    if (!contactForm.nom.trim()) return toast.error('Nom du contact requis');
    try {
      await axios.post(`${API}/fiches/${ficheId}/contacts`, contactForm);
      setContactForm({ nom: '', poste: '', tel: '', email: '' });
      await loadFiches();
      const res = await axios.get(`${API}/fiches`);
      const updated = res.data.find(f => f.id === ficheId);
      if (updated) setSelectedFiche(updated);
    } catch { toast.error('Erreur ajout contact'); }
  };

  const deleteContact = async (ficheId, index) => {
    try {
      await axios.delete(`${API}/fiches/${ficheId}/contacts/${index}`);
      await loadFiches();
      const res = await axios.get(`${API}/fiches`);
      const updated = res.data.find(f => f.id === ficheId);
      if (updated) setSelectedFiche(updated);
    } catch { toast.error('Erreur suppression contact'); }
  };

  // Rappels
  const saveRappel = async (ficheId) => {
    try {
      await axios.put(`${API}/fiches/${ficheId}/rappel`, { rappel: rappelForm.date ? rappelForm : null });
      await loadFiches();
      const res = await axios.get(`${API}/fiches`);
      const updated = res.data.find(f => f.id === ficheId);
      if (updated) setSelectedFiche(updated);
      toast.success('Rappel enregistré');
    } catch { toast.error('Erreur rappel'); }
  };

  const clearRappel = async (ficheId) => {
    try {
      await axios.put(`${API}/fiches/${ficheId}/rappel`, { rappel: null });
      await loadFiches();
      const res = await axios.get(`${API}/fiches`);
      const updated = res.data.find(f => f.id === ficheId);
      if (updated) setSelectedFiche(updated);
      setRappelForm({ date: '', note: '' });
    } catch { toast.error('Erreur'); }
  };

  // Rappels du jour
  const loadRappels = async () => {
    try {
      const res = await axios.get(`${API}/rappels-du-jour`);
      setRappelsDuJour(res.data);
      setShowRappels(true);
    } catch { toast.error('Erreur chargement rappels'); }
  };

  // CSV Export
  const exportCSV = () => {
    window.open(`${API}/export-csv`, '_blank');
  };

  // Admin - create user
  const createUser = async () => {
    if (!newUserPrenom || !newUserPassword) return toast.error('Prénom et mot de passe requis');
    try {
      await axios.post(`${API}/users`, { prenom: newUserPrenom, password: newUserPassword, role: newUserRole });
      setNewUserPrenom('');
      setNewUserPassword('');
      await loadUsers();
      toast.success('Utilisateur créé');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await axios.delete(`${API}/users/${userId}`);
      await loadUsers();
      toast.success('Utilisateur supprimé');
    } catch { toast.error('Erreur suppression'); }
  };

  // Open panel
  const openPanel = (fiche) => {
    setSelectedFiche(fiche);
    setPanelTab('fiche');
    setPanelOpen(true);
    if (fiche.rappel) setRappelForm(fiche.rappel);
    else setRappelForm({ date: '', note: '' });
  };

  // --- Format helpers ---
  const formatCA = (n) => {
    if (!n && n !== 0) return '0 €';
    return Number(n).toLocaleString('fr-FR') + ' €';
  };

  // --- RENDER ---
  if (!loggedIn) {
    return (
      <div className="tc-login-wrapper" data-testid="tercicall-login">
        <div className="tc-login-box">
          <div className="tc-login-logo">
            <Phone size={32} />
            <span>TerciCall</span>
          </div>
          <p className="tc-login-subtitle">CRM de Prospection</p>
          <form onSubmit={handleLogin}>
            <input
              type="text" placeholder="Prénom" value={loginPrenom}
              onChange={e => setLoginPrenom(e.target.value)}
              className="tc-input" data-testid="tercicall-login-prenom" autoFocus
            />
            <input
              type="password" placeholder="Mot de passe" value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              className="tc-input" data-testid="tercicall-login-password"
            />
            <button type="submit" className="tc-btn tc-btn-primary tc-btn-full" data-testid="tercicall-login-btn">
              Connexion
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filtered = getFiltered();
  const isAdmin = currentUser?.role === 'admin';
  const onlineUsers = users.filter(u => u.online && (isAdmin || u.role !== 'admin'));

  return (
    <div className="tc-app" data-testid="tercicall-crm">
      {/* ===== HEADER ===== */}
      <header className="tc-header">
        <div className="tc-header-left">
          <Phone size={22} className="tc-header-icon" />
          <span className="tc-header-title">TerciCall</span>
          <span className="tc-header-ca" data-testid="tercicall-ca">
            CA estimé : {formatCA(stats.total_ca)}
          </span>
        </div>
        <div className="tc-header-right">
          {/* Presence indicators */}
          {isAdmin && onlineUsers.length > 0 && (
            <div className="tc-presence">
              {onlineUsers.map(u => (
                <span key={u.id} className="tc-presence-dot" title={u.prenom}>
                  <span className="tc-dot-green" /> {u.prenom}
                </span>
              ))}
            </div>
          )}
          {!isAdmin && onlineUsers.filter(u => u.role !== 'admin').length > 0 && (
            <div className="tc-presence">
              {onlineUsers.filter(u => u.role !== 'admin').map(u => (
                <span key={u.id} className="tc-presence-dot" title={u.prenom}>
                  <span className="tc-dot-green" /> {u.prenom}
                </span>
              ))}
            </div>
          )}
          <span className="tc-user-name">{currentUser?.prenom}</span>
          {isAdmin && (
            <button className="tc-btn tc-btn-sm tc-btn-outline" onClick={() => { loadUsers(); setShowAdminModal(true); }} data-testid="tercicall-admin-btn">
              <Shield size={14} /> Admin
            </button>
          )}
          <button className="tc-btn tc-btn-sm tc-btn-ghost" onClick={handleLogout} data-testid="tercicall-logout-btn">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="tc-body">
        {/* ===== SIDEBAR ===== */}
        <aside className="tc-sidebar">
          <div className="tc-sidebar-section">
            <div className="tc-sidebar-title">VUE</div>
            <button className={`tc-sidebar-item ${!filterCat && !filterStatus && !filterMarche ? 'active' : ''}`}
              onClick={() => { setFilterCat(''); setFilterStatus(''); setFilterMarche(''); }}>
              <LayoutGrid size={16} /> Toutes les fiches
              <span className="tc-badge">{fiches.length}</span>
            </button>
          </div>

          <div className="tc-sidebar-section">
            <div className="tc-sidebar-title">CATEGORIES</div>
            <button className={`tc-sidebar-item ${filterCat === 'entreprise' ? 'active' : ''}`}
              onClick={() => { setFilterCat('entreprise'); setFilterStatus(''); setFilterMarche(''); }}>
              <Building2 size={16} /> Entreprises
              <span className="tc-badge">{stats.cat_counts?.entreprise || 0}</span>
            </button>
            <button className={`tc-sidebar-item ${filterCat === 'particulier' ? 'active' : ''}`}
              onClick={() => { setFilterCat('particulier'); setFilterStatus(''); setFilterMarche(''); }}>
              <User size={16} /> Particuliers
              <span className="tc-badge">{stats.cat_counts?.particulier || 0}</span>
            </button>
          </div>

          <div className="tc-sidebar-section">
            <div className="tc-sidebar-title">STATUTS</div>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button key={key} className={`tc-sidebar-item ${filterStatus === key ? 'active' : ''}`}
                onClick={() => { setFilterStatus(key); setFilterCat(''); setFilterMarche(''); }}>
                <span className="tc-flag" style={{ background: cfg.color }} />
                {cfg.label}
                <span className="tc-badge">{stats.status_counts?.[key] || 0}</span>
              </button>
            ))}
          </div>

          <div className="tc-sidebar-section">
            <div className="tc-sidebar-title">MARCHES</div>
            {Object.entries(MARCHE_CONFIG).map(([key, cfg]) => (
              <button key={key} className={`tc-sidebar-item ${filterMarche === key ? 'active' : ''}`}
                onClick={() => { setFilterMarche(key); setFilterCat(''); setFilterStatus(''); }}>
                <Briefcase size={14} /> {cfg.label}
                <span className="tc-badge">{stats.marche_counts?.[key] || 0}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="tc-main">
          {/* Toolbar */}
          <div className="tc-toolbar">
            <div className="tc-toolbar-left">
              <button className="tc-btn tc-btn-primary" onClick={() => openNewModal('entreprise')} data-testid="new-fiche-entreprise">
                <Plus size={16} /> Entreprise
              </button>
              <button className="tc-btn tc-btn-secondary" onClick={() => openNewModal('particulier')} data-testid="new-fiche-particulier">
                <Plus size={16} /> Particulier
              </button>
            </div>
            <div className="tc-toolbar-center">
              <div className="tc-search-wrap">
                <Search size={16} />
                <input type="text" placeholder="Rechercher..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} className="tc-search-input" data-testid="tercicall-search" />
                {searchQuery && <button className="tc-search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
              </div>
            </div>
            <div className="tc-toolbar-right">
              <select className="tc-select" value={sortBy} onChange={e => setSortBy(e.target.value)} data-testid="tercicall-sort">
                <option value="recent">Plus récentes</option>
                <option value="alpha">Alphabétique</option>
                <option value="status">Par statut</option>
              </select>
              <button className={`tc-btn tc-btn-icon ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')}>
                <LayoutGrid size={16} />
              </button>
              <button className={`tc-btn tc-btn-icon ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                <List size={16} />
              </button>
              <button className="tc-btn tc-btn-outline" onClick={loadRappels} data-testid="rappels-btn">
                <Clock size={14} /> Rappels
              </button>
              <button className="tc-btn tc-btn-outline" onClick={exportCSV}>
                <Download size={14} /> CSV
              </button>
            </div>
          </div>

          {/* Cards / List */}
          <div className="tc-content">
            {filtered.length === 0 ? (
              <div className="tc-empty">
                <Search size={48} />
                <p>Aucune fiche trouvée</p>
              </div>
            ) : viewMode === 'cards' ? (
              <div className="tc-cards-grid">
                {filtered.map(f => (
                  <FicheCard key={f.id} fiche={f} onClick={() => openPanel(f)} />
                ))}
              </div>
            ) : (
              <table className="tc-list-table">
                <thead>
                  <tr>
                    <th>Statut</th><th>Nom</th><th>Catégorie</th><th>Tél</th><th>Email</th><th>CA estimé</th><th>Marché</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id} onClick={() => openPanel(f)} className="tc-list-row" data-testid={`fiche-row-${f.id}`}>
                      <td><span className="tc-flag" style={{ background: STATUS_CONFIG[f.status]?.color || '#5a7099' }} /> {STATUS_CONFIG[f.status]?.label}</td>
                      <td className="tc-list-name">{f.nom} {f.prenom || ''}</td>
                      <td>{f.cat === 'entreprise' ? 'Entreprise' : 'Particulier'}</td>
                      <td>{f.tel}</td>
                      <td>{f.email}</td>
                      <td>{f.ca ? formatCA(f.ca) : '-'}</td>
                      <td>{MARCHE_CONFIG[f.marche]?.label || f.marche}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* ===== DETAIL PANEL ===== */}
      {panelOpen && selectedFiche && (
        <>
          <div className="tc-panel-overlay" onClick={() => setPanelOpen(false)} />
          <div className="tc-panel" data-testid="tercicall-panel">
            <div className="tc-panel-header">
              <div>
                <h2 className="tc-panel-name">{selectedFiche.nom} {selectedFiche.prenom || ''}</h2>
                <p className="tc-panel-sub">
                  {selectedFiche.cat === 'entreprise' ? 'Entreprise' : 'Particulier'}
                  {selectedFiche.secteur && ` • ${selectedFiche.secteur}`}
                </p>
              </div>
              <div className="tc-panel-actions-top">
                <button className="tc-btn tc-btn-sm tc-btn-outline" onClick={() => openEditModal(selectedFiche)}>
                  <Pencil size={14} /> Modifier
                </button>
                <button className="tc-btn tc-btn-sm tc-btn-danger" onClick={() => deleteFiche(selectedFiche.id)}>
                  <Trash2 size={14} />
                </button>
                <button className="tc-btn tc-btn-icon" onClick={() => setPanelOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Panel Tabs */}
            <div className="tc-panel-tabs">
              {['fiche', 'contacts', 'historique', 'documents'].map(tab => (
                <button key={tab} className={`tc-tab ${panelTab === tab ? 'active' : ''}`}
                  onClick={() => setPanelTab(tab)}>
                  {tab === 'fiche' ? 'Fiche' : tab === 'contacts' ? 'Contacts' : tab === 'historique' ? 'Historique' : 'Documents'}
                </button>
              ))}
            </div>

            <div className="tc-panel-body">
              {/* --- FICHE TAB --- */}
              {panelTab === 'fiche' && (
                <div className="tc-panel-fiche">
                  {/* Status bar */}
                  <div className="tc-status-bar">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button key={key}
                        className={`tc-status-btn ${selectedFiche.status === key ? 'active' : ''}`}
                        style={selectedFiche.status === key ? { background: cfg.color, color: '#fff', borderColor: cfg.color } : {}}
                        onClick={() => updateStatus(selectedFiche.id, key)}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>

                  <div className="tc-info-grid">
                    {selectedFiche.tel && <InfoRow icon={<Phone size={14}/>} label="Téléphone" value={selectedFiche.tel} link={`tel:${selectedFiche.tel}`} />}
                    {selectedFiche.email && <InfoRow icon={<Mail size={14}/>} label="Email" value={selectedFiche.email} link={`mailto:${selectedFiche.email}`} />}
                    {selectedFiche.web && <InfoRow icon={<Globe size={14}/>} label="Site web" value={selectedFiche.web} link={selectedFiche.web.startsWith('http') ? selectedFiche.web : `https://${selectedFiche.web}`} />}
                    {selectedFiche.adresse && <InfoRow icon={<MapPin size={14}/>} label="Adresse" value={selectedFiche.adresse} />}
                    {selectedFiche.siret && <InfoRow icon={<Hash size={14}/>} label="SIRET" value={selectedFiche.siret} />}
                    {selectedFiche.secteur && <InfoRow icon={<Briefcase size={14}/>} label="Secteur" value={selectedFiche.secteur} />}
                    {selectedFiche.salaries && <InfoRow icon={<Users size={14}/>} label="Salariés" value={selectedFiche.salaries} />}
                    {selectedFiche.ca && <InfoRow icon={<TrendingUp size={14}/>} label="CA estimé" value={formatCA(selectedFiche.ca)} />}
                    {selectedFiche.marche && <InfoRow icon={<Star size={14}/>} label="Marché" value={MARCHE_CONFIG[selectedFiche.marche]?.label || selectedFiche.marche} />}
                  </div>

                  {selectedFiche.notes && (
                    <div className="tc-notes-box">
                      <StickyNote size={14} /> <strong>Notes :</strong>
                      <p>{selectedFiche.notes}</p>
                    </div>
                  )}

                  {/* Rappel */}
                  <div className="tc-rappel-section">
                    <h4><Clock size={14} /> Rappel</h4>
                    {selectedFiche.rappel?.date ? (
                      <div className="tc-rappel-active">
                        <span>{selectedFiche.rappel.date} — {selectedFiche.rappel.note || 'Aucune note'}</span>
                        <button className="tc-btn tc-btn-sm tc-btn-danger" onClick={() => clearRappel(selectedFiche.id)}>
                          <X size={12} /> Effacer
                        </button>
                      </div>
                    ) : (
                      <div className="tc-rappel-form">
                        <input type="date" value={rappelForm.date} onChange={e => setRappelForm({ ...rappelForm, date: e.target.value })} className="tc-input tc-input-sm" />
                        <input type="text" placeholder="Note" value={rappelForm.note} onChange={e => setRappelForm({ ...rappelForm, note: e.target.value })} className="tc-input tc-input-sm" />
                        <button className="tc-btn tc-btn-sm tc-btn-primary" onClick={() => saveRappel(selectedFiche.id)}>
                          <CheckCircle size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- CONTACTS TAB --- */}
              {panelTab === 'contacts' && (
                <div className="tc-panel-contacts">
                  {(selectedFiche.contacts || []).map((c, i) => (
                    <div key={i} className="tc-contact-card">
                      <div className="tc-contact-info">
                        <strong>{c.nom}</strong> {c.poste && <span className="tc-contact-poste">{c.poste}</span>}
                        <div className="tc-contact-details">
                          {c.tel && <span><Phone size={12} /> {c.tel}</span>}
                          {c.email && <span><Mail size={12} /> {c.email}</span>}
                        </div>
                      </div>
                      <button className="tc-btn tc-btn-icon tc-btn-sm" onClick={() => deleteContact(selectedFiche.id, i)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="tc-contact-form">
                    <h4>Ajouter un contact</h4>
                    <div className="tc-form-row">
                      <input placeholder="Nom *" value={contactForm.nom} onChange={e => setContactForm({ ...contactForm, nom: e.target.value })} className="tc-input tc-input-sm" />
                      <input placeholder="Poste" value={contactForm.poste} onChange={e => setContactForm({ ...contactForm, poste: e.target.value })} className="tc-input tc-input-sm" />
                    </div>
                    <div className="tc-form-row">
                      <input placeholder="Téléphone" value={contactForm.tel} onChange={e => setContactForm({ ...contactForm, tel: e.target.value })} className="tc-input tc-input-sm" />
                      <input placeholder="Email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} className="tc-input tc-input-sm" />
                    </div>
                    <button className="tc-btn tc-btn-sm tc-btn-primary" onClick={() => addContact(selectedFiche.id)}>
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                </div>
              )}

              {/* --- HISTORIQUE TAB --- */}
              {panelTab === 'historique' && (
                <div className="tc-panel-historique">
                  {/* Quick actions */}
                  <div className="tc-quick-actions">
                    <button className="tc-btn tc-btn-sm tc-btn-outline" onClick={() => quickAction(selectedFiche.id, 'Appel passé')}><Phone size={12} /> Appel</button>
                    <button className="tc-btn tc-btn-sm tc-btn-outline" onClick={() => quickAction(selectedFiche.id, 'Email envoyé')}><Send size={12} /> Email</button>
                    <button className="tc-btn tc-btn-sm tc-btn-outline" onClick={() => quickAction(selectedFiche.id, 'Réunion effectuée')}><Users size={12} /> Réunion</button>
                    <button className="tc-btn tc-btn-sm tc-btn-outline" onClick={() => quickAction(selectedFiche.id, 'Devis envoyé')}><FileText size={12} /> Devis</button>
                  </div>

                  <div className="tc-action-form">
                    <input placeholder="Ajouter une action..." value={actionText}
                      onChange={e => setActionText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addAction(selectedFiche.id, actionText); }}
                      className="tc-input tc-input-sm" />
                    <button className="tc-btn tc-btn-sm tc-btn-primary" onClick={() => addAction(selectedFiche.id, actionText)}>
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="tc-timeline">
                    {(selectedFiche.actions || []).slice().reverse().map((a, i) => (
                      <div key={i} className="tc-timeline-item">
                        <span className="tc-timeline-date">{a.date}</span>
                        <span className="tc-timeline-text">{a.text}</span>
                        <button className="tc-btn tc-btn-icon tc-btn-xs" onClick={() => deleteAction(selectedFiche.id, (selectedFiche.actions || []).length - 1 - i)}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- DOCUMENTS TAB --- */}
              {panelTab === 'documents' && (
                <div className="tc-panel-documents">
                  <div className="tc-docs-list">
                    {(selectedFiche.documents || []).map((doc, i) => (
                      <div key={doc.id || i} className="tc-doc-item">
                        <FileText size={16} />
                        <div className="tc-doc-info">
                          <strong>{doc.name || doc.filename}</strong>
                          <span className="tc-doc-meta">{doc.type} • {doc.date}</span>
                        </div>
                        {doc.data && (
                          <button className="tc-btn tc-btn-icon tc-btn-sm" onClick={() => {
                            const link = document.createElement('a');
                            link.href = doc.data;
                            link.download = doc.filename;
                            link.click();
                          }}>
                            <Download size={14} />
                          </button>
                        )}
                        <button className="tc-btn tc-btn-icon tc-btn-sm" onClick={async () => {
                          await axios.delete(`${API}/fiches/${selectedFiche.id}/documents/${doc.id}`);
                          await loadFiches();
                          const res = await axios.get(`${API}/fiches`);
                          const u = res.data.find(f => f.id === selectedFiche.id);
                          if (u) setSelectedFiche(u);
                        }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <DocumentUpload ficheId={selectedFiche.id} onUploaded={async () => {
                    await loadFiches();
                    const res = await axios.get(`${API}/fiches`);
                    const u = res.data.find(f => f.id === selectedFiche.id);
                    if (u) setSelectedFiche(u);
                  }} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== NEW/EDIT MODAL ===== */}
      {showModal && (
        <div className="tc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()} data-testid="tercicall-fiche-modal">
            <div className="tc-modal-header">
              <h3>{editingFiche ? 'Modifier la fiche' : `Nouvelle fiche ${modalCat === 'entreprise' ? 'entreprise' : 'particulier'}`}</h3>
              <button className="tc-btn tc-btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="tc-modal-body">
              {modalCat === 'entreprise' ? (
                <>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>Nom entreprise *</label><input className="tc-input" value={formData.nom || ''} onChange={e => setFormData({ ...formData, nom: e.target.value })} /></div>
                    <div className="tc-form-group"><label>Statut</label>
                      <select className="tc-select" value={formData.status || 'vierge'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>SIRET</label><input className="tc-input" value={formData.siret || ''} onChange={e => setFormData({ ...formData, siret: e.target.value })} /></div>
                    <div className="tc-form-group"><label>Marché</label>
                      <select className="tc-select" value={formData.marche || 'direct'} onChange={e => setFormData({ ...formData, marche: e.target.value })}>
                        {Object.entries(MARCHE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>Téléphone</label><input className="tc-input" value={formData.tel || ''} onChange={e => setFormData({ ...formData, tel: e.target.value })} /></div>
                    <div className="tc-form-group"><label>Email</label><input className="tc-input" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                  </div>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>Site web</label><input className="tc-input" value={formData.web || ''} onChange={e => setFormData({ ...formData, web: e.target.value })} /></div>
                    <div className="tc-form-group"><label>Secteur</label><input className="tc-input" value={formData.secteur || ''} onChange={e => setFormData({ ...formData, secteur: e.target.value })} /></div>
                  </div>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>Salariés</label><input className="tc-input" value={formData.salaries || ''} onChange={e => setFormData({ ...formData, salaries: e.target.value })} /></div>
                    <div className="tc-form-group"><label>CA estimé (€)</label><input className="tc-input" type="number" value={formData.ca || ''} onChange={e => setFormData({ ...formData, ca: e.target.value })} /></div>
                  </div>
                  <div className="tc-form-group"><label>Adresse</label><input className="tc-input" value={formData.adresse || ''} onChange={e => setFormData({ ...formData, adresse: e.target.value })} /></div>
                  <div className="tc-form-group"><label>Notes</label><textarea className="tc-textarea" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>Nom *</label><input className="tc-input" value={formData.nom || ''} onChange={e => setFormData({ ...formData, nom: e.target.value })} /></div>
                    <div className="tc-form-group"><label>Prénom</label><input className="tc-input" value={formData.prenom || ''} onChange={e => setFormData({ ...formData, prenom: e.target.value })} /></div>
                  </div>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>Statut</label>
                      <select className="tc-select" value={formData.status || 'vierge'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div className="tc-form-group"><label>Téléphone</label><input className="tc-input" value={formData.tel || ''} onChange={e => setFormData({ ...formData, tel: e.target.value })} /></div>
                  </div>
                  <div className="tc-form-row">
                    <div className="tc-form-group"><label>Email</label><input className="tc-input" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                    <div className="tc-form-group"><label>Adresse</label><input className="tc-input" value={formData.adresse || ''} onChange={e => setFormData({ ...formData, adresse: e.target.value })} /></div>
                  </div>
                  <div className="tc-form-group"><label>Notes</label><textarea className="tc-textarea" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                </>
              )}
            </div>
            <div className="tc-modal-footer">
              <button className="tc-btn tc-btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="tc-btn tc-btn-primary" onClick={saveFiche} data-testid="save-fiche-btn">
                {editingFiche ? 'Enregistrer' : 'Créer la fiche'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADMIN MODAL ===== */}
      {showAdminModal && (
        <div className="tc-modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="tc-modal tc-modal-sm" onClick={e => e.stopPropagation()} data-testid="tercicall-admin-modal">
            <div className="tc-modal-header">
              <h3><Shield size={18} /> Gestion des utilisateurs</h3>
              <button className="tc-btn tc-btn-icon" onClick={() => setShowAdminModal(false)}><X size={18} /></button>
            </div>
            <div className="tc-modal-body">
              <div className="tc-users-list">
                {users.map(u => (
                  <div key={u.id} className="tc-user-row">
                    <span className="tc-user-row-dot" style={{ background: u.online ? '#43a047' : '#5a7099' }} />
                    <strong>{u.prenom}</strong>
                    <span className="tc-user-role">{u.role}</span>
                    {u.role !== 'admin' && (
                      <button className="tc-btn tc-btn-icon tc-btn-sm tc-btn-danger" onClick={() => deleteUser(u.id)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <hr className="tc-divider" />
              <h4>Nouvel utilisateur</h4>
              <div className="tc-form-row">
                <input placeholder="Prénom" value={newUserPrenom} onChange={e => setNewUserPrenom(e.target.value)} className="tc-input tc-input-sm" />
                <input placeholder="Mot de passe" type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="tc-input tc-input-sm" />
                <select className="tc-select tc-select-sm" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                  <option value="user">Utilisateur</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="tc-btn tc-btn-primary tc-btn-sm" onClick={createUser} data-testid="create-user-btn" style={{ marginTop: 8 }}>
                <Plus size={14} /> Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RAPPELS DU JOUR MODAL ===== */}
      {showRappels && (
        <div className="tc-modal-overlay" onClick={() => setShowRappels(false)}>
          <div className="tc-modal tc-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h3><Clock size={18} /> Rappels du jour</h3>
              <button className="tc-btn tc-btn-icon" onClick={() => setShowRappels(false)}><X size={18} /></button>
            </div>
            <div className="tc-modal-body">
              {rappelsDuJour.length === 0 ? (
                <p className="tc-empty-text">Aucun rappel pour aujourd'hui</p>
              ) : (
                rappelsDuJour.map(f => (
                  <div key={f.id} className="tc-rappel-item" onClick={() => { setShowRappels(false); openPanel(f); }}>
                    <strong>{f.nom} {f.prenom || ''}</strong>
                    <span className="tc-rappel-note">{f.rappel?.note || 'Rappel'}</span>
                    <span className="tc-rappel-date">{f.rappel?.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function FicheCard({ fiche, onClick }) {
  const status = STATUS_CONFIG[fiche.status] || STATUS_CONFIG.vierge;
  return (
    <div className="tc-fiche-card" onClick={onClick} data-testid={`fiche-card-${fiche.id}`}>
      <div className="tc-card-header">
        <span className="tc-flag" style={{ background: status.color }} />
        <span className="tc-card-status">{status.label}</span>
        {fiche.cat === 'entreprise' ? <Building2 size={14} className="tc-card-cat-icon" /> : <User size={14} className="tc-card-cat-icon" />}
      </div>
      <h3 className="tc-card-name">{fiche.nom} {fiche.prenom || ''}</h3>
      {fiche.secteur && <p className="tc-card-sub">{fiche.secteur}</p>}
      <div className="tc-card-details">
        {fiche.tel && <span><Phone size={12} /> {fiche.tel}</span>}
        {fiche.email && <span><Mail size={12} /> {fiche.email}</span>}
        {fiche.ca && <span><TrendingUp size={12} /> {Number(fiche.ca).toLocaleString('fr-FR')} €</span>}
      </div>
      {fiche.rappel?.date && (
        <div className="tc-card-rappel">
          <Clock size={12} /> {fiche.rappel.date}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, link }) {
  return (
    <div className="tc-info-row">
      <span className="tc-info-icon">{icon}</span>
      <span className="tc-info-label">{label}</span>
      {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="tc-info-value tc-link">{value}</a>
        : <span className="tc-info-value">{value}</span>}
    </div>
  );
}

function DocumentUpload({ ficheId, onUploaded }) {
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Autre');
  const fileRef = useRef(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error('Sélectionnez un fichier');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await axios.post(`${API}/fiches/${ficheId}/documents`, {
          filename: file.name, name: docName || file.name, type: docType, data: e.target.result
        });
        setDocName('');
        fileRef.current.value = '';
        onUploaded();
        toast.success('Document ajouté');
      } catch { toast.error('Erreur upload'); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="tc-doc-upload">
      <h4>Ajouter un document</h4>
      <div className="tc-form-row">
        <input placeholder="Nom du document" value={docName} onChange={e => setDocName(e.target.value)} className="tc-input tc-input-sm" />
        <select value={docType} onChange={e => setDocType(e.target.value)} className="tc-select tc-select-sm">
          <option>Devis</option><option>Proposition</option><option>Contrat</option><option>Facture</option><option>Autre</option>
        </select>
      </div>
      <div className="tc-form-row" style={{ marginTop: 8 }}>
        <input type="file" ref={fileRef} className="tc-input tc-input-sm" accept=".pdf,.doc,.docx,.xls,.xlsx" />
        <button className="tc-btn tc-btn-sm tc-btn-primary" onClick={handleUpload}>
          <Upload size={14} /> Upload
        </button>
      </div>
    </div>
  );
}
