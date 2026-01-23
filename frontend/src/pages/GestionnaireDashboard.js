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
  LogOut, Users, Calendar, Search, Plus, PenTool,
  Mail, Phone, Clock, CheckCircle, Eye, Building, XCircle, Gift, FolderOpen, ChevronDown, ChevronUp
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const TERCIFORM_BLUE = '#0D2040';
const TERCIFORM_BLUE_LIGHT = '#E8EEF4';

export default function GestionnaireDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('eleves');
  const [loading, setLoading] = useState(true);
  
  // Données
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [formateurs, setFormateurs] = useState([]);
  const [client, setClient] = useState(null);
  
  // Recherche
  const [showSearchStudent, setShowSearchStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStudents, setFilteredStudents] = useState(null);
  
  // Création élève
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '', email: '', phone: '', parcours: 'Anglais', 
    total_hours: 0, password: '', organism: '', support_type: ''
  });

  // Détail séance
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // Sorties de parcours
  const [showExitBanner, setShowExitBanner] = useState(false);
  const [exitYearFilter, setExitYearFilter] = useState('');
  const [exitSearchQuery, setExitSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientRes, studentsRes, sessionsRes, formateursRes] = await Promise.all([
        axios.get(`${API}/gestionnaire/client`),
        axios.get(`${API}/gestionnaire/students`),
        axios.get(`${API}/gestionnaire/sessions`),
        axios.get(`${API}/gestionnaire/formateurs`)
      ]);
      
      setClient(clientRes.data);
      setStudents(studentsRes.data || []);
      setSessions(sessionsRes.data || []);
      setFormateurs(formateursRes.data || []);
    } catch (error) {
      console.error('Erreur chargement:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        toast.error('Session expirée');
        onLogout();
      }
    } finally {
      setLoading(false);
    }
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
      const email = (s.email || '').toLowerCase();
      return name.includes(query) || phone.includes(query.replace(/\s/g, '')) || email.includes(query);
    });
    
    if (results.length === 0) {
      toast.error('Aucun élève trouvé');
    } else {
      setFilteredStudents(results);
      setShowSearchStudent(false);
      toast.success(`${results.length} élève(s) trouvé(s)`);
    }
  };

  const resetSearch = () => {
    setFilteredStudents(null);
    setSearchQuery('');
  };

  // Créer un élève
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.email || !studentForm.password) {
      toast.error('Nom, email et mot de passe sont obligatoires');
      return;
    }
    
    try {
      await axios.post(`${API}/gestionnaire/students`, {
        ...studentForm,
        client_id: user.client_id,
        organism: studentForm.organism || client?.nom_centre || ''
      });
      toast.success('Élève créé avec succès');
      setShowCreateStudent(false);
      setStudentForm({ name: '', email: '', phone: '', parcours: 'Anglais', total_hours: 0, password: '', organism: '', support_type: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  // Afficher les élèves
  const displayedStudents = filteredStudents || students;

  // Trier les séances par date
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  // Couleur du parcours
  const getParcoursStyle = (parcours) => {
    const styles = {
      'Anglais': { bg: '#FFE4F0', color: '#DB2777' },
      'Bureautique': { bg: '#D1FAE5', color: '#059669' },
      'Management': { bg: '#DBEAFE', color: '#2563EB' },
      'Informatique': { bg: '#F3E8FF', color: '#9333EA' }
    };
    return styles[parcours] || { bg: '#F3F4F6', color: '#6B7280' };
  };

  // Calcul des élèves actifs vs sorties de parcours
  const activeStudents = useMemo(() => {
    return students.filter(s => (s.credit_hours || s.total_hours || 0) > 0);
  }, [students]);

  const exitedStudents = useMemo(() => {
    return students.filter(s => {
      const remainingHours = s.credit_hours || 0;
      return remainingHours <= 0 && s.end_date;
    }).map(student => {
      // Trouver la dernière séance signée pour avoir la date de sortie
      const studentSessions = sessions
        .filter(s => s.student_id === student.id && s.signature)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastSession = studentSessions[0];
      const exitDate = student.end_date || lastSession?.date || null;
      return {
        ...student,
        exit_date: exitDate,
        exit_year: exitDate ? exitDate.substring(0, 4) : null
      };
    });
  }, [students, sessions]);

  // Années disponibles pour le filtre
  const availableExitYears = useMemo(() => {
    const years = [...new Set(exitedStudents.map(s => s.exit_year).filter(Boolean))];
    return years.sort().reverse();
  }, [exitedStudents]);

  // Filtre des sorties de parcours
  const filteredExitedStudents = useMemo(() => {
    let result = exitedStudents;
    if (exitYearFilter) {
      result = result.filter(s => s.exit_year === exitYearFilter);
    }
    if (exitSearchQuery.trim()) {
      const query = exitSearchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      result = result.filter(s => {
        const name = (s.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name.includes(query);
      });
    }
    return result;
  }, [exitedStudents, exitYearFilter, exitSearchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: TERCIFORM_BLUE }}></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header identique à l'admin */}
      <header className="text-white shadow-lg" style={{ backgroundColor: TERCIFORM_BLUE }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_c2836d13-0ae2-4588-909c-94c20a9d54f4/artifacts/qj45ffom_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" 
                alt="TerciForm" 
                className="h-12"
              />
              <div>
                <h1 className="text-xl font-bold">Espace Gestion</h1>
                <p className="text-sm text-gray-300">{client?.nom_centre || 'Mon centre'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">{user?.name}</span>
              <Button 
                variant="ghost" 
                onClick={onLogout}
                className="text-white hover:bg-white/10"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Fond coloré selon l'onglet actif - comme l'admin */}
        <div 
          className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${
            activeTab === 'eleves' 
              ? 'bg-violet-300' 
              : activeTab === 'seances' 
                ? 'bg-emerald-300' 
                : activeTab === 'formateurs'
                  ? 'bg-amber-300'
                  : 'bg-pink-300'
          }`}
          style={{ top: '72px' }}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-10">
          {/* Onglets style admin */}
          <div className="flex justify-center mb-8">
            <TabsList className="bg-transparent border-0 shadow-none p-0 h-auto gap-6">
              <TabsTrigger 
                value="eleves" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-violet-500 data-[state=inactive]:text-white data-[state=active]:bg-violet-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <Users className="w-5 h-5 mr-3" />
                ÉLÈVES
              </TabsTrigger>
              <TabsTrigger 
                value="seances" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-emerald-500 data-[state=inactive]:text-white data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <Calendar className="w-5 h-5 mr-3" />
                SÉANCES
              </TabsTrigger>
              <TabsTrigger 
                value="formateurs" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-amber-500 data-[state=inactive]:text-white data-[state=active]:bg-amber-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <PenTool className="w-5 h-5 mr-3" />
                FORMATEURS
              </TabsTrigger>
              <TabsTrigger 
                value="fidelite" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-pink-500 data-[state=inactive]:text-white data-[state=active]:bg-pink-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <Gift className="w-5 h-5 mr-3" />
                FIDÉLITÉ
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ===== ONGLET ÉLÈVES ===== */}
          <TabsContent value="eleves" className="space-y-6">
            {/* Barre d'actions style admin */}
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Élèves ({displayedStudents.length})</h2>
              <div className="flex gap-3">
                {filteredStudents && (
                  <Button onClick={resetSearch} variant="outline" className="gap-2">
                    <XCircle className="w-4 h-4" />
                    Tous ({students.length})
                  </Button>
                )}
                
                {/* Bouton Rechercher */}
                <Dialog open={showSearchStudent} onOpenChange={setShowSearchStudent}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors">
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
                        placeholder="Nom, téléphone ou email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchStudent()}
                        autoFocus
                      />
                      <p className="text-xs text-gray-500">
                        💡 La recherche fonctionne avec ou sans accents
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSearchStudent(false)}>Annuler</Button>
                      <Button onClick={handleSearchStudent} style={{ backgroundColor: TERCIFORM_BLUE }} className="text-white gap-2">
                        <Search className="w-4 h-4" />
                        Soumettre
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Bouton Créer */}
                <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-md">
                      <Plus className="w-4 h-4" />
                      Créer un élève
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Nouvel Élève</DialogTitle>
                      <DialogDescription>Créer un compte élève pour {client?.nom_centre}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateStudent} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nom complet *</Label>
                        <Input placeholder="ex: Jean Dupont" value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Numéro de téléphone</Label>
                        <Input placeholder="ex: 06 12 34 56 78" value={studentForm.phone} onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input type="email" placeholder="jean.dupont@email.com" value={studentForm.email} onChange={(e) => setStudentForm({...studentForm, email: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Mot de passe *</Label>
                        <Input type="password" placeholder="••••••••" value={studentForm.password} onChange={(e) => setStudentForm({...studentForm, password: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Organisme de formation</Label>
                        <Input placeholder="ex: Pôle Emploi" value={studentForm.organism} onChange={(e) => setStudentForm({...studentForm, organism: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Prise en charge parcours</Label>
                        <Input placeholder="ex: CPF" value={studentForm.support_type} onChange={(e) => setStudentForm({...studentForm, support_type: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Parcours / Matière *</Label>
                        <select 
                          value={studentForm.parcours} 
                          onChange={(e) => setStudentForm({...studentForm, parcours: e.target.value})} 
                          className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                          required
                        >
                          <option value="Anglais">Anglais</option>
                          <option value="Management">Management</option>
                          <option value="Bureautique">Bureautique</option>
                          <option value="Informatique">Informatique</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Heures prévues</Label>
                        <Input type="number" value={studentForm.total_hours} onChange={(e) => setStudentForm({...studentForm, total_hours: parseFloat(e.target.value) || 0})} />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowCreateStudent(false)}>Annuler</Button>
                        <Button type="submit" style={{ backgroundColor: TERCIFORM_BLUE }} className="text-white">Créer l'élève</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* ===== BANDEAU SORTIES DE PARCOURS ===== */}
            {exitedStudents.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-blue-200">
                {/* Header du bandeau - cliquable */}
                <button 
                  onClick={() => setShowExitBanner(!showExitBanner)}
                  className="w-full flex items-center justify-between p-4 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FolderOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-blue-900">Sorties de parcours</h3>
                      <p className="text-sm text-blue-600">{exitedStudents.length} élève(s) ayant terminé leur formation</p>
                    </div>
                  </div>
                  {showExitBanner ? (
                    <ChevronUp className="w-6 h-6 text-blue-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-blue-600" />
                  )}
                </button>

                {/* Contenu dépliable */}
                {showExitBanner && (
                  <div className="border-t border-blue-200">
                    {/* Filtres */}
                    <div className="flex flex-wrap items-center gap-4 p-4 bg-blue-50">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Année :</label>
                        <select
                          value={exitYearFilter}
                          onChange={(e) => setExitYearFilter(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Toutes</option>
                          {availableExitYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Rechercher par nom..."
                          value={exitSearchQuery}
                          onChange={(e) => setExitSearchQuery(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <span className="text-sm text-gray-500">
                        {filteredExitedStudents.length} résultat(s)
                      </span>
                    </div>

                    {/* Liste des sorties */}
                    <div className="max-h-96 overflow-y-auto">
                      {filteredExitedStudents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p>Aucun élève trouvé</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {filteredExitedStudents.map(student => {
                            const parcoursStyle = getParcoursStyle(student.parcours);
                            const exitDateFormatted = student.exit_date 
                              ? new Date(student.exit_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                              : 'Non définie';
                            
                            return (
                              <div key={student.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div 
                                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                      style={{ backgroundColor: TERCIFORM_BLUE }}
                                    >
                                      {(student.name?.[0] || '').toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-gray-900">{student.name}</h4>
                                        {student.parcours && (
                                          <span 
                                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                                            style={{ backgroundColor: parcoursStyle.bg, color: parcoursStyle.color }}
                                          >
                                            {student.parcours}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-500">{student.organism || 'Sans organisme'}</p>
                                      <p className="text-sm text-gray-600 mt-1">
                                        <span className="font-medium">{student.total_hours || 0}h</span> réalisées
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs text-gray-500 block mb-1">Date de sortie</span>
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                      <Calendar className="w-4 h-4 mr-1" />
                                      {exitDateFormatted}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Liste des élèves actifs - style admin */}
            {(filteredStudents || activeStudents).length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
                <Users className="w-20 h-20 mx-auto text-violet-200 mb-4" />
                <p className="text-gray-500 text-lg">Aucun élève pour le moment</p>
                <Button onClick={() => setShowCreateStudent(true)} variant="link" className="mt-2 text-violet-600">
                  Créer votre premier élève
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {displayedStudents.map(student => {
                  const parcoursStyle = getParcoursStyle(student.parcours);
                  return (
                    <Card key={student.id} className="shadow-md hover:shadow-lg transition-shadow border-2" style={{ borderColor: TERCIFORM_BLUE }}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                                {student.parcours && (
                                  <span 
                                    className="px-3 py-1 rounded-full text-sm font-bold"
                                    style={{ backgroundColor: parcoursStyle.bg, color: parcoursStyle.color }}
                                  >
                                    {student.parcours}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                <p><span className="font-medium">Email:</span> {student.email}</p>
                                {student.phone && <p><span className="font-medium">Tél:</span> {student.phone}</p>}
                                {student.organism && <p><span className="font-medium">Organisme:</span> {student.organism}</p>}
                                {student.support_type && <p><span className="font-medium">Prise en charge:</span> {student.support_type}</p>}
                                {student.teacher_name && (
                                  <p className="flex items-center gap-1">
                                    <span className="font-medium">Formateur:</span> 
                                    <span className="text-purple-700 font-semibold">{student.teacher_name}</span>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-3">
                                <div className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: TERCIFORM_BLUE }}>
                                  <p className="text-xs opacity-90">Heures totales</p>
                                  <p className="text-xl font-bold">{student.total_hours || 0}h</p>
                                </div>
                                <div className="px-4 py-2 rounded-lg" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}>
                                  <p className="text-xs text-gray-600">Heures restantes</p>
                                  <p className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>{student.credit_hours || student.total_hours || 0}h</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== ONGLET SÉANCES ===== */}
          <TabsContent value="seances" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Séances ({sessions.length})</h2>
              <p className="text-sm text-gray-500">Consultez les séances programmées (lecture seule)</p>
            </div>

            {sortedSessions.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
                <Calendar className="w-20 h-20 mx-auto text-emerald-200 mb-4" />
                <p className="text-gray-500 text-lg">Aucune séance pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedSessions.map(session => {
                  const student = students.find(s => s.id === session.student_id);
                  const isToday = session.date === new Date().toISOString().split('T')[0];
                  const isPast = session.date < new Date().toISOString().split('T')[0];
                  
                  return (
                    <Card 
                      key={session.id}
                      className={`shadow-md hover:shadow-lg transition-shadow border-l-4 ${
                        isToday ? 'border-l-green-500 bg-green-50' : 
                        isPast ? 'border-l-gray-300' : 'border-l-blue-500'
                      }`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[70px] p-2 rounded-lg" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}>
                              <div className="text-xs text-gray-500">
                                {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                              </div>
                              <div className="text-2xl font-bold" style={{ color: TERCIFORM_BLUE }}>
                                {new Date(session.date).getDate()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(session.date).toLocaleDateString('fr-FR', { month: 'short' })}
                              </div>
                            </div>
                            
                            <div>
                              <div className="font-semibold text-gray-900">
                                {student?.name || 'Élève'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {session.subject} • {session.start_time} - {session.end_time}
                              </div>
                              {session.modality && (
                                <span className={`text-xs px-2 py-1 rounded ${session.modality === 'distanciel' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {session.modality === 'distanciel' ? 'Distanciel' : 'Présentiel'}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-lg font-bold" style={{ color: TERCIFORM_BLUE }}>
                                {session.duration_hours || 0}h
                              </span>
                            </div>
                            
                            {session.signature ? (
                              <span className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                <CheckCircle className="w-4 h-4" />
                                Émargée
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                                <Clock className="w-4 h-4" />
                                En attente
                              </span>
                            )}
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => { setSelectedSession(session); setShowSessionDetail(true); }}
                              className="gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Détails
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== ONGLET FORMATEURS ===== */}
          <TabsContent value="formateurs" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Formateurs ({formateurs.length})</h2>
              <p className="text-sm text-gray-500">Les formateurs associés à votre centre</p>
            </div>

            {formateurs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
                <PenTool className="w-20 h-20 mx-auto text-amber-200 mb-4" />
                <p className="text-gray-500 text-lg">Aucun formateur pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formateurs.map(formateur => (
                  <Card key={formateur.id} className="shadow-md hover:shadow-lg transition-shadow border-2 border-amber-200 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex">
                        {/* Photo du formateur */}
                        <div className="w-32 h-40 bg-amber-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {formateur.photo_url ? (
                            <img 
                              src={`${process.env.REACT_APP_BACKEND_URL}${formateur.photo_url}`}
                              alt={`${formateur.prenom} ${formateur.nom}`} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <PenTool className="w-12 h-12 text-amber-400" />
                          )}
                        </div>
                        
                        {/* Infos du formateur */}
                        <div className="p-4 flex-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {formateur.prenom} {formateur.nom}
                          </h3>
                          {formateur.societe && (
                            <p className="text-sm text-gray-500">{formateur.societe}</p>
                          )}
                          
                          {/* Matières */}
                          {formateur.matieres && formateur.matieres.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {formateur.matieres.map((matiere, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                                  {matiere}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          <div className="mt-3 space-y-1 text-sm text-gray-600">
                            {formateur.email && (
                              <p className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <a href={`mailto:${formateur.email}`} className="text-blue-600 hover:underline">{formateur.email}</a>
                              </p>
                            )}
                            {formateur.telephone && (
                              <p className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <a href={`tel:${formateur.telephone}`} className="text-blue-600 hover:underline">{formateur.telephone}</a>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== ONGLET FIDÉLITÉ ===== */}
          <TabsContent value="fidelite" className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <Gift className="w-20 h-20 mx-auto text-pink-200 mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Programme de Fidélité</h2>
              <p className="text-gray-500 mb-4 text-lg">
                Votre programme de fidélité bientôt disponible !
              </p>
              <p className="text-sm text-gray-400">
                Gagnez des points et profitez d'avantages exclusifs.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal détail séance */}
      <Dialog open={showSessionDetail} onOpenChange={setShowSessionDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de la séance</DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Élève</p>
                  <p className="font-medium">
                    {students.find(s => s.id === selectedSession.student_id)?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Matière</p>
                  <p className="font-medium">{selectedSession.subject || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">
                    {new Date(selectedSession.date).toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </p>
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
                  <p className="font-medium">
                    {selectedSession.modality === 'distanciel' ? 'Distanciel' : 'Présentiel'}
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-2">Statut</p>
                {selectedSession.signature ? (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-700 font-medium flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Séance émargée
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-orange-700 font-medium flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      En attente d'émargement
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDetail(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
