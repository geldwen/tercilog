import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Plus, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TERCIFORM_BLUE = '#1e3a5f';
const TERCIFORM_BLUE_HOVER = '#152a47';
const TERCIFORM_BLUE_LIGHT = '#e8f0f7';

export default function TeacherDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');

  const [sessionForm, setSessionForm] = useState({
    subject: "",
    date: "",
    start_time: "",
    end_time: "",
    student_id: "",
    validation_deadline_hours: 48,
  });

  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    password: "",
    credit_hours: 0,
    total_hours: 0,
  });

  // Générer 7 mois : mois actuel + 6 mois suivants
  const getMonthsList = () => {
    const months = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    for (let i = 0; i < 7; i++) {
      const totalMonths = currentMonth + i;
      const year = currentYear + Math.floor(totalMonths / 12);
      const month = totalMonths % 12;
      
      const date = new Date(year, month, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      months.push({ key: monthKey, label: monthLabel });
    }
    return months;
  };

  const monthsList = getMonthsList();

  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setSelectedMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      loadData(selectedMonth);
    }
  }, [selectedMonth]);

  const loadData = async (month) => {
    try {
      const [sessionsRes, studentsRes, statsRes] = await Promise.all([
        axios.get(`${API}/sessions`),
        axios.get(`${API}/students`),
        axios.get(`${API}/sessions/stats?month=${month}`),
      ]);
      setSessions(sessionsRes.data);
      setStudents(studentsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/sessions`, sessionForm);
      toast.success("Séance créée et email envoyé !");
      setShowCreateSession(false);
      setSessionForm({
        subject: "",
        date: "",
        start_time: "",
        end_time: "",
        student_id: "",
        validation_deadline_hours: 48,
      });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de la création de la séance");
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      const newStudent = {
        ...studentForm,
        role: "student",
        credit_hours: studentForm.total_hours,
      };
      await axios.post(`${API}/students`, newStudent);
      toast.success("Élève créé avec succès !");
      setShowCreateStudent(false);
      setStudentForm({
        name: "",
        email: "",
        password: "",
        credit_hours: 0,
        total_hours: 0,
      });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de la création de l'élève");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: "En attente", icon: AlertCircle, className: "status-badge status-pending" },
      confirmed: { label: "Confirmée", icon: CheckCircle, className: "status-badge status-confirmed" },
      rejected: { label: "Refusée", icon: XCircle, className: "status-badge status-rejected" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={config.className} data-testid={`session-status-${status}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const filteredSessions = sessions.filter(s => s.date.startsWith(selectedMonth));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: TERCIFORM_BLUE }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_f0bae013-d5d3-4906-a078-392b9e03aa37/artifacts/tiidl44l_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png"
                alt="Terciform"
                className="h-10"
              />
              <div className="border-l border-gray-300 pl-3">
                <h1 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>Espace Professeur</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <Button onClick={onLogout} variant="outline" className="gap-2" data-testid="logout-button">
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4" style={{ color: TERCIFORM_BLUE }}>Séances par mois</h2>
          <Tabs value={selectedMonth} onValueChange={setSelectedMonth} className="space-y-6">
            <TabsList className="bg-white border border-gray-200 shadow-sm flex-wrap h-auto" data-testid="month-tabs">
              {monthsList.map((month) => (
                <TabsTrigger 
                  key={month.key}
                  value={month.key}
                  className="data-[state=active]:text-white capitalize"
                  data-testid={`month-tab-${month.key}`}
                >
                  {month.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {monthsList.map((month) => (
              <TabsContent key={month.key} value={month.key} className="space-y-6">
                {stats && stats.month === month.key && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="card-hover border-0 shadow-md" data-testid="stats-total-sessions">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Total</p>
                            <p className="text-3xl font-bold mt-1" style={{ color: TERCIFORM_BLUE }}>{stats.total_sessions}</p>
                          </div>
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}>
                            <Calendar className="w-6 h-6" style={{ color: TERCIFORM_BLUE }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="card-hover border-0 shadow-md" data-testid="stats-confirmed-sessions">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Confirmées</p>
                            <p className="text-3xl font-bold text-green-600 mt-1">{stats.confirmed_sessions}</p>
                          </div>
                          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="card-hover border-0 shadow-md" data-testid="stats-rejected-sessions">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Refusées</p>
                            <p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected_sessions}</p>
                          </div>
                          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-red-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Tabs defaultValue="sessions" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 shadow-sm" data-testid="dashboard-tabs">
            <TabsTrigger value="sessions" className="data-[state=active]:text-white" data-testid="sessions-tab">
              <Calendar className="w-4 h-4 mr-2" />
              Séances
            </TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:text-white" data-testid="students-tab">
              <Users className="w-4 h-4 mr-2" />
              Élèves
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Liste des Séances</h2>
              <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
                <DialogTrigger asChild>
                  <Button className="gap-2 text-white" style={{ backgroundColor: TERCIFORM_BLUE }} data-testid="create-session-button">
                    <Plus className="w-4 h-4" />
                    Créer une séance
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" data-testid="create-session-dialog">
                  <DialogHeader>
                    <DialogTitle>Nouvelle Séance</DialogTitle>
                    <DialogDescription>Créer une nouvelle séance de formation pour un élève</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateSession} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Matière</Label>
                      <Input
                        id="subject"
                        placeholder="ex: Anglais"
                        value={sessionForm.subject}
                        onChange={(e) => setSessionForm({ ...sessionForm, subject: e.target.value })}
                        required
                        data-testid="session-subject-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={sessionForm.date}
                        onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                        required
                        data-testid="session-date-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_time">Heure début</Label>
                        <Input
                          id="start_time"
                          type="time"
                          value={sessionForm.start_time}
                          onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
                          required
                          data-testid="session-start-time-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_time">Heure fin</Label>
                        <Input
                          id="end_time"
                          type="time"
                          value={sessionForm.end_time}
                          onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })}
                          required
                          data-testid="session-end-time-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student">Élève</Label>
                      <Select
                        value={sessionForm.student_id}
                        onValueChange={(value) => setSessionForm({ ...sessionForm, student_id: value })}
                        required
                      >
                        <SelectTrigger data-testid="session-student-select">
                          <SelectValue placeholder="Sélectionner un élève" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((student) => (
                            <SelectItem key={student.id} value={student.id} data-testid={`student-option-${student.id}`}>
                              {student.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: TERCIFORM_BLUE }} data-testid="submit-session-button">
                      Créer et envoyer
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {filteredSessions.length === 0 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-6 text-center text-gray-500">
                    Aucune séance pour ce mois
                  </CardContent>
                </Card>
              ) : (
                filteredSessions.map((session) => (
                  <Card key={session.id} className="border-0 shadow-md card-hover" data-testid={`session-card-${session.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900" data-testid={`session-subject-${session.id}`}>{session.subject}</h3>
                            {getStatusBadge(session.status)}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1" data-testid={`session-date-${session.id}`}>
                              <Calendar className="w-4 h-4" />
                              {new Date(session.date).toLocaleDateString('fr-FR')}
                            </span>
                            <span className="flex items-center gap-1" data-testid={`session-time-${session.id}`}>
                              <Clock className="w-4 h-4" />
                              {session.start_time} - {session.end_time}
                            </span>
                            <span className="flex items-center gap-1" data-testid={`session-student-${session.id}`}>
                              <Users className="w-4 h-4" />
                              {session.student_name}
                            </span>
                          </div>
                          {session.validated_at && (
                            <p className="text-xs text-gray-500" data-testid={`session-validated-at-${session.id}`}>
                              Validé le {new Date(session.validated_at).toLocaleString('fr-FR')}
                            </p>
                          )}
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
              <h2 className="text-xl font-bold text-gray-900">Gestion des Élèves</h2>
              <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
                <DialogTrigger asChild>
                  <Button className="gap-2 text-white" style={{ backgroundColor: TERCIFORM_BLUE }} data-testid="create-student-button">
                    <Plus className="w-4 h-4" />
                    Ajouter un élève
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" data-testid="create-student-dialog">
                  <DialogHeader>
                    <DialogTitle>Nouvel Élève</DialogTitle>
                    <DialogDescription>Créer un compte élève avec ses identifiants</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateStudent} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="student_name">Nom complet</Label>
                      <Input
                        id="student_name"
                        placeholder="ex: Jean Dupont"
                        value={studentForm.name}
                        onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                        required
                        data-testid="student-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student_email">Email</Label>
                      <Input
                        id="student_email"
                        type="email"
                        placeholder="jean.dupont@email.com"
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                        required
                        data-testid="student-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student_password">Mot de passe</Label>
                      <Input
                        id="student_password"
                        type="password"
                        placeholder="••••••••"
                        value={studentForm.password}
                        onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                        required
                        data-testid="student-password-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_hours">Heures totales</Label>
                      <Input
                        id="total_hours"
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="ex: 20"
                        value={studentForm.total_hours}
                        onChange={(e) => setStudentForm({ ...studentForm, total_hours: parseFloat(e.target.value) || 0 })}
                        data-testid="student-total-hours-input"
                      />
                    </div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: TERCIFORM_BLUE }} data-testid="submit-student-button">
                      Créer l'élève
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {students.length === 0 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-6 text-center text-gray-500">
                    Aucun élève enregistré
                  </CardContent>
                </Card>
              ) : (
                students.map((student) => {
                  const studentSessions = sessions.filter(s => s.student_id === student.id);
                  const totalHours = student.total_hours || student.credit_hours;
                  const remainingHours = student.credit_hours;
                  
                  return (
                    <Card key={student.id} className="border-0 shadow-md card-hover" data-testid={`student-card-${student.id}`}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="space-y-1 flex-1">
                              <h3 className="text-lg font-semibold text-gray-900" data-testid={`student-name-${student.id}`}>{student.name}</h3>
                              <p className="text-sm text-gray-600" data-testid={`student-email-${student.id}`}>{student.email}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="px-4 py-2 rounded-lg bg-gray-100" data-testid={`student-total-hours-${student.id}`}>
                                <p className="text-xs text-gray-600">Heures totales</p>
                                <p className="text-xl font-bold text-gray-900">{totalHours}h</p>
                              </div>
                              <div className="px-4 py-2 rounded-lg" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }} data-testid={`student-credit-hours-${student.id}`}>
                                <p className="text-xs text-gray-600">Heures restantes</p>
                                <p className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>{remainingHours}h</p>
                              </div>
                            </div>
                          </div>

                          {studentSessions.length > 0 && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Historique des séances</h4>
                              <div className="space-y-2">
                                {studentSessions.slice(0, 5).map((session) => (
                                  <div key={session.id} className="flex items-center justify-between text-sm py-3 px-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3 flex-1">
                                      <span className="font-medium text-gray-900">{session.subject}</span>
                                      <span className="text-gray-500">le {new Date(session.date).toLocaleDateString('fr-FR')}</span>
                                      <span className="font-semibold text-gray-700">{session.duration_hours}h</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {session.status === 'confirmed' && (
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <span className="text-green-700 font-medium">Accepté</span>
                                          </div>
                                          {session.validated_at && (
                                            <span className="text-xs text-gray-500">
                                              le {new Date(session.validated_at).toLocaleDateString('fr-FR')}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {session.status === 'rejected' && (
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1">
                                            <XCircle className="w-4 h-4 text-red-600" />
                                            <span className="text-red-700 font-medium">Refusé</span>
                                          </div>
                                          {session.validated_at && (
                                            <span className="text-xs text-gray-500">
                                              le {new Date(session.validated_at).toLocaleDateString('fr-FR')}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {session.status === 'pending' && (
                                        <div className="flex items-center gap-1">
                                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                                          <span className="text-yellow-700 font-medium">En attente</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {studentSessions.length > 5 && (
                                  <p className="text-xs text-gray-500 text-center pt-2">
                                    ... et {studentSessions.length - 5} autre(s) séance(s)
                                  </p>
                                )}
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
