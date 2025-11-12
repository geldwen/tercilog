import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Plus, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Mail, Edit, PenTool, FileText, FileCheck, CalendarDays, Euro, FolderOpen } from "lucide-react";
import PlanningView from "@/components/PlanningView";
import BillingView from "@/components/BillingView";
import ParcoursEleveModal from "@/components/ParcoursEleveModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const TERCIFORM_BLUE = '#1e3a5f';
const TERCIFORM_BLUE_LIGHT = '#e8f0f7';

// Fonction utilitaire pour calculer le tarif horaire suggéré
const normalizeText = (text) => {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase();
};

const inferHourlyRate = (subject) => {
  const keywords20 = [
    'test de positionnement',
    'test positionnement',
    'test position',
    'test posi',
    'positionnement initial',
    'positionnement',
    'equivalence'
  ];
  
  const normalized = normalizeText(subject);
  const isSpecial = keywords20.some(keyword => normalizeText(keyword).split(' ').every(word => normalized.includes(word)));
  return isSpecial ? 20 : 40;
};

export default function TeacherDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showEditSession, setShowEditSession] = useState(false);
  const [showSendPdfDialog, setShowSendPdfDialog] = useState(false);
  const [showTeacherSignatureDialog, setShowTeacherSignatureDialog] = useState(false);
  const [showSendAttendanceDialog, setShowSendAttendanceDialog] = useState(false);
  const [showStudentDocumentsDialog, setShowStudentDocumentsDialog] = useState(false);
  const [documentsStudent, setDocumentsStudent] = useState(null);
  const [showPlanning, setShowPlanning] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [currentSessionToSign, setCurrentSessionToSign] = useState(null);
  const [pdfStudent, setPdfStudent] = useState(null);
  const [pdfEmail, setPdfEmail] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);

  // États pour le modal d'envoi de justificatifs signés
  const [attendanceStudent, setAttendanceStudent] = useState(null);
  const [attendanceMode, setAttendanceMode] = useState('month'); // 'session' ou 'month'
  const [attendanceSession, setAttendanceSession] = useState(null);
  const [attendanceMonth, setAttendanceMonth] = useState('');
  const [attendanceRecipients, setAttendanceRecipients] = useState({
    student: true,
    teacher: false,
    enterprise: false,
    others: ''
  });
  const [attendanceEmailSubject, setAttendanceEmailSubject] = useState('');
  const [attendanceEmailBody, setAttendanceEmailBody] = useState('');

  const [sessionForm, setSessionForm] = useState({ 
    subject: "", 
    date: "", 
    start_time: "", 
    end_time: "", 
    student_id: "", 
    validation_deadline_hours: 48, 
    meeting_link: "",
    hourly_rate: 40,
    hourly_rate_source: "auto",
    modality: "distanciel",
    organism: ""
  });
  const [multiSessions, setMultiSessions] = useState([{ subject: "", date: "", start_time: "", end_time: "", modality: "distanciel", hourly_rate: 0, meeting_link: "" }]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentForm, setStudentForm] = useState({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", session_type: "", start_date: "", end_date: "", total_hours: 0 });

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

  // Fonction loadSessions pour recharger les sessions (utilisée par PlanningView)
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/sessions`);
      setSessions(res.data);
    } catch (error) {
      console.error("loadSessions error:", error);
      toast.error("Erreur chargement des séances");
    } finally {
      setLoading(false);
    }
  }, []);

  // Recalculer hourly_rate automatiquement si source=auto et sujet change
  useEffect(() => {
    if (sessionForm.hourly_rate_source === 'auto' && sessionForm.subject) {
      const suggestedRate = inferHourlyRate(sessionForm.subject);
      if (suggestedRate !== sessionForm.hourly_rate) {
        setSessionForm(prev => ({ ...prev, hourly_rate: suggestedRate }));
      }
    }
  }, [sessionForm.subject, sessionForm.hourly_rate_source]);

  const handleStudentChange = useCallback((value) => { setSessionForm(prev => ({ ...prev, student_id: value })); }, []);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/sessions`, sessionForm);
      toast.success("Séance créée et email envoyé !");
      setShowCreateSession(false);
      setSessionForm({ subject: "", date: "", start_time: "", end_time: "", student_id: "", validation_deadline_hours: 48, meeting_link: "", modality: "distanciel", hourly_rate: 0, hourly_rate_source: "inferred" });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  const handleCreateMultiSessions = async (e) => {
    e.preventDefault();
    try {
      // Créer toutes les séances pour tous les élèves sélectionnés
      const studentsToCreate = selectedStudents.length > 0 ? selectedStudents : [sessionForm.student_id];
      const promises = [];
      
      studentsToCreate.forEach(student_id => {
        multiSessions.forEach(session => {
          promises.push(
            axios.post(`${API}/sessions`, {
              ...session,
              student_id,
              validation_deadline_hours: 48
            })
          );
        });
      });
      
      await Promise.all(promises);
      const totalCreated = multiSessions.length * studentsToCreate.length;
      toast.success(`${totalCreated} séance(s) créée(s) pour ${studentsToCreate.length} élève(s) et emails envoyés !`);
      setShowCreateSession(false);
      setSessionForm({ subject: "", date: "", start_time: "", end_time: "", student_id: "", validation_deadline_hours: 48, meeting_link: "", modality: "distanciel", hourly_rate: 0, hourly_rate_source: "inferred" });
      setMultiSessions([{ subject: "", date: "", start_time: "", end_time: "", modality: "distanciel", hourly_rate: 0, meeting_link: "" }]);
      setSelectedStudents([]);
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de la création des séances");
    }
  };

  const addSessionToMulti = () => {
    setMultiSessions([...multiSessions, { subject: "", date: "", start_time: "", end_time: "", modality: "distanciel", hourly_rate: 0, meeting_link: "" }]);
  };

  const removeSessionFromMulti = (index) => {
    if (multiSessions.length > 1) {
      setMultiSessions(multiSessions.filter((_, i) => i !== index));
    }
  };

  const updateMultiSession = (index, field, value) => {
    const updated = [...multiSessions];
    updated[index][field] = value;
    setMultiSessions(updated);
  };

  const toggleStudentSelection = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const selectAllStudents = () => {
    setSelectedStudents(students.map(s => s.id));
  };

  const deselectAllStudents = () => {
    setSelectedStudents([]);
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/students`, { ...studentForm, role: "student", credit_hours: studentForm.total_hours });
      toast.success("Élève créé !");
      setShowCreateStudent(false);
      setStudentForm({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", session_type: "", start_date: "", end_date: "", total_hours: 0 });
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

  const handleResendAttendanceEmail = async (sessionId) => {
    try {
      await axios.post(`${API}/sessions/${sessionId}/resend-attendance-email`);
      toast.success("Email d'émargement renvoyé !");
    } catch (error) {
      toast.error("Erreur envoi");
    }
  };

  // Fonctions de signature formateur
  const openTeacherSignatureDialog = (session) => {
    setCurrentSessionToSign(session);
    setShowTeacherSignatureDialog(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }, 100);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearTeacherSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveTeacherSignature = async () => {
    const canvas = canvasRef.current;
    const signatureImage = canvas.toDataURL('image/png');
    
    try {
      await axios.patch(`${API}/sessions/${currentSessionToSign.id}/teacher-sign`, {
        signature: signatureImage
      });
      
      toast.success("Signature formateur enregistrée !");
      setShowTeacherSignatureDialog(false);
      setCurrentSessionToSign(null);
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de l'enregistrement de la signature");
    }
  };

  // Fonctions pour l'envoi de parcours émargé
  const handleOpenSendAttendance = (student) => {
    setAttendanceStudent(student);
    setAttendanceMonth(selectedMonth);
    setAttendanceMode('month');
    setAttendanceSession(null);
    setAttendanceRecipients({
      student: true,
      teacher: false,
      enterprise: false,
      others: ''
    });
    setAttendanceEmailSubject(`Justificatif d'émargement - ${student.name}`);
    setAttendanceEmailBody(`Bonjour,\n\nVeuillez trouver ci-joint le justificatif d'émargement pour ${student.name}.\n\nCordialement,\nTerciform`);
    setShowSendAttendanceDialog(true);
  };

  // Fonction pour ouvrir la modale "Parcours élève"
  const handleOpenStudentDocuments = (student) => {
    setDocumentsStudent(student);
    setShowStudentDocumentsDialog(true);
  };

  const handleSendAttendance = async (e) => {
    e.preventDefault();
    
    try {
      // Construire la liste des destinataires
      const recipients = [];
      if (attendanceRecipients.student && attendanceStudent) {
        recipients.push(attendanceStudent.email);
      }
      if (attendanceRecipients.teacher && user) {
        recipients.push(user.email);
      }
      // Ajouter autres emails
      if (attendanceRecipients.others) {
        const otherEmails = attendanceRecipients.others.split(',').map(e => e.trim()).filter(e => e);
        recipients.push(...otherEmails);
      }
      
      if (recipients.length === 0) {
        toast.error("Veuillez sélectionner au moins un destinataire");
        return;
      }
      
      const payload = {
        mode: attendanceMode,
        to: recipients,
        subject: attendanceEmailSubject,
        body: attendanceEmailBody
      };
      
      if (attendanceMode === 'session') {
        if (!attendanceSession) {
          toast.error("Veuillez sélectionner une séance");
          return;
        }
        payload.session_id = attendanceSession.id;
      } else if (attendanceMode === 'month') {
        if (!attendanceMonth) {
          toast.error("Veuillez sélectionner un mois");
          return;
        }
        payload.student_id = attendanceStudent.id;
        payload.month = attendanceMonth;
      } else if (attendanceMode === 'complete' || attendanceMode === 'full') {
        // Parcours complet - toutes les séances signées de l'élève
        payload.mode = 'full';  // Forcer le mode 'full' pour le backend
        payload.student_id = attendanceStudent.id;
        // Pas de month pour le parcours complet
      }
      
      const response = await axios.post(`${API}/send-attendance`, payload);
      
      toast.success(response.data.info || `Justificatif envoyé à ${recipients.length} destinataire(s)`);
      setShowSendAttendanceDialog(false);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de l'envoi du justificatif");
    }
  };


  const handleEditSession = (session) => {
    setEditingSession(session);
    const calculatedRate = session.hourly_rate || inferHourlyRate(session.subject || "");
    setSessionForm({
      subject: session.subject || "",
      date: session.date || "",
      start_time: session.start_time || "",
      end_time: session.end_time || "",
      student_id: session.student_id || "",
      validation_deadline_hours: 48,
      meeting_link: session.meeting_link || "",
      hourly_rate: calculatedRate,
      hourly_rate_source: session.hourly_rate_source || "auto",
      modality: session.modality || "distanciel",
      organism: session.organism || ""
    });
    setShowEditSession(true);
  };

  const handleUpdateSession = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/sessions/${editingSession.id}`, {
        subject: sessionForm.subject,
        date: sessionForm.date,
        start_time: sessionForm.start_time,
        end_time: sessionForm.end_time,
        meeting_link: sessionForm.meeting_link,
        hourly_rate: sessionForm.hourly_rate,
        hourly_rate_source: sessionForm.hourly_rate_source,
        modality: sessionForm.modality,
        organism: sessionForm.organism
      });
      toast.success("Séance modifiée !");
      setShowEditSession(false);
      setEditingSession(null);
      setSessionForm({ subject: "", date: "", start_time: "", end_time: "", student_id: "", validation_deadline_hours: 48, meeting_link: "" });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
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
      session_type: student.session_type || "",
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
      setStudentForm({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", session_type: "", start_date: "", end_date: "", total_hours: 0 });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };


  const handleSendPdf = (student) => {
    setPdfStudent(student);
    setPdfEmail(student.email); // Pré-remplir avec l'email de l'élève
    setShowSendPdfDialog(true);
  };

  const handleSendPdfSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/students/${pdfStudent.id}/send-planning-pdf`, {
        month: selectedMonth,
        recipient_email: pdfEmail
      });
      toast.success("Planning PDF envoyé avec succès !");
      setShowSendPdfDialog(false);
      setPdfStudent(null);
      setPdfEmail('');
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de l'envoi du PDF");
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

  const formatDateTimeWithDay = (dateString) => {
    const date = new Date(dateString);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayName = days[date.getDay()];
    const formatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${dayName} ${formatted} à ${time}`;
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

  // Afficher uniquement les élèves ayant des séances ce mois OU créés ce mois (date d'entrée)
  const studentsWithSessionsThisMonth = students.filter(student => {
    const hasSessionThisMonth = filteredSessions.some(s => s.student_id === student.id);
    const startDateInMonth = student.start_date && student.start_date.startsWith(selectedMonth);
    const createdInMonth = student.created_at && student.created_at.startsWith(selectedMonth);
    return hasSessionThisMonth || startDateInMonth || createdInMonth;
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
        {/* Barre d'actions avec boutons Planning et Facturation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>
            {showPlanning ? 'Planning général' : showBilling ? 'Facturation' : 'Séances par mois'}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={() => {
                setShowPlanning(!showPlanning);
                setShowBilling(false);
              }}
              className="inline-flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md shadow-sm"
            >
              <CalendarDays className="w-5 h-5" />
              {showPlanning ? 'Retour Séances' : 'Planning'}
            </Button>
            <Button
              onClick={() => {
                setShowBilling(!showBilling);
                setShowPlanning(false);
              }}
              className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold px-4 py-2 rounded-md shadow-sm"
            >
              <Euro className="w-5 h-5" />
              {showBilling ? 'Retour Séances' : 'Facturation'}
            </Button>
          </div>
        </div>

        {showPlanning ? (
          <PlanningView sessions={sessions} onSessionsUpdate={loadSessions} />
        ) : showBilling ? (
          <BillingView sessions={sessions} onSessionsUpdate={loadSessions} />
        ) : (
          <>
            <div className="mb-6">
            <Tabs value={selectedMonth} onValueChange={setSelectedMonth} className="space-y-6">
              <TabsList className="bg-white border border-gray-200 shadow-sm flex-wrap h-auto">
                {monthsList.map(m => <TabsTrigger key={m.key} value={m.key} className="capitalize data-[state=active]:bg-gray-200" style={{ color: TERCIFORM_BLUE }}>{m.label}</TabsTrigger>)}
              </TabsList>

            {monthsList.map(month => (
              <TabsContent key={month.key} value={month.key} className="space-y-6">
                {/* Nouvelles bulles : Heures totales et restantes des séances */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <Card className="card-hover border-2 shadow-md" style={{ borderColor: TERCIFORM_BLUE }}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Heures totales du mois</p>
                          <p className="text-xs text-gray-500 mb-2">{month.label}</p>
                          <p className="text-3xl font-bold" style={{ color: TERCIFORM_BLUE }}>
                            {filteredSessions.reduce((sum, s) => sum + (s.duration_hours || 0), 0)}h
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{filteredSessions.length} séance(s)</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}>
                          <Calendar className="w-6 h-6" style={{ color: TERCIFORM_BLUE }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="card-hover border-2 shadow-md" style={{ borderColor: TERCIFORM_BLUE }}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Heures restantes du mois</p>
                          <p className="text-xs text-gray-500 mb-2">{month.label}</p>
                          <p className="text-3xl font-bold text-green-600">
                            {filteredSessions.filter(s => !s.signature).reduce((sum, s) => sum + (s.duration_hours || 0), 0)}h
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{filteredSessions.filter(s => !s.signature).length} séance(s) non émargée(s)</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <Clock className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {stats && stats.month === month.key && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total des heures réalisées</p><p className="text-3xl font-bold mt-1" style={{ color: TERCIFORM_BLUE }}>{stats.total_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.total_sessions} séance(s)</p></div><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}><Calendar className="w-6 h-6" style={{ color: TERCIFORM_BLUE }} /></div></div></CardContent></Card>
                    <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total des heures confirmées</p><p className="text-3xl font-bold text-green-600 mt-1">{stats.confirmed_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.confirmed_sessions} séance(s)</p></div><div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-600" /></div></div></CardContent></Card>
                    <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total des heures refusées</p><p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.rejected_sessions} séance(s)</p></div><div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><XCircle className="w-6 h-6 text-red-600" /></div></div></CardContent></Card>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

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
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Créer des séances</DialogTitle><DialogDescription>Créer une ou plusieurs séances pour un élève</DialogDescription></DialogHeader>
                  <form onSubmit={handleCreateMultiSessions} className="space-y-4">
                    {/* Sélection de l'élève en premier */}
                    <div className="space-y-2 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <Label className="text-base font-bold">Élève *</Label>
                      <select value={sessionForm.student_id} onChange={(e) => handleStudentChange(e.target.value)} className="w-full h-11 px-3 py-2 border-2 border-blue-300 rounded-md bg-white font-medium">
                        <option value="">Sélectionner un élève</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    {/* Liste des séances à créer */}
                    {sessionForm.student_id && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-gray-900">Séances à créer ({multiSessions.length})</h3>
                          <Button
                            type="button"
                            onClick={addSessionToMulti}
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Plus className="w-4 h-4" />
                            Ajouter une séance
                          </Button>
                        </div>

                        {multiSessions.map((session, index) => (
                          <div key={index} className="p-4 border-2 border-gray-200 rounded-lg space-y-3 bg-gray-50">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-gray-900">Séance {index + 1}</h4>
                              {multiSessions.length > 1 && (
                                <Button
                                  type="button"
                                  onClick={() => removeSessionFromMulti(index)}
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  size="sm"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>Matière</Label>
                              <Input
                                placeholder="ex: Anglais"
                                value={session.subject}
                                onChange={(e) => updateMultiSession(index, 'subject', e.target.value)}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input
                                type="date"
                                value={session.date}
                                onChange={(e) => updateMultiSession(index, 'date', e.target.value)}
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Heure début</Label>
                                <Input
                                  type="time"
                                  value={session.start_time}
                                  onChange={(e) => updateMultiSession(index, 'start_time', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Heure fin</Label>
                                <Input
                                  type="time"
                                  value={session.end_time}
                                  onChange={(e) => updateMultiSession(index, 'end_time', e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Modalité</Label>
                              <select
                                value={session.modality}
                                onChange={(e) => updateMultiSession(index, 'modality', e.target.value)}
                                className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md bg-white"
                              >
                                <option value="distanciel">Distanciel</option>
                                <option value="presentiel">Présentiel</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <Label>Lien visioconférence</Label>
                              <Input
                                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                value={session.meeting_link}
                                onChange={(e) => updateMultiSession(index, 'meeting_link', e.target.value)}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Coût horaire (€)</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={session.hourly_rate}
                                  onChange={(e) => updateMultiSession(index, 'hourly_rate', parseFloat(e.target.value) || 0)}
                                  className="flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateMultiSession(index, 'hourly_rate', 20)}
                                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium"
                                >
                                  20€
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateMultiSession(index, 'hourly_rate', 40)}
                                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium"
                                >
                                  40€
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="submit"
                          className="w-full text-white py-6 text-lg font-bold"
                          style={{ backgroundColor: TERCIFORM_BLUE }}
                        >
                          Créer {multiSessions.length} séance(s) et envoyer les confirmations
                        </Button>
                      </div>
                    )}
                  </form>
                </DialogContent>
              </Dialog>
            </div>

              {/* Edit Session Dialog */}
              <Dialog open={showEditSession} onOpenChange={setShowEditSession}>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Modifier la Séance</DialogTitle><DialogDescription>Modifier les informations de la séance</DialogDescription></DialogHeader>
                  <form onSubmit={handleUpdateSession} className="space-y-4">
                    <div className="space-y-2"><Label>Matière</Label><Input placeholder="ex: Anglais" value={sessionForm.subject} onChange={(e) => setSessionForm({ ...sessionForm, subject: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Heure début</Label><Input type="time" value={sessionForm.start_time} onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })} required /></div>
                      <div className="space-y-2"><Label>Heure fin</Label><Input type="time" value={sessionForm.end_time} onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })} required /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Lien visioconférence (Google Meet, Zoom, etc.)</Label>
                      <Input 
                        placeholder="https://meet.google.com/xxx-xxxx-xxx" 
                        value={sessionForm.meeting_link} 
                        onChange={(e) => setSessionForm({ ...sessionForm, meeting_link: e.target.value })} 
                      />
                      <p className="text-xs text-gray-500">💡 Conseil : Créez un lien Google Meet permanent et réutilisez-le pour toutes vos séances</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Modalité *</Label>
                      <select 
                        value={sessionForm.modality || 'distanciel'} 
                        onChange={(e) => setSessionForm({ ...sessionForm, modality: e.target.value })}
                        className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        <option value="distanciel">Distanciel</option>
                        <option value="presentiel">Présentiel</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Coût horaire (€) *</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={sessionForm.hourly_rate || 40}
                          onChange={(e) => setSessionForm({
                            ...sessionForm,
                            hourly_rate: parseFloat(e.target.value) || 0,
                            hourly_rate_source: 'manual'
                          })}
                          className="flex-1"
                        />
                        
                        <button
                          type="button"
                          onClick={() => setSessionForm({
                            ...sessionForm,
                            hourly_rate: 20,
                            hourly_rate_source: 'manual'
                          })}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                        >
                          20€
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionForm({
                            ...sessionForm,
                            hourly_rate: 40,
                            hourly_rate_source: 'manual'
                          })}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                        >
                          40€
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Suggéré automatiquement selon la matière. Modifiez si besoin.
                      </p>
                    </div>
                    
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: TERCIFORM_BLUE }}>Enregistrer les modifications</Button>
                  </form>
                </DialogContent>
              </Dialog>


            <div className="grid gap-4">
              {groupedSessionsList.length === 0 ? (
                <Card className="border-0 shadow-md"><CardContent className="pt-6 text-center text-gray-500">Aucune séance</CardContent></Card>
              ) : (
                groupedSessionsList.map((group, idx) => (
                  <Card key={idx} className="shadow-md card-hover border-2" style={{ borderColor: TERCIFORM_BLUE }}>
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
                          <div className="space-y-3">
                            {group.sessions.map(session => (
                              <div key={session.id} className="flex flex-col gap-3 py-3 px-3 bg-gray-50 rounded-lg border" style={{ borderColor: TERCIFORM_BLUE }}>
                                {/* Ligne d'en-tête: Nom + Statut confirmation */}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-gray-900">{session.student_name}</span>
                                  {session.status === 'confirmed' && session.validated_at && (
                                    <span className="text-sm text-green-700 font-medium italic">
                                      Confirmée le {formatDateWithDay(session.validated_at)}
                                    </span>
                                  )}
                                  {session.status === 'rejected' && session.validated_at && (
                                    <span className="text-sm text-red-700 font-medium italic">
                                      Refusée le {formatDateWithDay(session.validated_at)}
                                    </span>
                                  )}
                                  {session.status === 'pending' && (
                                    <span className="text-sm text-yellow-700 font-medium flex items-center gap-1">
                                      <AlertCircle className="w-4 h-4" />
                                      En attente de validation
                                    </span>
                                  )}
                                </div>
                                
                                {/* Ligne Signatures - badges plus grands et visibles */}
                                {(session.signature || session.teacher_signature || session.signature_status === "pending" || session.signature_status === "expired") && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Badge signature élève */}
                                    {session.signature && session.signed_at && (
                                      <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 border border-green-300 text-base px-4 py-2 rounded-md font-medium">
                                        ✓ Émargé le {formatDateTimeWithDay(session.signed_at)} — par l'élève
                                        {session.signature && (
                                          <img 
                                            src={session.signature} 
                                            alt="Signature élève" 
                                            className="max-h-6 object-contain"
                                          />
                                        )}
                                      </span>
                                    )}
                                    
                                    {/* Badge signature formateur */}
                                    {session.teacher_signature && session.teacher_signed_at && (
                                      <span className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 border border-purple-300 text-base px-4 py-2 rounded-md font-medium">
                                        ✓ Émargé le {formatDateTimeWithDay(session.teacher_signed_at)} — par le formateur
                                        {session.teacher_signature && (
                                          <img 
                                            src={session.teacher_signature} 
                                            alt="Signature formateur" 
                                            className="max-h-6 object-contain"
                                          />
                                        )}
                                      </span>
                                    )}
                                    
                                    {/* Statuts en attente */}
                                    {session.signature_status === "pending" && !session.signature && (
                                      <span className="px-3 py-1.5 bg-orange-100 text-orange-700 border border-orange-300 rounded-md text-sm font-medium">
                                        ⏳ En attente d'émargement élève
                                      </span>
                                    )}
                                    {session.signature_status === "expired" && (
                                      <span className="px-3 py-1.5 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm font-medium">
                                        ⚠️ Émargement élève expiré
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Boutons d'action en grille 2 colonnes */}
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                  {session.meeting_link && (
                                    <Button 
                                      onClick={() => window.open(session.meeting_link, '_blank')}
                                      className="w-full py-2 rounded-md flex items-center justify-center gap-2 text-white"
                                      size="sm"
                                      style={{ backgroundColor: TERCIFORM_BLUE }}
                                    >
                                      🎥 Rejoindre
                                    </Button>
                                  )}
                                  <Button 
                                    onClick={() => handleResendEmail(session.id)} 
                                    variant="outline" 
                                    size="sm"
                                    className="w-full py-2 rounded-md flex items-center justify-center gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                                  >
                                    <Mail className="w-4 h-4" />
                                    Renvoyer confirmation
                                  </Button>
                                  <Button 
                                    onClick={() => handleResendAttendanceEmail(session.id)} 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full py-2 rounded-md flex items-center justify-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                                  >
                                    <PenTool className="w-4 h-4" />
                                    Renvoyer émargement élève
                                  </Button>
                                  <Button 
                                    onClick={() => openTeacherSignatureDialog(session)} 
                                    variant="outline" 
                                    size="sm" 
                                    style={{ color: '#6B2E6F', borderColor: '#d1a7d4' }}
                                    className="w-full py-2 rounded-md flex items-center justify-center gap-2 hover:bg-purple-50"
                                  >
                                    <PenTool className="w-4 h-4 rotate-180" />
                                    Émargement professeur
                                  </Button>
                                  <Button 
                                    onClick={() => handleEditSession(session)} 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full py-2 rounded-md flex items-center justify-center gap-2 text-green-600 border-green-300 hover:bg-green-50"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Modifier
                                  </Button>
                                  <Button 
                                    onClick={() => handleDeleteSession(session.id)} 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full py-2 rounded-md flex items-center justify-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer
                                  </Button>
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
              <h2 className="text-xl font-bold text-gray-900">Élèves du mois</h2>
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
                    <div className="space-y-2">
                      <Label>Type de séance</Label>
                      <select 
                        value={studentForm.session_type} 
                        onChange={(e) => setStudentForm({ ...studentForm, session_type: e.target.value })} 
                        className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Sélectionner un type</option>
                        <option value="distanciel">Distanciel</option>
                        <option value="présentiel">Présentiel</option>
                      </select>
                    </div>
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
                    <div className="space-y-2">
                      <Label>Type de séance</Label>
                      <select 
                        value={studentForm.session_type} 
                        onChange={(e) => setStudentForm({ ...studentForm, session_type: e.target.value })} 
                        className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Sélectionner un type</option>
                        <option value="distanciel">Distanciel</option>
                        <option value="présentiel">Présentiel</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Date d'entrée</Label><Input type="date" value={studentForm.start_date} onChange={(e) => setStudentForm({ ...studentForm, start_date: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Date de sortie</Label><Input type="date" value={studentForm.end_date} onChange={(e) => setStudentForm({ ...studentForm, end_date: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label>Heures totales</Label><Input type="number" step="0.5" min="0" placeholder="ex: 20" value={studentForm.total_hours} onChange={(e) => setStudentForm({ ...studentForm, total_hours: parseFloat(e.target.value) || 0 })} /></div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: TERCIFORM_BLUE }}>Modifier l'élève</Button>
                  </form>
                </DialogContent>
              </Dialog>


              {/* Send PDF Dialog */}
              <Dialog open={showSendPdfDialog} onOpenChange={setShowSendPdfDialog}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Envoyer le planning en PDF</DialogTitle>
                    <DialogDescription>
                      {pdfStudent && `Planning de ${pdfStudent.name} pour le mois sélectionné`}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendPdfSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>À qui voulez-vous l'envoyer ?</Label>
                      <Input 
                        type="text"
                        placeholder="email1@exemple.com, email2@exemple.com" 
                        value={pdfEmail} 
                        onChange={(e) => setPdfEmail(e.target.value)} 
                        required 
                      />
                      <p className="text-xs text-gray-500">💡 Séparez plusieurs emails par des virgules</p>
                      <p className="text-xs text-gray-500">Le PDF contiendra les séances du mois avec les informations (sans émargement)</p>
                    </div>
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: '#DC143C' }}>
                      <FileText className="w-4 h-4 mr-2" />
                      Envoyer le PDF
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

            </div>

            <div className="grid gap-4">
              {studentsWithSessionsThisMonth.length === 0 ? (
                <Card className="border-0 shadow-md"><CardContent className="pt-6 text-center text-gray-500">Aucun élève avec séances ce mois</CardContent></Card>
              ) : (
                studentsWithSessionsThisMonth.map(student => {
                  const studentSessions = sessions.filter(s => s.student_id === student.id && s.date.startsWith(selectedMonth));
                  return (
                    <Card key={student.id} className="shadow-md card-hover border-2" style={{ borderColor: TERCIFORM_BLUE }}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                <p><span className="font-medium">Email:</span> {student.email}</p>
                                {student.phone && <p><span className="font-medium">Tél:</span> {student.phone}</p>}
                                {student.organism && <p><span className="font-medium">Organisme:</span> {student.organism}</p>}
                                {student.support_type && <p><span className="font-medium">Prise en charge:</span> {student.support_type}</p>}
                                {student.session_type && <p><span className="font-medium">Type de séance:</span> <span className="capitalize">{student.session_type}</span></p>}
                                {(student.start_date || student.end_date) && (
                                  <p>
                                    {student.start_date && <><span className="font-medium">Entrée:</span> {new Date(student.start_date).toLocaleDateString('fr-FR')}</>}
                                    {student.start_date && student.end_date && <span> - </span>}
                                    {student.end_date && <><span className="font-medium">Sortie:</span> {new Date(student.end_date).toLocaleDateString('fr-FR')}</>}
                                  </p>
                                )}
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
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <Button 
                                onClick={() => handleSendPdf(student)} 
                                variant="outline" 
                                size="sm" 
                                className="w-full py-3 rounded-md flex items-center justify-start gap-2 text-white border-0"
                                style={{ backgroundColor: '#DC143C' }}
                              >
                                <FileText className="w-5 h-5" />
                                <span className="font-medium">Planning de formation</span>
                              </Button>
                              <Button 
                                onClick={() => handleOpenSendAttendance(student)} 
                                variant="outline" 
                                size="sm" 
                                className="w-full py-3 rounded-md border-2 border-purple-500 text-purple-700 flex items-center justify-start gap-2 hover:bg-purple-50 bg-white"
                              >
                                <FileCheck className="w-5 h-5" />
                                <span className="font-medium">Parcours émargé</span>
                              </Button>
                              <Button 
                                onClick={() => handleEditStudent(student)} 
                                variant="outline" 
                                size="sm" 
                                className="w-full py-3 rounded-md flex items-center justify-start gap-2 border-2 border-blue-500 text-blue-700 hover:bg-blue-50 bg-white"
                              >
                                <Edit className="w-5 h-5" />
                                <span className="font-medium">Modifier la fiche</span>
                              </Button>
                              <Button 
                                onClick={() => handleDeleteStudent(student.id, student.name)} 
                                variant="outline" 
                                size="sm" 
                                className="w-full py-3 rounded-md flex items-center justify-start gap-2 border-2 border-red-500 bg-white hover:bg-red-50"
                              >
                                <Trash2 className="w-5 h-5 text-red-600" />
                                <span className="font-medium text-red-700">Supprimer</span>
                              </Button>
                              {/* Bouton Parcours élève */}
                              <Button 
                                onClick={() => handleOpenStudentDocuments(student)} 
                                className="w-full py-4 mt-2 bg-gradient-to-br from-[#8B5A2B] via-[#7A4F26] to-[#6B4522] text-white rounded-lg shadow-md hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2 font-semibold"
                              >
                                <FolderOpen className="w-5 h-5" />
                                <span>Parcours élève</span>
                              </Button>
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
                                      <span className="text-gray-500">le {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</span>
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
                                            ✓ Émargé le {formatDateTimeWithDay(session.signed_at)}
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
          </div>
          </>
        )}
      </main>

      {/* Dialog de signature formateur */}
      <Dialog open={showTeacherSignatureDialog} onOpenChange={setShowTeacherSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Émargement Formateur</DialogTitle>
            <DialogDescription>
              Veuillez signer avec votre souris ou votre doigt dans le cadre ci-dessous
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="cursor-crosshair w-full"
                style={{ touchAction: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={clearTeacherSignature}
                variant="outline"
                className="flex-1"
              >
                Effacer
              </Button>
              <Button
                onClick={saveTeacherSignature}
                className="flex-1 text-white"
                style={{ backgroundColor: '#6B2E6F' }}
              >
                Valider la signature
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog d'envoi de parcours émargé */}
      <Dialog open={showSendAttendanceDialog} onOpenChange={setShowSendAttendanceDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Envoyer un parcours émargé</DialogTitle>
            <DialogDescription>
              {attendanceStudent && `Justificatifs d'émargement pour ${attendanceStudent.name}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendAttendance} className="space-y-4">
            {/* Type d'envoi */}
            <div className="space-y-2">
              <Label className="font-semibold">Type d'envoi</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="attendanceMode" 
                    value="session"
                    checked={attendanceMode === 'session'}
                    onChange={(e) => setAttendanceMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Séance unique</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="attendanceMode" 
                    value="month"
                    checked={attendanceMode === 'month'}
                    onChange={(e) => setAttendanceMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Mois complet</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="attendanceMode" 
                    value="complete"
                    checked={attendanceMode === 'complete'}
                    onChange={(e) => setAttendanceMode(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>Parcours complet</span>
                </label>
              </div>
            </div>

            {/* Sélection séance ou mois */}
            {attendanceMode === 'session' ? (
              <div className="space-y-2">
                <Label>Sélectionner une séance</Label>
                <select 
                  className="w-full px-3 py-2 border rounded-md"
                  value={attendanceSession?.id || ''}
                  onChange={(e) => {
                    const session = sessions.find(s => s.id === e.target.value && s.student_id === attendanceStudent?.id);
                    setAttendanceSession(session);
                  }}
                  required
                >
                  <option value="">-- Choisir une séance --</option>
                  {attendanceStudent && sessions
                    .filter(s => s.student_id === attendanceStudent.id)
                    .map(session => (
                      <option key={session.id} value={session.id}>
                        {session.subject} - {session.date} ({session.start_time}-{session.end_time})
                      </option>
                    ))}
                </select>
              </div>
            ) : attendanceMode === 'month' ? (
              <div className="space-y-2">
                <Label>Sélectionner un mois</Label>
                <select 
                  className="w-full px-3 py-2 border rounded-md"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  required
                >
                  {monthsList.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
            ) : attendanceMode === 'complete' ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  📋 Le parcours complet inclut toutes les séances signées de l'élève, tous mois confondus.
                </p>
              </div>
            ) : null}

            {/* Destinataires */}
            <div className="space-y-2">
              <Label className="font-semibold">Destinataires</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={attendanceRecipients.student}
                    onChange={(e) => setAttendanceRecipients({...attendanceRecipients, student: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span>Élève ({attendanceStudent?.email})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={attendanceRecipients.teacher}
                    onChange={(e) => setAttendanceRecipients({...attendanceRecipients, teacher: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span>Formateur (moi)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={attendanceRecipients.enterprise}
                    onChange={(e) => setAttendanceRecipients({...attendanceRecipients, enterprise: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span>Entreprise/Client</span>
                </label>
              </div>
              <div className="mt-2">
                <Label>Autres emails (séparés par des virgules)</Label>
                <Input 
                  type="text"
                  placeholder="email1@exemple.com, email2@exemple.com"
                  value={attendanceRecipients.others}
                  onChange={(e) => setAttendanceRecipients({...attendanceRecipients, others: e.target.value})}
                />
              </div>
            </div>

            {/* Modèle d'email */}
            <div className="space-y-2">
              <Label className="font-semibold">Modèle d'e-mail</Label>
              <div>
                <Label>Objet</Label>
                <Input 
                  type="text"
                  value={attendanceEmailSubject}
                  onChange={(e) => setAttendanceEmailSubject(e.target.value)}
                  placeholder="Objet de l'email"
                  required
                />
              </div>
              <div>
                <Label>Message</Label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  value={attendanceEmailBody}
                  onChange={(e) => setAttendanceEmailBody(e.target.value)}
                  placeholder="Corps du message..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables disponibles: {'{eleve}'}, {'{mois}'}, {'{heures_total}'}, {'{heures_signees}'}
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full text-white py-2" style={{ backgroundColor: '#6B2E6F' }}>
              <FileCheck className="w-4 h-4 mr-2" />
              Envoyer le justificatif
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Parcours élève - Nouveau composant avec 2 onglets */}
      <ParcoursEleveModal
        open={showStudentDocumentsDialog}
        onOpenChange={setShowStudentDocumentsDialog}
        student={documentsStudent}
      />
    </div>
  );
}
