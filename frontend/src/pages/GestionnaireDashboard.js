import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  LogOut, Calendar, Users, Clock, CheckCircle, XCircle, 
  Mail, Phone, Building, ChevronLeft, ChevronRight, PenTool,
  Search, Plus, Edit, Trash2, History, CalendarDays, Eye,
  Monitor, School, Video, FileText, Award, Download, X,
  Archive, RotateCcw
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const TERCIFORM_BLUE = '#0D2040';

export default function GestionnaireDashboard({ user, onLogout }) {
  const [client, setClient] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');
  
  // Données
  const [students, setStudents] = useState([]);
  const [archivedStudents, setArchivedStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [formateurs, setFormateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Planning / Filtres
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(new Date().getMonth() + 1);
  
  // Recherche élèves
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchStudent, setShowSearchStudent] = useState(false);
  const [filteredStudents, setFilteredStudents] = useState(null);
  const [showArchivedStudents, setShowArchivedStudents] = useState(false);
  
  // Création élève
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '', email: '', phone: '', parcours: '', total_hours: 0,
    organism: '', support_type: '', start_date: '', end_date: '',
    password: '', teacher_id: '', teacher_name: ''
  });
  
  // Édition élève
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  
  // Historique élève
  const [showStudentHistory, setShowStudentHistory] = useState(false);
  const [studentHistory, setStudentHistory] = useState([]);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);
  
  // Planning élève
  const [showStudentPlanning, setShowStudentPlanning] = useState(false);
  const [selectedStudentForPlanning, setSelectedStudentForPlanning] = useState(null);
  const [studentSessions, setStudentSessions] = useState([]);
  
  // Planning formateur
  const [showFormateurPlanning, setShowFormateurPlanning] = useState(false);
  const [selectedFormateur, setSelectedFormateur] = useState(null);
  const [formateurSessions, setFormateurSessions] = useState([]);
  
  // Session détails (lecture seule)
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  const months = [
    { num: 1, label: 'Janvier' }, { num: 2, label: 'Février' }, { num: 3, label: 'Mars' },
    { num: 4, label: 'Avril' }, { num: 5, label: 'Mai' }, { num: 6, label: 'Juin' },
    { num: 7, label: 'Juillet' }, { num: 8, label: 'Août' }, { num: 9, label: 'Septembre' },
    { num: 10, label: 'Octobre' }, { num: 11, label: 'Novembre' }, { num: 12, label: 'Décembre' }
  ];

  const yearsList = [2024, 2025, 2026, 2027];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientRes, studentsRes, sessionsRes, formateursRes, archivedRes] = await Promise.all([
        axios.get(`${API}/gestionnaire/client`),
        axios.get(`${API}/gestionnaire/students`),
        axios.get(`${API}/gestionnaire/sessions`),
        axios.get(`${API}/gestionnaire/formateurs`),
        axios.get(`${API}/gestionnaire/archived-students`).catch(() => ({ data: [] }))
      ]);
      
      setClient(clientRes.data);
      setStudents(studentsRes.data || []);
      setSessions(sessionsRes.data || []);
      setFormateurs(formateursRes.data || []);
      setArchivedStudents(archivedRes.data || []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      if (error.response?.status === 403) {
        toast.error('Accès non autorisé');
        onLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les sessions du mois sélectionné
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (!s.date) return false;
      const sessionDate = new Date(s.date);
      return sessionDate.getFullYear() === selectedYear && 
             (sessionDate.getMonth() + 1) === selectedMonthNum;
    }).sort((a, b) => {
      // Trier par date puis par heure
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
  }, [sessions, selectedYear, selectedMonthNum]);

  // Séances du jour
  const todaySessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sessions.filter(s => s.date === today).sort((a, b) => 
      (a.start_time || '').localeCompare(b.start_time || '')
    );
  }, [sessions]);

  // Stats du mois
  const monthStats = useMemo(() => {
    const total = filteredSessions.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
    const signed = filteredSessions.filter(s => s.signature).reduce((sum, s) => sum + (s.duration_hours || 0), 0);
    const unsigned = total - signed;
    return { total, signed, unsigned, count: filteredSessions.length };
  }, [filteredSessions]);

  const goToPreviousMonth = () => {
    if (selectedMonthNum === 1) {
      setSelectedMonthNum(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonthNum(selectedMonthNum - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonthNum === 12) {
      setSelectedMonthNum(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonthNum(selectedMonthNum + 1);
    }
  };

  // Icône selon matière
  const getSubjectIcon = (subject) => {
    const s = (subject || '').toLowerCase();
    if (s.includes('anglais')) return '🇬🇧';
    if (s.includes('informatique') || s.includes('bureautique')) return '💻';
    if (s.includes('français')) return '🇫🇷';
    if (s.includes('espagnol')) return '🇪🇸';
    if (s.includes('allemand')) return '🇩🇪';
    return '📚';
  };

  // Recherche élève
  const handleSearchStudent = () => {
    if (!searchQuery.trim()) {
      toast.error('Veuillez entrer un terme de recherche');
      return;
    }
    const query = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const results = students.filter(s => {
      const name = (s.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const phone = (s.phone || '').replace(/\s/g, '');
      return name.includes(query) || phone.includes(query.replace(/\s/g, ''));
    });
    if (results.length === 0) {
      toast.error('Aucun élève trouvé');
    } else {
      setFilteredStudents(results);
      setShowSearchStudent(false);
      toast.success(`${results.length} élève(s) trouvé(s)`);
    }
  };

  const resetStudentSearch = () => {
    setFilteredStudents(null);
    setSearchQuery('');
  };

  // Création élève
  const handleCreateStudent = async () => {
    if (!studentForm.name || !studentForm.email || !studentForm.password) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }
    try {
      const payload = {
        ...studentForm,
        client_id: user.client_id,
        client_name: client?.nom_centre
      };
      await axios.post(`${API}/gestionnaire/students`, payload);
      toast.success('Élève créé avec succès');
      setShowCreateStudent(false);
      setStudentForm({
        name: '', email: '', phone: '', parcours: '', total_hours: 0,
        organism: '', support_type: '', start_date: '', end_date: '',
        password: '', teacher_id: '', teacher_name: ''
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  // Édition élève
  const openEditStudent = (student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      parcours: student.parcours || '',
      total_hours: student.total_hours || 0,
      organism: student.organism || '',
      support_type: student.support_type || '',
      start_date: student.start_date || '',
      end_date: student.end_date || '',
      teacher_id: student.teacher_id || '',
      teacher_name: student.teacher_name || ''
    });
    setShowEditStudent(true);
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    try {
      await axios.patch(`${API}/gestionnaire/students/${editingStudent.id}`, studentForm);
      toast.success('Élève modifié avec succès');
      setShowEditStudent(false);
      setEditingStudent(null);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  // Suppression élève
  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet élève ?')) return;
    try {
      await axios.delete(`${API}/gestionnaire/students/${studentId}`);
      toast.success('Élève supprimé');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  // Historique élève
  const openStudentHistory = async (student) => {
    setSelectedStudentForHistory(student);
    try {
      const res = await axios.get(`${API}/students/${student.id}/activity-logs`);
      setStudentHistory(res.data || []);
    } catch {
      setStudentHistory([]);
    }
    setShowStudentHistory(true);
  };

  // Planning élève
  const openStudentPlanning = async (student) => {
    setSelectedStudentForPlanning(student);
    const studentSess = sessions.filter(s => s.student_id === student.id);
    setStudentSessions(studentSess);
    setShowStudentPlanning(true);
  };

  // Planning formateur
  const openFormateurPlanning = async (formateur) => {
    setSelectedFormateur(formateur);
    try {
      const res = await axios.get(`${API}/formateurs/${formateur.id}/sessions`);
      setFormateurSessions(res.data || []);
    } catch {
      // Fallback: filtrer les sessions locales
      const formateurSess = sessions.filter(s => s.teacher_id === formateur.id);
      setFormateurSessions(formateurSess);
    }
    setShowFormateurPlanning(true);
  };

  // Archivage élève
  const handleArchiveStudent = async (studentId) => {
    if (!window.confirm('Archiver cet élève (sortie de parcours) ?')) return;
    try {
      await axios.post(`${API}/gestionnaire/students/${studentId}/archive`);
      toast.success('Élève archivé');
      loadData();
    } catch (error) {
      toast.error('Erreur lors de l\'archivage');
    }
  };

  // Restauration élève
  const handleRestoreStudent = async (studentId) => {
    try {
      await axios.post(`${API}/gestionnaire/students/${studentId}/restore`);
      toast.success('Élève restauré');
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la restauration');
    }
  };

  // Afficher les élèves (filtrés ou tous)
  const displayedStudents = filteredStudents || students;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" 
                alt="TerciForm" 
                className="h-10"
              />
              <div>
                <h1 className="text-white font-bold text-lg">Espace Gestionnaire</h1>
                {client && (
                  <p className="text-slate-300 text-sm">{client.nom_centre}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-300">{user?.name}</span>
              <Button 
                variant="ghost" 
                onClick={onLogout}
                className="text-white hover:bg-slate-600"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Fond coloré selon l'onglet */}
        <div 
          className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${
            activeTab === 'sessions' 
              ? 'bg-emerald-200' 
              : activeTab === 'students' 
                ? 'bg-violet-200' 
                : 'bg-amber-200'
          }`}
          style={{ top: '72px' }}
        />

        <Tabs defaultValue="sessions" value={activeTab} onValueChange={setActiveTab} className="space-y-6 relative z-10">
          {/* Onglets */}
          <div className="flex justify-center gap-4 mb-6">
            <TabsList className="bg-transparent border-0 shadow-none p-0 h-auto gap-4">
              <TabsTrigger 
                value="sessions" 
                data-testid="sessions-tab"
                className="px-8 py-3 text-base font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-emerald-500 data-[state=inactive]:text-white data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                <Calendar className="w-5 h-5 mr-2" />
                SÉANCES
              </TabsTrigger>
              <TabsTrigger 
                value="students" 
                data-testid="students-tab"
                className="px-8 py-3 text-base font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-violet-500 data-[state=inactive]:text-white data-[state=active]:bg-violet-600 data-[state=active]:text-white"
              >
                <Users className="w-5 h-5 mr-2" />
                ÉLÈVES
              </TabsTrigger>
              <TabsTrigger 
                value="formateurs" 
                data-testid="formateurs-tab"
                className="px-8 py-3 text-base font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-amber-500 data-[state=inactive]:text-white data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              >
                <PenTool className="w-5 h-5 mr-2" />
                FORMATEURS
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ===== ONGLET SÉANCES ===== */}
          <TabsContent value="sessions" className="space-y-6">
            {/* Filtres mois/année */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <button onClick={goToPreviousMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Année :</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Mois :</label>
                <select
                  value={selectedMonthNum}
                  onChange={(e) => setSelectedMonthNum(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {months.map(m => <option key={m.num} value={m.num}>{m.label}</option>)}
                </select>
              </div>
              <button onClick={goToNextMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <div className="ml-auto text-sm text-gray-500">
                Période : <span className="font-medium" style={{ color: TERCIFORM_BLUE }}>{months.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</span>
              </div>
            </div>

            {/* Stats du mois */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2 shadow-md" style={{ borderColor: TERCIFORM_BLUE }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Heures du mois</p>
                      <p className="text-3xl font-bold" style={{ color: TERCIFORM_BLUE }}>{monthStats.total}h</p>
                      <p className="text-xs text-gray-500">{monthStats.count} séance(s)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100">
                      <Calendar className="w-6 h-6" style={{ color: TERCIFORM_BLUE }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-green-400 shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Heures émargées</p>
                      <p className="text-3xl font-bold text-green-600">{monthStats.signed}h</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-orange-400 shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Heures non émargées</p>
                      <p className="text-3xl font-bold text-orange-600">{monthStats.unsigned}h</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Séances du jour */}
            <Card className="border-2 border-red-400 shadow-md bg-gradient-to-r from-red-50 to-orange-50">
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-5 h-5 text-red-500" />
                  <span className="font-bold text-red-600">Séances du jour</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })})
                  </span>
                </div>
                {todaySessions.length === 0 ? (
                  <div className="flex items-center gap-3 py-2 justify-center">
                    <span className="text-2xl">🌴</span>
                    <p className="text-sm text-gray-600">Aucune séance aujourd'hui</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todaySessions.map(session => {
                      const student = students.find(s => s.id === session.student_id);
                      const isVisio = session.modality === 'distanciel' || session.meeting_link;
                      return (
                        <div key={session.id} className="flex items-center justify-between p-2 rounded bg-white border text-sm">
                          <div className="flex items-center gap-2">
                            <span>{getSubjectIcon(session.subject)}</span>
                            {isVisio ? <Monitor className="w-4 h-4 text-blue-500" /> : <School className="w-4 h-4 text-amber-500" />}
                            <span className="font-medium">{student?.name || 'Élève'}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">{session.subject}</span>
                            <span className="text-gray-400 text-xs">({session.start_time}-{session.end_time})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {session.signature ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Émargée
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">Non émargée</span>
                            )}
                            <button
                              onClick={() => { setSelectedSession(session); setShowSessionDetails(true); }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Voir détails"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Liste des séances du mois */}
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-800 mb-4">
                  Séances de {months.find(m => m.num === selectedMonthNum)?.label} {selectedYear} ({filteredSessions.length})
                </h3>
                {filteredSessions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucune séance ce mois-ci</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredSessions.map(session => {
                      const student = students.find(s => s.id === session.student_id);
                      const formateur = formateurs.find(f => f.id === session.teacher_id);
                      const isVisio = session.modality === 'distanciel' || session.meeting_link;
                      return (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                          onClick={() => { setSelectedSession(session); setShowSessionDetails(true); }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-center min-w-[60px]">
                              <div className="text-xs text-gray-500">{new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                              <div className="font-bold text-lg">{new Date(session.date).getDate()}</div>
                            </div>
                            <div className="border-l-2 border-gray-200 pl-3">
                              <div className="flex items-center gap-2">
                                <span>{getSubjectIcon(session.subject)}</span>
                                {isVisio ? <Monitor className="w-4 h-4 text-blue-500" /> : <School className="w-4 h-4 text-amber-500" />}
                                <span className="font-medium">{student?.name || 'Élève'}</span>
                              </div>
                              <div className="text-sm text-gray-600">{session.subject} • {session.start_time}-{session.end_time}</div>
                              {formateur && <div className="text-xs text-gray-400">Formateur: {formateur.prenom} {formateur.nom}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{session.duration_hours || 0}h</span>
                            {session.signature ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">✓</span>
                            ) : (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">...</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== ONGLET ÉLÈVES ===== */}
          <TabsContent value="students" className="space-y-6">
            {/* En-tête avec recherche et création */}
            <div className="flex items-center justify-between p-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Gestion des Élèves</h2>
              <div className="flex gap-3">
                {filteredStudents && (
                  <Button onClick={resetStudentSearch} variant="outline" className="gap-2">
                    <XCircle className="w-4 h-4" />
                    Tous ({students.length})
                  </Button>
                )}
                
                {/* Bouton historisés */}
                <Button 
                  onClick={() => setShowArchivedStudents(true)} 
                  variant="outline" 
                  className="gap-2 border-gray-400"
                >
                  <Archive className="w-4 h-4" />
                  Historisés ({archivedStudents.length})
                </Button>

                {/* Recherche */}
                <Dialog open={showSearchStudent} onOpenChange={setShowSearchStudent}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200">
                      <Search className="w-4 h-4" />
                      Rechercher
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rechercher un élève</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Input
                        placeholder="Nom, prénom ou téléphone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchStudent()}
                        autoFocus
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSearchStudent(false)}>Annuler</Button>
                      <Button onClick={handleSearchStudent} style={{ backgroundColor: TERCIFORM_BLUE }} className="text-white">
                        <Search className="w-4 h-4 mr-2" />
                        Rechercher
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Création */}
                <button 
                  onClick={() => setShowCreateStudent(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un élève
                </button>
              </div>
            </div>

            {/* Liste des élèves */}
            {displayedStudents.length === 0 ? (
              <div className="text-center py-16 bg-white/80 rounded-2xl shadow-lg">
                <Users className="w-20 h-20 mx-auto text-violet-300 mb-4" />
                <p className="text-gray-600 text-lg">Aucun élève</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedStudents.map(student => (
                  <Card key={student.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                          <span className="text-lg font-bold text-violet-600">{student.name?.charAt(0) || '?'}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{student.name}</h3>
                          <p className="text-sm text-gray-500">{student.parcours || 'Parcours non défini'}</p>
                          {student.email && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                              <Mail className="w-3 h-3" />{student.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs">
                          {student.credit_hours || 0}h restantes
                        </span>
                        {student.teacher_name && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                            {student.teacher_name}
                          </span>
                        )}
                      </div>
                      {/* Boutons d'action */}
                      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                        <button
                          onClick={() => openStudentPlanning(student)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          <Calendar className="w-3 h-3" />
                          Planning
                        </button>
                        <button
                          onClick={() => openEditStudent(student)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                        >
                          <Edit className="w-3 h-3" />
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-3 h-3" />
                          Supprimer
                        </button>
                        <button
                          onClick={() => openStudentHistory(student)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          <History className="w-3 h-3" />
                          Historique
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== ONGLET FORMATEURS ===== */}
          <TabsContent value="formateurs" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Formateurs ({formateurs.length})</h2>
            </div>

            {formateurs.length === 0 ? (
              <div className="text-center py-16 bg-white/80 rounded-2xl shadow-lg">
                <PenTool className="w-20 h-20 mx-auto text-amber-300 mb-4" />
                <p className="text-gray-600 text-lg">Aucun formateur enregistré</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {formateurs.map((formateur) => (
                  <div key={formateur.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow relative">
                    {/* Bouton Planning */}
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        onClick={() => openFormateurPlanning(formateur)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 border-2 border-gray-700"
                      >
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-medium">Voir planning</span>
                      </button>
                    </div>

                    {/* En-tête */}
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 pt-16">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden flex-shrink-0">
                          {formateur.photo_url ? (
                            <img 
                              src={`${API}/formateurs/${formateur.id}/photo`}
                              alt={`${formateur.prenom} ${formateur.nom}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-amber-100 flex items-center justify-center">
                              <span className="text-2xl font-bold text-amber-600">
                                {formateur.prenom?.[0]}{formateur.nom?.[0]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-white">
                          <h3 className="text-xl font-bold">{formateur.prenom} {formateur.nom}</h3>
                          {formateur.societe && <p className="text-amber-100 text-sm">{formateur.societe}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Corps */}
                    <div className="p-4 space-y-3">
                      {formateur.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm truncate">{formateur.email}</span>
                        </div>
                      )}
                      {formateur.telephone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">{formateur.telephone}</span>
                        </div>
                      )}
                      {formateur.siret && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">SIRET: {formateur.siret}</span>
                        </div>
                      )}
                      {formateur.nda && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Award className="w-4 h-4" />
                          <span className="text-sm">NDA: {formateur.nda}</span>
                        </div>
                      )}

                      {/* Matières */}
                      {formateur.matieres && formateur.matieres.length > 0 && formateur.matieres[0] && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">MATIÈRES ENSEIGNÉES</p>
                          <div className="flex flex-wrap gap-1">
                            {formateur.matieres.filter(m => m).map((matiere, idx) => (
                              <span key={idx} className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                                {matiere}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {(formateur.cv_url || formateur.diplome1_url || formateur.diplome2_url) && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">DOCUMENTS</p>
                          <div className="flex flex-wrap gap-2">
                            {formateur.cv_url && (
                              <button 
                                onClick={() => window.open(`${API}/formateurs/${formateur.id}/download/cv?token=${localStorage.getItem('token')}`, '_blank')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs hover:bg-blue-200"
                              >
                                <Download className="w-3 h-3" />CV
                              </button>
                            )}
                            {formateur.diplome1_url && (
                              <button 
                                onClick={() => window.open(`${API}/formateurs/${formateur.id}/download/diplome1?token=${localStorage.getItem('token')}`, '_blank')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs hover:bg-green-200"
                              >
                                <Download className="w-3 h-3" />Diplôme 1
                              </button>
                            )}
                            {formateur.diplome2_url && (
                              <button 
                                onClick={() => window.open(`${API}/formateurs/${formateur.id}/download/diplome2?token=${localStorage.getItem('token')}`, '_blank')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs hover:bg-green-200"
                              >
                                <Download className="w-3 h-3" />Diplôme 2
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* ===== MODALS ===== */}

      {/* Modal détails séance (lecture seule) */}
      <Dialog open={showSessionDetails} onOpenChange={setShowSessionDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de la séance</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Élève</p>
                  <p className="font-medium">{students.find(s => s.id === selectedSession.student_id)?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Matière</p>
                  <p className="font-medium">{selectedSession.subject}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{new Date(selectedSession.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Horaires</p>
                  <p className="font-medium">{selectedSession.start_time} - {selectedSession.end_time}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Durée</p>
                  <p className="font-medium">{selectedSession.duration_hours || 0}h</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Modalité</p>
                  <p className="font-medium">{selectedSession.modality === 'distanciel' ? 'Distanciel' : 'Présentiel'}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500">Statut émargement</p>
                {selectedSession.signature ? (
                  <div className="mt-2 p-3 bg-green-50 rounded-lg">
                    <p className="text-green-700 font-medium flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Séance émargée
                    </p>
                    {selectedSession.signature_date && (
                      <p className="text-sm text-green-600 mt-1">
                        Le {new Date(selectedSession.signature_date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-orange-50 rounded-lg">
                    <p className="text-orange-700 font-medium flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      En attente d'émargement
                    </p>
                  </div>
                )}
              </div>
              {selectedSession.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="mt-1">{selectedSession.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDetails(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal création élève */}
      <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un nouvel élève</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={studentForm.email} onChange={(e) => setStudentForm({...studentForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe *</Label>
              <Input type="password" value={studentForm.password} onChange={(e) => setStudentForm({...studentForm, password: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={studentForm.phone} onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Parcours</Label>
              <select 
                className="w-full px-3 py-2 border rounded-md"
                value={studentForm.parcours}
                onChange={(e) => setStudentForm({...studentForm, parcours: e.target.value})}
              >
                <option value="">Sélectionner...</option>
                <option value="Anglais">Anglais</option>
                <option value="Bureautique">Bureautique</option>
                <option value="Informatique">Informatique</option>
                <option value="Français">Français</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Heures totales</Label>
              <Input type="number" value={studentForm.total_hours} onChange={(e) => setStudentForm({...studentForm, total_hours: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <Label>Organisme</Label>
              <Input value={studentForm.organism} onChange={(e) => setStudentForm({...studentForm, organism: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Prise en charge</Label>
              <Input value={studentForm.support_type} onChange={(e) => setStudentForm({...studentForm, support_type: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Date d'entrée</Label>
              <Input type="date" value={studentForm.start_date} onChange={(e) => setStudentForm({...studentForm, start_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Date de sortie</Label>
              <Input type="date" value={studentForm.end_date} onChange={(e) => setStudentForm({...studentForm, end_date: e.target.value})} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Formateur assigné</Label>
              <select 
                className="w-full px-3 py-2 border rounded-md"
                value={studentForm.teacher_id}
                onChange={(e) => {
                  const f = formateurs.find(f => f.id === e.target.value);
                  setStudentForm({
                    ...studentForm, 
                    teacher_id: e.target.value,
                    teacher_name: f ? `${f.prenom} ${f.nom}` : ''
                  });
                }}
              >
                <option value="">Aucun</option>
                {formateurs.map(f => (
                  <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateStudent(false)}>Annuler</Button>
            <Button onClick={handleCreateStudent} className="bg-violet-600 hover:bg-violet-700 text-white">Créer l'élève</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal édition élève */}
      <Dialog open={showEditStudent} onOpenChange={setShowEditStudent}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'élève</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={studentForm.email} onChange={(e) => setStudentForm({...studentForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={studentForm.phone} onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Parcours</Label>
              <select 
                className="w-full px-3 py-2 border rounded-md"
                value={studentForm.parcours}
                onChange={(e) => setStudentForm({...studentForm, parcours: e.target.value})}
              >
                <option value="">Sélectionner...</option>
                <option value="Anglais">Anglais</option>
                <option value="Bureautique">Bureautique</option>
                <option value="Informatique">Informatique</option>
                <option value="Français">Français</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Heures totales</Label>
              <Input type="number" value={studentForm.total_hours} onChange={(e) => setStudentForm({...studentForm, total_hours: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <Label>Organisme</Label>
              <Input value={studentForm.organism} onChange={(e) => setStudentForm({...studentForm, organism: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Date d'entrée</Label>
              <Input type="date" value={studentForm.start_date} onChange={(e) => setStudentForm({...studentForm, start_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Date de sortie</Label>
              <Input type="date" value={studentForm.end_date} onChange={(e) => setStudentForm({...studentForm, end_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditStudent(false)}>Annuler</Button>
            <Button onClick={handleUpdateStudent} className="bg-amber-600 hover:bg-amber-700 text-white">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal historique élève */}
      <Dialog open={showStudentHistory} onOpenChange={setShowStudentHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Historique - {selectedStudentForHistory?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {studentHistory.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun historique</p>
            ) : (
              <div className="space-y-2">
                {studentHistory.map((log, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('fr-FR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStudentHistory(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal planning élève */}
      <Dialog open={showStudentPlanning} onOpenChange={setShowStudentPlanning}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Planning - {selectedStudentForPlanning?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[500px] overflow-y-auto">
            {studentSessions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune séance planifiée</p>
            ) : (
              <div className="space-y-2">
                {studentSessions.sort((a, b) => b.date.localeCompare(a.date)).map(session => (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{new Date(session.date).toLocaleDateString('fr-FR')} • {session.start_time}-{session.end_time}</p>
                      <p className="text-sm text-gray-600">{session.subject} • {session.duration_hours}h</p>
                    </div>
                    {session.signature ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Émargée</span>
                    ) : (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">Non émargée</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStudentPlanning(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal planning formateur */}
      <Dialog open={showFormateurPlanning} onOpenChange={setShowFormateurPlanning}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Planning - {selectedFormateur?.prenom} {selectedFormateur?.nom}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[500px] overflow-y-auto">
            {formateurSessions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune séance planifiée</p>
            ) : (
              <div className="space-y-2">
                {formateurSessions.sort((a, b) => b.date.localeCompare(a.date)).map(session => {
                  const student = students.find(s => s.id === session.student_id);
                  return (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{new Date(session.date).toLocaleDateString('fr-FR')} • {session.start_time}-{session.end_time}</p>
                        <p className="text-sm text-gray-600">{student?.name || 'Élève'} • {session.subject} • {session.duration_hours}h</p>
                      </div>
                      {session.signature ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Émargée</span>
                      ) : (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">Non émargée</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormateurPlanning(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal élèves archivés */}
      <Dialog open={showArchivedStudents} onOpenChange={setShowArchivedStudents}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Élèves historisés (Sorties de parcours)</DialogTitle>
          </DialogHeader>
          <div className="max-h-[500px] overflow-y-auto">
            {archivedStudents.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun élève archivé</p>
            ) : (
              <div className="space-y-2">
                {archivedStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-gray-600">{student.email} • {student.parcours}</p>
                    </div>
                    <button
                      onClick={() => handleRestoreStudent(student.id)}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restaurer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchivedStudents(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
