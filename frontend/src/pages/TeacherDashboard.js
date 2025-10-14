import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Plus, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle, BarChart3 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeacherDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);

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
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsRes, studentsRes, statsRes] = await Promise.all([
        axios.get(`${API}/sessions`),
        axios.get(`${API}/students`),
        axios.get(`${API}/sessions/stats`),
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
      toast.success("Séance créée et email envoyé à l'élève !");
      setShowCreateSession(false);
      setSessionForm({
        subject: "",
        date: "",
        start_time: "",
        end_time: "",
        student_id: "",
        validation_deadline_hours: 48,
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de la création de la séance");
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/students`, {
        ...studentForm,
        role: "student",
      });
      toast.success("Élève créé avec succès !");
      setShowCreateStudent(false);
      setStudentForm({
        name: "",
        email: "",
        password: "",
        credit_hours: 0,
      });
      loadData();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Espace Professeur</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              className="gap-2"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="card-hover border-0 shadow-md" data-testid="stats-total-sessions">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Séances</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_sessions}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-hover border-0 shadow-md" data-testid="stats-pending-sessions">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">En attente</p>
                    <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.pending_sessions}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
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

        {/* Tabs */}
        <Tabs defaultValue="sessions" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 shadow-sm" data-testid="dashboard-tabs">
            <TabsTrigger value="sessions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="sessions-tab">
              <Calendar className="w-4 h-4 mr-2" />
              Séances
            </TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="students-tab">
              <Users className="w-4 h-4 mr-2" />
              Élèves
            </TabsTrigger>
          </TabsList>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Gestion des Séances</h2>
              <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 gap-2" data-testid="create-session-button">
                    <Plus className="w-4 h-4" />
                    Créer une séance
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" data-testid="create-session-dialog">
                  <DialogHeader>
                    <DialogTitle>Nouvelle Séance</DialogTitle>
                    <DialogDescription>
                      Créer une nouvelle séance de formation pour un élève
                    </DialogDescription>
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
                              {student.name} ({student.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" data-testid="submit-session-button">
                      Créer et envoyer l'email
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {sessions.length === 0 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-6 text-center text-gray-500">
                    Aucune séance créée pour le moment
                  </CardContent>
                </Card>
              ) : (
                sessions.map((session) => (
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

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Gestion des Élèves</h2>
              <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 gap-2" data-testid="create-student-button">
                    <Plus className="w-4 h-4" />
                    Ajouter un élève
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" data-testid="create-student-dialog">
                  <DialogHeader>
                    <DialogTitle>Nouvel Élève</DialogTitle>
                    <DialogDescription>
                      Créer un compte élève avec ses identifiants
                    </DialogDescription>
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
                      <Label htmlFor="credit_hours">Crédit heures</Label>
                      <Input
                        id="credit_hours"
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="ex: 20"
                        value={studentForm.credit_hours}
                        onChange={(e) => setStudentForm({ ...studentForm, credit_hours: parseFloat(e.target.value) || 0 })}
                        data-testid="student-credit-hours-input"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" data-testid="submit-student-button">
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
                    Aucun élève enregistré pour le moment
                  </CardContent>
                </Card>
              ) : (
                students.map((student) => (
                  <Card key={student.id} className="border-0 shadow-md card-hover" data-testid={`student-card-${student.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-gray-900" data-testid={`student-name-${student.id}`}>{student.name}</h3>
                          <p className="text-sm text-gray-600" data-testid={`student-email-${student.id}`}>{student.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-4 py-2 bg-blue-100 rounded-lg" data-testid={`student-credit-hours-${student.id}`}>
                            <p className="text-xs text-gray-600">Crédit heures</p>
                            <p className="text-xl font-bold text-blue-600">{student.credit_hours}h</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
