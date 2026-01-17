import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  LogOut, Calendar, Users, Clock, CheckCircle, XCircle, 
  Mail, Phone, Building, ChevronLeft, ChevronRight, PenTool
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function GestionnaireDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');
  
  // Données
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [formateurs, setFormateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Planning
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(new Date().getMonth() + 1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);

  const months = [
    { num: 1, label: 'Janvier' }, { num: 2, label: 'Février' }, { num: 3, label: 'Mars' },
    { num: 4, label: 'Avril' }, { num: 5, label: 'Mai' }, { num: 6, label: 'Juin' },
    { num: 7, label: 'Juillet' }, { num: 8, label: 'Août' }, { num: 9, label: 'Septembre' },
    { num: 10, label: 'Octobre' }, { num: 11, label: 'Novembre' }, { num: 12, label: 'Décembre' }
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      navigate('/');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'gestionnaire') {
      navigate('/');
      return;
    }
    
    setUser(parsedUser);
    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [clientRes, studentsRes, sessionsRes, formateursRes] = await Promise.all([
        axios.get(`${API}/gestionnaire/client`, { headers }),
        axios.get(`${API}/gestionnaire/students`, { headers }),
        axios.get(`${API}/gestionnaire/sessions`, { headers }),
        axios.get(`${API}/gestionnaire/formateurs`, { headers })
      ]);
      
      setClient(clientRes.data);
      setStudents(studentsRes.data || []);
      setSessions(sessionsRes.data || []);
      setFormateurs(formateursRes.data || []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      if (error.response?.status === 403) {
        toast.error('Accès non autorisé');
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Filtrer les sessions du mois sélectionné
  const monthSessions = useMemo(() => {
    return sessions.filter(s => {
      if (!s.date) return false;
      const sessionDate = new Date(s.date);
      return sessionDate.getFullYear() === selectedYear && 
             (sessionDate.getMonth() + 1) === selectedMonthNum;
    });
  }, [sessions, selectedYear, selectedMonthNum]);

  // Générer les jours du mois
  const getDaysInMonth = (year, month) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days = [];
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month - 1, i);
      days.push({
        date: i,
        dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        fullDate: `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }
    return days;
  };

  const daysOfMonth = getDaysInMonth(selectedYear, selectedMonthNum);
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8h à 19h

  // Obtenir la couleur d'un élève
  const getStudentColor = (studentId) => {
    const colors = [
      { bg: '#E3F2FD', text: '#1565C0' },
      { bg: '#E8F5E9', text: '#2E7D32' },
      { bg: '#FFF3E0', text: '#E65100' },
      { bg: '#F3E5F5', text: '#7B1FA2' },
      { bg: '#E0F7FA', text: '#00838F' },
      { bg: '#FBE9E7', text: '#D84315' },
      { bg: '#F1F8E9', text: '#558B2F' },
      { bg: '#FCE4EC', text: '#C2185B' },
    ];
    const index = students.findIndex(s => s.id === studentId);
    return colors[index % colors.length];
  };

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
                onClick={handleLogout}
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
                className="px-8 py-3 text-base font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-emerald-500 data-[state=inactive]:text-white data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                <Calendar className="w-5 h-5 mr-2" />
                SÉANCES
              </TabsTrigger>
              <TabsTrigger 
                value="students" 
                className="px-8 py-3 text-base font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-violet-500 data-[state=inactive]:text-white data-[state=active]:bg-violet-600 data-[state=active]:text-white"
              >
                <Users className="w-5 h-5 mr-2" />
                ÉLÈVES
              </TabsTrigger>
              <TabsTrigger 
                value="formateurs" 
                className="px-8 py-3 text-base font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-amber-500 data-[state=inactive]:text-white data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              >
                <PenTool className="w-5 h-5 mr-2" />
                FORMATEURS
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Onglet Séances */}
          <TabsContent value="sessions" className="space-y-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4">
              {/* Navigation mois */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <select 
                    value={selectedMonthNum} 
                    onChange={(e) => setSelectedMonthNum(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg"
                  >
                    {months.map(m => (
                      <option key={m.num} value={m.num}>{m.label}</option>
                    ))}
                  </select>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-4 text-center">
                {monthSessions.length} séance(s) en {months[selectedMonthNum - 1]?.label} {selectedYear}
              </p>

              {/* Grille planning */}
              <div className="overflow-x-auto">
                <div className="min-w-[1200px]">
                  {/* En-tête jours */}
                  <div className="flex border-b sticky top-0 bg-white z-10">
                    <div className="w-16 flex-shrink-0"></div>
                    {daysOfMonth.map((day, idx) => (
                      <div 
                        key={idx}
                        className={`flex-1 min-w-[40px] text-center py-2 text-xs ${
                          day.isWeekend ? 'bg-gray-100 text-gray-400' : ''
                        }`}
                      >
                        <div className="font-medium">{day.dayName}</div>
                        <div>{day.date}</div>
                      </div>
                    ))}
                  </div>

                  {/* Grille horaire */}
                  {hours.map(hour => (
                    <div key={hour} className="flex border-b">
                      <div className="w-16 flex-shrink-0 text-xs text-gray-500 py-2 text-right pr-2 bg-gray-50">
                        {hour}h
                      </div>
                      {daysOfMonth.map((day, idx) => {
                        const cellSessions = monthSessions.filter(s => {
                          if (s.date !== day.fullDate) return false;
                          const startHour = parseInt(s.start_time?.split(':')[0] || '0');
                          return startHour === hour;
                        });

                        return (
                          <div 
                            key={idx}
                            className={`flex-1 min-w-[40px] min-h-[30px] border-l ${
                              day.isWeekend ? 'bg-gray-50' : ''
                            }`}
                          >
                            {cellSessions.map((session, sIdx) => {
                              const student = students.find(s => s.id === session.student_id);
                              const color = getStudentColor(session.student_id);
                              return (
                                <div 
                                  key={sIdx}
                                  className="text-[10px] px-1 py-0.5 rounded m-0.5 cursor-pointer truncate"
                                  style={{ backgroundColor: color.bg, color: color.text }}
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setShowStudentModal(true);
                                  }}
                                  title={`${student?.name || 'Élève'} - ${session.subject}`}
                                >
                                  {student?.name?.split(' ')[0] || '?'}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Onglet Élèves */}
          <TabsContent value="students" className="space-y-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
              <h2 className="text-xl font-bold text-gray-800">Élèves de votre centre ({students.length})</h2>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-16 bg-white/80 rounded-2xl shadow-lg">
                <Users className="w-20 h-20 mx-auto text-violet-300 mb-4" />
                <p className="text-gray-600 text-lg">Aucun élève associé à votre centre</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map(student => (
                  <Card key={student.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                          <span className="text-lg font-bold text-violet-600">
                            {student.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{student.name}</h3>
                          <p className="text-sm text-gray-500">{student.parcours}</p>
                          {student.email && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                              <Mail className="w-3 h-3" />
                              {student.email}
                            </p>
                          )}
                          {student.phone && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {student.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs">
                          {student.credit_hours || 0}h restantes
                        </span>
                        {student.teacher_name && (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
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

          {/* Onglet Formateurs */}
          <TabsContent value="formateurs" className="space-y-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
              <h2 className="text-xl font-bold text-gray-800">Formateurs ({formateurs.length})</h2>
            </div>

            {formateurs.length === 0 ? (
              <div className="text-center py-16 bg-white/80 rounded-2xl shadow-lg">
                <PenTool className="w-20 h-20 mx-auto text-amber-300 mb-4" />
                <p className="text-gray-600 text-lg">Aucun formateur enregistré</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formateurs.map(formateur => (
                  <Card key={formateur.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
                          {formateur.photo_url ? (
                            <img 
                              src={`${API}/formateurs/${formateur.id}/photo`}
                              alt={`${formateur.prenom} ${formateur.nom}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-bold text-amber-600">
                              {formateur.prenom?.[0]}{formateur.nom?.[0]}
                            </span>
                          )}
                        </div>
                        <div className="text-white">
                          <h3 className="font-bold">{formateur.prenom} {formateur.nom}</h3>
                          {formateur.societe && (
                            <p className="text-amber-100 text-sm">{formateur.societe}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      {formateur.email && (
                        <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                          <Mail className="w-4 h-4" />
                          {formateur.email}
                        </p>
                      )}
                      {formateur.telephone && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {formateur.telephone}
                        </p>
                      )}
                      {formateur.matieres && formateur.matieres.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {formateur.matieres.filter(m => m).map((m, i) => (
                            <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal détails élève */}
      <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails de l'élève</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-3">
              <p><strong>Nom :</strong> {selectedStudent.name}</p>
              <p><strong>Email :</strong> {selectedStudent.email}</p>
              <p><strong>Téléphone :</strong> {selectedStudent.phone || '-'}</p>
              <p><strong>Parcours :</strong> {selectedStudent.parcours || '-'}</p>
              <p><strong>Heures restantes :</strong> {selectedStudent.credit_hours || 0}h</p>
              <p><strong>Formateur :</strong> {selectedStudent.teacher_name || '-'}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStudentModal(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
