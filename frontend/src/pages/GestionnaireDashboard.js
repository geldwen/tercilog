import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  LogOut, Users, Calendar, MessageCircle, Search, Plus,
  Mail, Phone, Clock, CheckCircle, Eye, Building
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function GestionnaireDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('eleves');
  const [loading, setLoading] = useState(true);
  
  // Données
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [client, setClient] = useState(null);
  
  // Recherche
  const [searchQuery, setSearchQuery] = useState('');
  
  // Création élève
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '', email: '', phone: '', parcours: '', 
    total_hours: 0, password: ''
  });

  // Détail séance
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientRes, studentsRes, sessionsRes] = await Promise.all([
        axios.get(`${API}/gestionnaire/client`),
        axios.get(`${API}/gestionnaire/students`),
        axios.get(`${API}/gestionnaire/sessions`)
      ]);
      
      setClient(clientRes.data);
      setStudents(studentsRes.data || []);
      setSessions(sessionsRes.data || []);
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

  // Filtrer les élèves par recherche
  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (s.name || '').toLowerCase().includes(query) ||
           (s.email || '').toLowerCase().includes(query) ||
           (s.phone || '').includes(query);
  });

  // Créer un élève
  const handleCreateStudent = async () => {
    if (!studentForm.name || !studentForm.email || !studentForm.password) {
      toast.error('Nom, email et mot de passe sont obligatoires');
      return;
    }
    
    try {
      await axios.post(`${API}/gestionnaire/students`, {
        ...studentForm,
        client_id: user.client_id,
        organism: client?.nom_centre || ''
      });
      toast.success('Élève créé avec succès');
      setShowCreateStudent(false);
      setStudentForm({ name: '', email: '', phone: '', parcours: '', total_hours: 0, password: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  // Trier les séances par date
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header simple */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-800">Espace Centre</h1>
                <p className="text-sm text-gray-500">{client?.nom_centre || 'Mon centre'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Onglets */}
          <TabsList className="mb-6 bg-white p-1 rounded-lg shadow-sm">
            <TabsTrigger value="eleves" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="w-4 h-4" />
              Élèves ({students.length})
            </TabsTrigger>
            <TabsTrigger value="seances" className="gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4" />
              Séances ({sessions.length})
            </TabsTrigger>
            <TabsTrigger value="communication" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <MessageCircle className="w-4 h-4" />
              Communication
            </TabsTrigger>
          </TabsList>

          {/* ===== ONGLET ÉLÈVES ===== */}
          <TabsContent value="eleves">
            {/* Barre d'actions */}
            <div className="flex items-center justify-between mb-4 p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un élève..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 bg-gray-50"
                />
              </div>
              <Button onClick={() => setShowCreateStudent(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Nouvel élève
              </Button>
            </div>

            {/* Liste des élèves */}
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">
                  {searchQuery ? 'Aucun élève trouvé' : 'Aucun élève pour le moment'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreateStudent(true)} variant="link" className="mt-2">
                    Créer votre premier élève
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map(student => (
                  <Card key={student.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-blue-600">
                            {student.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 truncate">{student.name}</h3>
                          <p className="text-sm text-gray-500">{student.parcours || 'Parcours non défini'}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        {student.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{student.email}</span>
                          </div>
                        )}
                        {student.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{student.phone}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                          {student.credit_hours || student.total_hours || 0}h disponibles
                        </span>
                        {student.teacher_name && (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs">
                            {student.teacher_name}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== ONGLET SÉANCES ===== */}
          <TabsContent value="seances">
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h2 className="font-semibold text-gray-800">Séances de votre centre</h2>
              <p className="text-sm text-gray-500">Consultez les séances programmées (lecture seule)</p>
            </div>

            {sortedSessions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune séance pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedSessions.map(session => {
                  const student = students.find(s => s.id === session.student_id);
                  const isToday = session.date === new Date().toISOString().split('T')[0];
                  const isPast = session.date < new Date().toISOString().split('T')[0];
                  
                  return (
                    <div 
                      key={session.id}
                      className={`p-4 bg-white rounded-lg shadow-sm border-l-4 ${
                        isToday ? 'border-green-500' : isPast ? 'border-gray-300' : 'border-blue-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[60px]">
                            <div className="text-xs text-gray-500">
                              {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                            </div>
                            <div className="text-xl font-bold text-gray-800">
                              {new Date(session.date).getDate()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(session.date).toLocaleDateString('fr-FR', { month: 'short' })}
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-medium text-gray-800">
                              {student?.name || 'Élève'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {session.subject} • {session.start_time} - {session.end_time}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-600">
                            {session.duration_hours || 0}h
                          </span>
                          
                          {session.signature ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Émargée
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                              <Clock className="w-3 h-3" />
                              En attente
                            </span>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => { setSelectedSession(session); setShowSessionDetail(true); }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== ONGLET COMMUNICATION ===== */}
          <TabsContent value="communication">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <MessageCircle className="w-16 h-16 mx-auto text-purple-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Communication</h2>
              <p className="text-gray-500 mb-4">
                Cette fonctionnalité sera bientôt disponible.
              </p>
              <p className="text-sm text-gray-400">
                Vous pourrez communiquer avec votre formateur référent.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal création élève */}
      <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un nouvel élève</DialogTitle>
            <DialogDescription>
              L'élève sera rattaché à votre centre : {client?.nom_centre}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input 
                value={studentForm.name}
                onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                placeholder="Jean Dupont"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input 
                type="email"
                value={studentForm.email}
                onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                placeholder="jean.dupont@email.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Mot de passe *</Label>
              <Input 
                type="password"
                value={studentForm.password}
                onChange={(e) => setStudentForm({...studentForm, password: e.target.value})}
                placeholder="Minimum 6 caractères"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input 
                value={studentForm.phone}
                onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})}
                placeholder="06 12 34 56 78"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parcours</Label>
                <select 
                  className="w-full px-3 py-2 border rounded-md text-sm"
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
                <Label>Heures prévues</Label>
                <Input 
                  type="number"
                  value={studentForm.total_hours}
                  onChange={(e) => setStudentForm({...studentForm, total_hours: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateStudent(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateStudent} className="bg-blue-600 hover:bg-blue-700">
              Créer l'élève
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal détail séance */}
      <Dialog open={showSessionDetail} onOpenChange={setShowSessionDetail}>
        <DialogContent>
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
                <p className="text-sm text-gray-500">Statut</p>
                {selectedSession.signature ? (
                  <div className="mt-2 p-3 bg-green-50 rounded-lg">
                    <p className="text-green-700 font-medium flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Séance émargée
                    </p>
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
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDetail(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
