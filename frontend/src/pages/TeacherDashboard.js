import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Plus, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Mail, Edit } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const TERCIFORM_BLUE = '#1e3a5f';
const TERCIFORM_BLUE_LIGHT = '#e8f0f7';

export default function TeacherDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);

  const [sessionForm, setSessionForm] = useState({ subject: "", date: "", start_time: "", end_time: "", student_id: "", validation_deadline_hours: 48 });
  const [studentForm, setStudentForm] = useState({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", start_date: "", end_date: "", total_hours: 0 });

  const monthsList = [{ key: '2025-10', label: 'octobre 2025' }, { key: '2025-11', label: 'novembre 2025' }, { key: '2025-12', label: 'décembre 2025' }];

  useEffect(() => { setSelectedMonth('2025-10'); }, []);
  useEffect(() => { if (selectedMonth) loadData(selectedMonth); }, [selectedMonth]);

  const loadData = async (month) => {
    try {
      const [sessionsRes, studentsRes, statsRes] = await Promise.all([axios.get(`${API}/sessions`), axios.get(`${API}/students`), axios.get(`${API}/sessions/stats?month=${month}`)]);
      setSessions(sessionsRes.data);
      setStudents(studentsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Erreur chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentChange = useCallback((value) => { setSessionForm(prev => ({ ...prev, student_id: value })); }, []);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/sessions`, sessionForm);
      toast.success("Séance créée et email envoyé !");
      setShowCreateSession(false);
      setSessionForm({ subject: "", date: "", start_time: "", end_time: "", student_id: "", validation_deadline_hours: 48 });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/students`, { ...studentForm, role: "student", credit_hours: studentForm.total_hours });
      toast.success("Élève créé !");
      setShowCreateStudent(false);
      setStudentForm({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", start_date: "", end_date: "", total_hours: 0 });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Supprimer cette séance ?")) return;
    try {
      await axios.delete(`${API}/sessions/${sessionId}`);
      toast.success("Séance supprimée");
      loadData(selectedMonth);
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const handleResendEmail = async (sessionId) => {
    try {
      await axios.post(`${API}/sessions/${sessionId}/resend-email`);
      toast.success("Email renvoyé !");
    } catch (error) {
      toast.error("Erreur envoi");
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Supprimer ${studentName} ?`)) return;
    try {
      await axios.delete(`${API}/students/${studentId}`);
      toast.success("Élève supprimé");
      loadData(selectedMonth);
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name || "",
      phone: student.phone || "",
      email: student.email || "",
      password: "",
      organism: student.organism || "",
      support_type: student.support_type || "",
      start_date: student.start_date || "",
      end_date: student.end_date || "",
      total_hours: student.total_hours || student.credit_hours || 0
    });
    setShowEditStudent(true);
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      const updateData = { ...studentForm };
      if (!updateData.password) delete updateData.password;
      await axios.put(`${API}/students/${editingStudent.id}`, { ...updateData, credit_hours: updateData.total_hours });
      toast.success("Élève modifié !");
      setShowEditStudent(false);
      setEditingStudent(null);
      setStudentForm({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", start_date: "", end_date: "", total_hours: 0 });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  const getStatusBadge = (status) => {
    const cfg = { pending: { label: "En attente", icon: AlertCircle, className: "status-badge status-pending" }, confirmed: { label: "Confirmée", icon: CheckCircle, className: "status-badge status-confirmed" }, rejected: { label: "Refusée", icon: XCircle, className: "status-badge status-rejected" } };
    const c = cfg[status] || cfg.pending;
    const Icon = c.icon;
    return <span className={c.className}><Icon className="w-3 h-3 mr-1" />{c.label}</span>;
  };

  const formatDateWithDay = (dateString) => {
    const date = new Date(dateString);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayName = days[date.getDay()];
    const formatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${dayName} ${formatted}`;
  };

  const filteredSessions = sessions.filter(s => s.date.startsWith(selectedMonth));

  // Grouper par date + matière + horaire
  const groupedSessions = {};
  filteredSessions.forEach(session => {
    const key = `${session.date}_${session.subject}_${session.start_time}_${session.end_time}`;
    if (!groupedSessions[key]) {
      groupedSessions[key] = { subject: session.subject, date: session.date, start_time: session.start_time, end_time: session.end_time, duration_hours: session.duration_hours, sessions: [] };
    }
    groupedSessions[key].sessions.push(session);
  });
  const groupedSessionsList = Object.values(groupedSessions).sort((a, b) => a.date.localeCompare(b.date));

  // Filtrer élèves ayant des séances ce mois OU dont la date d'entrée est ce mois
  const studentsWithSessionsThisMonth = students.filter(student => {
    const hasSessionThisMonth = filteredSessions.some(s => s.student_id === student.id);
    const startDateInMonth = student.start_date && student.start_date.startsWith(selectedMonth);
    return hasSessionThisMonth || startDateInMonth;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: TERCIFORM_BLUE }}></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="https://customer-assets.emergentagent.com/job_f0bae013-d5d3-4906-a078-392b9e03aa37/artifacts/tiidl44l_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="Terciform" className="h-10" />
              <div className="border-l border-gray-300 pl-3">
                <h1 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>Espace Professeur</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <Button onClick={onLogout} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4" style={{ color: TERCIFORM_BLUE }}>Séances par mois</h2>
          <Tabs value={selectedMonth} onValueChange={setSelectedMonth} className="space-y-6">
            <TabsList className="bg-white border border-gray-200 shadow-sm flex-wrap h-auto">
              {monthsList.map(m => <TabsTrigger key={m.key} value={m.key} className="capitalize data-[state=active]:bg-gray-200" style={{ color: TERCIFORM_BLUE }}>{m.label}</TabsTrigger>)}
            </TabsList>

            {monthsList.map(month => (
              <TabsContent key={month.key} value={month.key} className="space-y-6">
                {stats && stats.month === month.key && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total</p><p className="text-3xl font-bold mt-1" style={{ color: TERCIFORM_BLUE }}>{stats.total_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.total_sessions} séance(s)</p></div><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}><Calendar className="w-6 h-6" style={{ color: TERCIFORM_BLUE }} /></div></div></CardContent></Card>
                    <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Confirmées</p><p className="text-3xl font-bold text-green-600 mt-1">{stats.confirmed_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.confirmed_sessions} séance(s)</p></div><div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-600" /></div></div></CardContent></Card>
                    <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Refusées</p><p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.rejected_sessions} séance(s)</p></div><div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><XCircle className="w-6 h-6 text-red-600" /></div></div></CardContent></Card>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Tabs defaultValue="sessions" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="sessions" className="data-[state=active]:text-white"><Calendar className="w-4 h-4 mr-2" />Séances</TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:text-white"><Users className="w-4 h-4 mr-2" />Élèves</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Liste des Séances</h2>
              <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
                <DialogTrigger asChild>
                  <Button className="gap-2 text-white" style={{ backgroundColor: TERCIFORM_BLUE }}><Plus className="w-4 h-4" />Créer une séance</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Nouvelle Séance</DialogTitle><DialogDescription>Créer une nouvelle séance</DialogDescription></DialogHeader>
                  <form onSubmit={handleCreateSession} className="space-y-4">
                    <div className="space-y-2"><Label>Matière</Label><Input placeholder="ex: Anglais" value={sessionForm.subject} onChange={(e) => setSessionForm({ ...sessionForm, subject: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Heure début</Label><Input type="time" value={sessionForm.start_time} onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })} required /></div>
                      <div className="space-y-2"><Label>Heure fin</Label><Input type="time" value={sessionForm.end_time} onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })} required /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Élève *</Label>
                      <select value={sessionForm.student_id} onChange={(e) => handleStudentChange(e.target.value)} className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md">
                        <option value="">Sélectionner un élève</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: TERCIFORM_BLUE }} disabled={!sessionForm.student_id}>Créer et envoyer</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {groupedSessionsList.length === 0 ? (
                <Card className="border-0 shadow-md"><CardContent className="pt-6 text-center text-gray-500">Aucune séance</CardContent></Card>
              ) : (
                groupedSessionsList.map((group, idx) => (
                  <Card key={idx} className="border-0 shadow-md card-hover">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">{group.subject}</h3>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-1">
                              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(group.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{group.start_time} - {group.end_time} ({group.duration_hours}h)</span>
                            </div>
                          </div>
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Élèves :</p>
                          <div className="space-y-2">
                            {group.sessions.map(session => (
                              <div key={session.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="font-medium text-gray-900">{session.student_name}</span>
                                  {getStatusBadge(session.status)}
                                  {session.validated_at && <span className="text-xs text-gray-500">le {formatDateWithDay(session.validated_at)}</span>}
                                  {session.signature && (
                                    <>
                                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                        ✓ Émargé
                                      </span>
                                      <img 
                                        src={session.signature} 
                                        alt="Signature" 
                                        className="h-10 border border-gray-300 rounded bg-white p-1 cursor-pointer hover:scale-150 transition-transform"
                                        title="Signature de l'élève"
                                      />
                                    </>
                                  )}
                                  {session.signature_status === "pending" && !session.signature && (
                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                      ⏳ En attente d'émargement
                                    </span>
                                  )}
                                  {session.signature_status === "expired" && (
                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                      ⚠️ Émargement expiré
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button onClick={() => handleResendEmail(session.id)} variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-50"><Mail className="w-4 h-4" /></Button>
                                  <Button onClick={() => handleDeleteSession(session.id)} variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Liste des Élèves</h2>
              <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
                <DialogTrigger asChild>
                  <Button className="gap-2 text-white" style={{ backgroundColor: TERCIFORM_BLUE }}><Plus className="w-4 h-4" />Ajouter un élève</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Nouvel Élève</DialogTitle><DialogDescription>Créer un compte élève</DialogDescription></DialogHeader>
                  <form onSubmit={handleCreateStudent} className="space-y-4">
                    <div className="space-y-2"><Label>Nom complet</Label><Input placeholder="ex: Jean Dupont" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Numéro de téléphone</Label><Input placeholder="ex: 06 12 34 56 78" value={studentForm.phone} onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="jean.dupont@email.com" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Mot de passe TerciLog</Label><Input type="password" placeholder="••••••••" value={studentForm.password} onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Organisme de formation</Label><Input placeholder="ex: Pôle Emploi" value={studentForm.organism} onChange={(e) => setStudentForm({ ...studentForm, organism: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Prise en charge parcours</Label><Input placeholder="ex: CPF" value={studentForm.support_type} onChange={(e) => setStudentForm({ ...studentForm, support_type: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Date d'entrée</Label><Input type="date" value={studentForm.start_date} onChange={(e) => setStudentForm({ ...studentForm, start_date: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Date de sortie</Label><Input type="date" value={studentForm.end_date} onChange={(e) => setStudentForm({ ...studentForm, end_date: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label>Heures totales</Label><Input type="number" step="0.5" min="0" placeholder="ex: 20" value={studentForm.total_hours} onChange={(e) => setStudentForm({ ...studentForm, total_hours: parseFloat(e.target.value) || 0 })} /></div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: TERCIFORM_BLUE }}>Créer l'élève</Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={showEditStudent} onOpenChange={setShowEditStudent}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Modifier Élève</DialogTitle><DialogDescription>Modifier les informations de l'élève</DialogDescription></DialogHeader>
                  <form onSubmit={handleUpdateStudent} className="space-y-4">
                    <div className="space-y-2"><Label>Nom complet</Label><Input placeholder="ex: Jean Dupont" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Numéro de téléphone</Label><Input placeholder="ex: 06 12 34 56 78" value={studentForm.phone} onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="jean.dupont@email.com" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Nouveau mot de passe (laisser vide pour ne pas changer)</Label><Input type="password" placeholder="••••••••" value={studentForm.password} onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Organisme de formation</Label><Input placeholder="ex: Pôle Emploi" value={studentForm.organism} onChange={(e) => setStudentForm({ ...studentForm, organism: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Prise en charge parcours</Label><Input placeholder="ex: CPF" value={studentForm.support_type} onChange={(e) => setStudentForm({ ...studentForm, support_type: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Date d'entrée</Label><Input type="date" value={studentForm.start_date} onChange={(e) => setStudentForm({ ...studentForm, start_date: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Date de sortie</Label><Input type="date" value={studentForm.end_date} onChange={(e) => setStudentForm({ ...studentForm, end_date: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label>Heures totales</Label><Input type="number" step="0.5" min="0" placeholder="ex: 20" value={studentForm.total_hours} onChange={(e) => setStudentForm({ ...studentForm, total_hours: parseFloat(e.target.value) || 0 })} /></div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: TERCIFORM_BLUE }}>Modifier l'élève</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {studentsWithSessionsThisMonth.length === 0 ? (
                <Card className="border-0 shadow-md"><CardContent className="pt-6 text-center text-gray-500">Aucun élève avec séances ce mois</CardContent></Card>
              ) : (
                studentsWithSessionsThisMonth.map(student => {
                  const studentSessions = sessions.filter(s => s.student_id === student.id);
                  return (
                    <Card key={student.id} className="border-0 shadow-md card-hover">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                <p><span className="font-medium">Email:</span> {student.email}</p>
                                {student.phone && <p><span className="font-medium">Tél:</span> {student.phone}</p>}
                                {student.start_date && <p><span className="font-medium">Date d'entrée:</span> {new Date(student.start_date).toLocaleDateString('fr-FR')}</p>}
                                {student.end_date && <p><span className="font-medium">Date de sortie:</span> {new Date(student.end_date).toLocaleDateString('fr-FR')}</p>}
                                {student.organism && <p><span className="font-medium">Organisme:</span> {student.organism}</p>}
                                {student.support_type && <p><span className="font-medium">Prise en charge:</span> {student.support_type}</p>}
                              </div>
                              <div className="flex items-center gap-3 mt-3">
                                <div className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: TERCIFORM_BLUE }}>
                                  <p className="text-xs opacity-90">Heures totales</p>
                                  <p className="text-xl font-bold">{student.total_hours || student.credit_hours}h</p>
                                </div>
                                <div className="px-4 py-2 rounded-lg" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}>
                                  <p className="text-xs text-gray-600">Heures restantes</p>
                                  <p className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>{student.credit_hours}h</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button onClick={() => handleEditStudent(student)} variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-50"><Edit className="w-4 h-4" /></Button>
                              <Button onClick={() => handleDeleteStudent(student.id, student.name)} variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </div>
                          {studentSessions.length > 0 && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Historique des séances</h4>
                              <div className="space-y-2">
                                {studentSessions.map(session => (
                                  <div key={session.id} className="flex items-center justify-between text-sm py-3 px-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3 flex-1 flex-wrap">
                                      <span className="font-medium text-gray-900">{session.subject}</span>
                                      <span className="text-gray-500">le {new Date(session.date).toLocaleDateString('fr-FR')}</span>
                                      <span className="font-semibold text-gray-700">{session.duration_hours}h</span>
                                      {session.status === 'confirmed' && session.validated_at && (
                                        <span className="text-xs text-green-700 font-medium">
                                          - Confirmée le {formatDateWithDay(session.validated_at)}
                                        </span>
                                      )}
                                      {session.status === 'rejected' && session.validated_at && (
                                        <span className="text-xs text-red-700 font-medium">
                                          - Refusée le {formatDateWithDay(session.validated_at)}
                                        </span>
                                      )}
                                      {session.status === 'pending' && (
                                        <span className="text-xs text-yellow-700 font-medium flex items-center gap-1">
                                          <AlertCircle className="w-4 h-4" />
                                          - En attente de validation
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {session.signature && session.signed_at && (
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                            ✓ Émargé le {formatDateWithDay(session.signed_at)}
                                          </span>
                                          <img 
                                            src={session.signature} 
                                            alt="Signature" 
                                            className="h-10 border-2 border-green-600 rounded bg-white p-1 cursor-pointer hover:scale-150 transition-transform"
                                            title="Signature de l'élève"
                                          />
                                        </div>
                                      )}
                                      {session.signature_status === "pending" && !session.signature && (
                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                          ⏳ En attente d'émargement
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
