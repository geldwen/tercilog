import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Plus, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Mail, Edit, PenTool, FileText, FileCheck, CalendarDays, Euro, FolderOpen, Download, MoreVertical, Video, Search, Monitor, School, Smile } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
  const [showEditTimesDialog, setShowEditTimesDialog] = useState(false);
  const [editTimeSlots, setEditTimeSlots] = useState([{ start_time: "", end_time: "" }]);
  const [documentsStudent, setDocumentsStudent] = useState(null);
  const [showPlanning, setShowPlanning] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [activeTab, setActiveTab] = useState("sessions"); // Pour le filigrane
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(new Date().getMonth() + 1);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [currentSessionToSign, setCurrentSessionToSign] = useState(null);
  const [pdfStudent, setPdfStudent] = useState(null);
  const [pdfEmail, setPdfEmail] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);

  // Fonctions de navigation des mois
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

  // États pour la recherche d'élève
  const [showSearchStudent, setShowSearchStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStudents, setFilteredStudents] = useState(null); // null = afficher tous, [] = aucun résultat, [...] = résultats filtrés
  const [searchError, setSearchError] = useState('');

  // États pour la recherche de séance
  const [showSearchSession, setShowSearchSession] = useState(false);
  const [searchSessionYear, setSearchSessionYear] = useState(new Date().getFullYear());
  const [searchSessionMonth, setSearchSessionMonth] = useState('');
  const [searchSessionDay, setSearchSessionDay] = useState('');
  const [filteredSessionsSearch, setFilteredSessionsSearch] = useState(null); // null = utiliser filteredSessions par défaut
  const [searchSessionError, setSearchSessionError] = useState('');

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
    organism: "",
    time_slots: [{ start_time: "", end_time: "" }]
  });
  const [multiSessions, setMultiSessions] = useState([{ 
    subject: "", 
    date: "", 
    time_slots: [{ start_time: "", end_time: "" }],
    modality: "distanciel", 
    hourly_rate: 0, 
    meeting_link: "" 
  }]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentForm, setStudentForm] = useState({ 
    name: "", 
    phone: "", 
    email: "", 
    password: "", 
    organism: "", 
    support_type: "", 
    session_type: "distanciel", 
    start_date: "", 
    end_date: "", 
    total_hours: 0, 
    parcours: "Anglais",
    teacher_name: "",
    teacher_email: "",
    teacher_phone: "",
    teacher_profile_picture: "/api/profile-pictures/homme_default.png",
    teacher_profile_picture_type: "homme",
    formation_address: "",
    formation_building: "",
    formation_street_number: "",
    formation_street: "",
    formation_postal_code: "",
    formation_city: "",
    formation_country: "France",
    formation_transports: ""
  });
  
  // États pour création multiple d'élèves
  const [multiStudents, setMultiStudents] = useState([]);
  const [isMultiMode, setIsMultiMode] = useState(false);
  
  // Historique des lieux de formation (auto-complétion)
  const [locationHistory, setLocationHistory] = useState([]);
  
  // Historique des formateurs (auto-complétion)
  const [teacherHistory, setTeacherHistory] = useState([]);
  
  // États pour les tests et questionnaires
  const [includeTests, setIncludeTests] = useState(false);
  const [includeQuestionnaires, setIncludeQuestionnaires] = useState(true); // Par défaut Oui
  const [selectedTests, setSelectedTests] = useState({
    positionnement: "",
    miParcours: "",
    fin: ""
  });
  const [selectedQuestionnaires, setSelectedQuestionnaires] = useState({
    q1: "",
    q2: "",
    q3: ""
  });

  // Modèles de tests disponibles par parcours
  const testModels = {
    "Anglais": {
      positionnement: ["Évaluation anglais initial", "Test anglais de positionnement v2"],
      miParcours: ["Évaluation anglais mi-parcours v1", "Évaluation anglais mi-parcours v2"],
      fin: ["Évaluation anglais final v1", "Évaluation anglais final v2"]
    },
    "Bureautique": {
      positionnement: ["T1 - Test de positionnement"],
      miParcours: ["T2 - Test à mi parcours"],
      fin: ["T3 - Test de fin de formation"]
    },
    "Management": {
      positionnement: ["Test management initial"],
      miParcours: ["Évaluation management mi-parcours"],
      fin: ["Test final management"]
    },
    "Informatique": {
      positionnement: ["T1 – Test de positionnement informatique"],
      miParcours: ["T2 – Test mi parcours informatique"],
      fin: ["T3 – Test fin de parcours Informatique"]
    }
  };

  // Modèles de questionnaires Qualiopi disponibles par parcours
  const questionnaireModels = {
    "Anglais": {
      q1: ["Q1 - Besoins anglais v1"],
      q2: ["Q2 - Mi-parcours anglais v1"],
      q3: ["Q3 - Fin formation anglais v1 (Bloc A + B)"]
    },
    "Bureautique": {
      q1: ["Q1 - Besoins bureautique v1"],
      q2: ["Q2 - Mi-parcours bureautique v1"],
      q3: ["Q3 - Fin formation bureautique v1"]
    },
    "Management": {
      q1: ["Q1 - Besoins management v1"],
      q2: ["Q2 - Mi-parcours management v1"],
      q3: ["Q3 - Fin formation management v1"]
    },
    "Informatique": {
      q1: ["Q1 – Questionnaire d'entrée informatique – Besoins et identification"],
      q2: ["Q2 – Questionnaire mi-parcours – Informatique"],
      q3: ["Q3 – Questionnaire fin de formation – Informatique"]
    }
  };

  // Liste des années (2025 à 2030)
  const yearsList = [2025, 2026, 2027, 2028, 2029, 2030];
  
  // Liste des mois
  const monthNames = [
    { num: 1, label: 'Janvier' },
    { num: 2, label: 'Février' },
    { num: 3, label: 'Mars' },
    { num: 4, label: 'Avril' },
    { num: 5, label: 'Mai' },
    { num: 6, label: 'Juin' },
    { num: 7, label: 'Juillet' },
    { num: 8, label: 'Août' },
    { num: 9, label: 'Septembre' },
    { num: 10, label: 'Octobre' },
    { num: 11, label: 'Novembre' },
    { num: 12, label: 'Décembre' }
  ];

  // Calculer selectedMonth à partir de l'année et du mois sélectionnés
  const selectedMonth = useMemo(() => {
    const monthStr = selectedMonthNum.toString().padStart(2, '0');
    return `${selectedYear}-${monthStr}`;
  }, [selectedYear, selectedMonthNum]);

  // Générer un lien Jitsi unique pour une séance
  const generateJitsiLink = (session) => {
    const roomName = `terciform-${session.id.replace(/-/g, '').substring(0, 12)}`;
    return `https://meet.jit.si/${roomName}`;
  };

  useEffect(() => { if (selectedMonth) loadData(selectedMonth); }, [selectedMonth]);

  const loadData = async (month) => {
    try {
      const [sessionsRes, studentsRes, statsRes] = await Promise.all([axios.get(`${API}/sessions`), axios.get(`${API}/students`), axios.get(`${API}/sessions/stats?month=${month}`)]);
      setSessions(sessionsRes.data);
      setStudents(studentsRes.data);
      setStats(statsRes.data);
      
      // Charger l'historique des lieux de formation depuis les élèves
      const locations = [];
      const teachers = [];
      studentsRes.data.forEach(s => {
        // Historique lieux
        if (s.formation_building || s.formation_address) {
          const locationKey = `${s.formation_building || ''}|${s.formation_street_number || ''}|${s.formation_street || ''}|${s.formation_postal_code || ''}|${s.formation_city || ''}`;
          if (!locations.find(l => l.key === locationKey) && (s.formation_building || s.formation_city)) {
            locations.push({
              key: locationKey,
              label: s.formation_building ? `${s.formation_building} - ${s.formation_city || ''}` : s.formation_city,
              building: s.formation_building || '',
              street_number: s.formation_street_number || '',
              street: s.formation_street || '',
              postal_code: s.formation_postal_code || '',
              city: s.formation_city || '',
              country: s.formation_country || 'France',
              transports: s.formation_transports || ''
            });
          }
        }
        // Historique formateurs
        if (s.teacher_name && s.teacher_email) {
          const teacherKey = s.teacher_email;
          if (!teachers.find(t => t.key === teacherKey)) {
            teachers.push({
              key: teacherKey,
              label: `${s.teacher_name} (${s.teacher_email})`,
              name: s.teacher_name,
              email: s.teacher_email,
              phone: s.teacher_phone || '',
              profile_picture: s.teacher_profile_picture || '/api/profile-pictures/homme_default.png'
            });
          }
        }
      });
      setLocationHistory(locations);
      setTeacherHistory(teachers);
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
      const studentsToCreate = selectedStudents.length > 0 ? selectedStudents : [];
      
      if (studentsToCreate.length === 0) {
        toast.error("Veuillez sélectionner au moins un élève");
        return;
      }
      
      // Utiliser le nouvel endpoint bulk qui envoie UN email par élève
      const response = await axios.post(`${API}/sessions/bulk`, {
        student_ids: studentsToCreate,
        sessions: multiSessions
      });
      
      const totalCreated = multiSessions.length * studentsToCreate.length;
      toast.success(`${totalCreated} séance(s) créée(s) pour ${studentsToCreate.length} élève(s) et UN email par élève envoyé !`);
      setShowCreateSession(false);
      setSessionForm({ subject: "", date: "", start_time: "", end_time: "", student_id: "", validation_deadline_hours: 48, meeting_link: "", modality: "distanciel", hourly_rate: 0, hourly_rate_source: "inferred" });
      setMultiSessions([{ 
        subject: "", 
        date: "", 
        time_slots: [{ start_time: "", end_time: "" }],
        modality: "distanciel", 
        hourly_rate: 0, 
        meeting_link: "" 
      }]);
      setSelectedStudents([]);
      loadData(selectedMonth);
    } catch (error) {
      console.error("Error creating sessions:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de la création des séances");
    }
  };

  const addSessionToMulti = () => {
    setMultiSessions([...multiSessions, { 
      subject: "", 
      date: "", 
      time_slots: [{ start_time: "", end_time: "" }],
      modality: "distanciel", 
      hourly_rate: 0, 
      meeting_link: "" 
    }]);
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

  const addTimeSlot = (sessionIndex) => {
    const updated = [...multiSessions];
    updated[sessionIndex].time_slots.push({ start_time: "", end_time: "" });
    setMultiSessions(updated);
  };

  const removeTimeSlot = (sessionIndex, slotIndex) => {
    const updated = [...multiSessions];
    if (updated[sessionIndex].time_slots.length > 1) {
      updated[sessionIndex].time_slots.splice(slotIndex, 1);
      setMultiSessions(updated);
    }
  };

  const updateTimeSlot = (sessionIndex, slotIndex, field, value) => {
    const updated = [...multiSessions];
    updated[sessionIndex].time_slots[slotIndex][field] = value;
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

  // Fonctions pour modifier les horaires d'une séance
  const handleOpenEditTimes = (session) => {
    setEditingSession(session);
    setEditTimeSlots([{ start_time: session.start_time, end_time: session.end_time }]);
    setShowEditTimesDialog(true);
  };

  const addEditTimeSlot = () => {
    setEditTimeSlots([...editTimeSlots, { start_time: "", end_time: "" }]);
  };

  const removeEditTimeSlot = (index) => {
    if (editTimeSlots.length > 1) {
      setEditTimeSlots(editTimeSlots.filter((_, i) => i !== index));
    }
  };

  const updateEditTimeSlot = (index, field, value) => {
    const updated = [...editTimeSlots];
    updated[index][field] = value;
    setEditTimeSlots(updated);
  };

  const handleSaveEditTimes = async () => {
    if (!editingSession) return;

    try {
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API}/sessions/${editingSession.id}/times`,
        { 
          time_slots: editTimeSlots,
          date: editingSession.date,
          subject: editingSession.subject,
          modality: editingSession.modality,
          meeting_link: editingSession.meeting_link,
          hourly_rate: editingSession.hourly_rate
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Horaires modifiés avec succès !');
      setShowEditTimesDialog(false);
      loadSessions();
    } catch (error) {
      console.error('Erreur lors de la modification des horaires:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      // Préparer les ressources sélectionnées
      const resources = {
        tests: includeTests ? selectedTests : null,
        questionnaires: includeQuestionnaires ? selectedQuestionnaires : null
      };

      await axios.post(`${API}/students`, { 
        ...studentForm, 
        role: "student", 
        credit_hours: studentForm.total_hours,
        resources: resources
      });
      toast.success("Élève créé !");
      
      // Si mode multi, ajouter à la liste et réinitialiser le formulaire
      if (isMultiMode) {
        setMultiStudents([...multiStudents, { ...studentForm }]);
        // Garder les infos du formateur et lieu pour le prochain élève
        setStudentForm(prev => ({ 
          ...prev, 
          name: "", 
          phone: "", 
          email: "", 
          password: "",
          // Garder : organism, session_type, parcours, teacher_*, formation_*
        }));
        toast.info("Vous pouvez ajouter un autre élève");
      } else {
        setShowCreateStudent(false);
        setStudentForm({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", session_type: "", start_date: "", end_date: "", total_hours: 0, parcours: "Anglais", teacher_name: "", teacher_email: "", teacher_phone: "", teacher_profile_picture: "/api/profile-pictures/homme_default.png", teacher_profile_picture_type: "homme", formation_address: "", formation_building: "", formation_street: "", formation_postal_code: "", formation_city: "", formation_country: "France", formation_transports: "" });
      }
      
      setIncludeTests(false);
      setIncludeQuestionnaires(true);
      setSelectedTests({ positionnement: "", miParcours: "", fin: "" });
      setSelectedQuestionnaires({ q1: "", q2: "", q3: "" });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };
  
  // Fonction pour appliquer un lieu depuis l'historique
  const applyLocationFromHistory = (location) => {
    setStudentForm(prev => ({
      ...prev,
      formation_building: location.building,
      formation_street_number: location.street_number,
      formation_street: location.street,
      formation_postal_code: location.postal_code,
      formation_city: location.city,
      formation_country: location.country,
      formation_transports: location.transports
    }));
    toast.success("Lieu appliqué !");
  };
  
  // Fonction pour appliquer un formateur depuis l'historique
  const applyTeacherFromHistory = (teacher) => {
    setStudentForm(prev => ({
      ...prev,
      teacher_name: teacher.name,
      teacher_email: teacher.email,
      teacher_phone: teacher.phone,
      teacher_profile_picture: teacher.profile_picture,
      teacher_profile_picture_type: teacher.profile_picture?.includes('homme_default') ? 'homme' : teacher.profile_picture?.includes('femme_default') ? 'femme' : 'custom'
    }));
    toast.success("Formateur appliqué !");
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

  // État pour l'historique élève
  const [studentHistory, setStudentHistory] = useState([]);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fonction pour ouvrir l'historique d'un élève
  const handleOpenStudentHistory = async (studentId, studentName) => {
    setHistoryStudent({ id: studentId, name: studentName });
    setShowHistoryDialog(true);
    setLoadingHistory(true);
    
    try {
      const response = await axios.get(`${API}/students/${studentId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudentHistory(response.data.history || []);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
      toast.error('Impossible de charger l\'historique');
      setStudentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
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
      organism: session.organism || "",
      time_slots: [{ start_time: session.start_time || "", end_time: session.end_time || "" }]
    });
    setShowEditSession(true);
  };

  const handleUpdateSession = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Si plusieurs créneaux, utiliser l'endpoint times
      if (sessionForm.time_slots && sessionForm.time_slots.length > 1) {
        await axios.put(
          `${API}/sessions/${editingSession.id}/times`,
          { 
            time_slots: sessionForm.time_slots,
            date: sessionForm.date,
            subject: sessionForm.subject,
            modality: sessionForm.modality,
            meeting_link: sessionForm.meeting_link,
            hourly_rate: sessionForm.hourly_rate,
            organism: sessionForm.organism
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Séance modifiée ! ${sessionForm.time_slots.length} créneaux créés.`);
      } else {
        // Sinon, mise à jour simple
        await axios.put(`${API}/sessions/${editingSession.id}`, {
          subject: sessionForm.subject,
          date: sessionForm.date,
          start_time: sessionForm.time_slots[0].start_time,
          end_time: sessionForm.time_slots[0].end_time,
          meeting_link: sessionForm.meeting_link,
          hourly_rate: sessionForm.hourly_rate,
          hourly_rate_source: sessionForm.hourly_rate_source,
          modality: sessionForm.modality,
          organism: sessionForm.organism
        }, { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Séance modifiée !");
      }
      
      setShowEditSession(false);
      setEditingSession(null);
      setSessionForm({ subject: "", date: "", start_time: "", end_time: "", student_id: "", validation_deadline_hours: 48, meeting_link: "", time_slots: [{ start_time: "", end_time: "" }] });
      loadData(selectedMonth);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  // Fonctions pour gérer les créneaux horaires dans le formulaire d'édition
  const addEditSessionTimeSlot = () => {
    setSessionForm({
      ...sessionForm,
      time_slots: [...sessionForm.time_slots, { start_time: "", end_time: "" }]
    });
  };

  const removeEditSessionTimeSlot = (index) => {
    if (sessionForm.time_slots.length > 1) {
      const updatedSlots = sessionForm.time_slots.filter((_, i) => i !== index);
      setSessionForm({ ...sessionForm, time_slots: updatedSlots });
    }
  };

  const updateEditSessionTimeSlot = (index, field, value) => {
    const updatedSlots = [...sessionForm.time_slots];
    updatedSlots[index][field] = value;
    setSessionForm({ ...sessionForm, time_slots: updatedSlots });
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
      total_hours: student.total_hours || student.credit_hours || 0,
      parcours: student.parcours || "Anglais",
      teacher_name: student.teacher_name || "",
      teacher_email: student.teacher_email || "",
      teacher_phone: student.teacher_phone || "",
      teacher_profile_picture: student.teacher_profile_picture || "/api/profile-pictures/homme_default.png",
      teacher_profile_picture_type: student.teacher_profile_picture?.includes('homme_default') ? 'homme' : student.teacher_profile_picture?.includes('femme_default') ? 'femme' : 'custom',
      formation_address: student.formation_address || "",
      formation_building: student.formation_building || "",
      formation_street_number: student.formation_street_number || "",
      formation_street: student.formation_street || "",
      formation_postal_code: student.formation_postal_code || "",
      formation_city: student.formation_city || "",
      formation_country: student.formation_country || "France",
      formation_transports: student.formation_transports || ""
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
      setStudentForm({ name: "", phone: "", email: "", password: "", organism: "", support_type: "", session_type: "", start_date: "", end_date: "", total_hours: 0, parcours: "Anglais", teacher_name: "", teacher_email: "", teacher_phone: "", teacher_profile_picture: "/api/profile-pictures/homme_default.png", teacher_profile_picture_type: "homme", formation_address: "", formation_building: "", formation_street: "", formation_postal_code: "", formation_city: "", formation_country: "France", formation_transports: "" });
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
  // Utiliser les résultats de recherche si disponibles, sinon les séances du mois sélectionné
  const sessionsToDisplay = filteredSessionsSearch !== null ? filteredSessionsSearch : filteredSessions;
  const groupedSessions = {};
  sessionsToDisplay.forEach(session => {
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

  // Fonction pour normaliser le texte (enlever accents et mettre en minuscules)
  const normalizeSearchText = (text) => {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  // Fonction pour normaliser un numéro de téléphone (enlever espaces, tirets, points)
  const normalizePhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/[\s\-\.]/g, '');
  };

  // Fonction de recherche d'élève
  const handleSearchStudent = () => {
    setSearchError('');
    
    if (!searchQuery.trim()) {
      setSearchError('Veuillez entrer un nom, prénom ou numéro de téléphone');
      return;
    }

    const query = searchQuery.trim();
    const normalizedQuery = normalizeSearchText(query);
    const normalizedPhoneQuery = normalizePhone(query);

    // Recherche dans les élèves
    const results = students.filter(student => {
      // Recherche par nom (insensible aux accents)
      const normalizedName = normalizeSearchText(student.name);
      if (normalizedName.includes(normalizedQuery)) {
        return true;
      }

      // Recherche par téléphone (sans espaces)
      if (student.phone) {
        const normalizedStudentPhone = normalizePhone(student.phone);
        if (normalizedStudentPhone.includes(normalizedPhoneQuery)) {
          return true;
        }
      }

      return false;
    });

    if (results.length === 0) {
      // Déterminer le type de recherche pour le message d'erreur
      const isPhoneSearch = /^[0-9\s\-\.]+$/.test(query);
      if (isPhoneSearch) {
        setSearchError(`Ce numéro "${query}" n'existe pas dans vos élèves`);
      } else {
        setSearchError(`Ce nom ou prénom "${query}" n'existe pas dans vos élèves`);
      }
      return;
    }

    // Succès - fermer le modal et afficher les résultats
    setFilteredStudents(results);
    setShowSearchStudent(false);
    setSearchQuery('');
  };

  // Fonction pour réinitialiser la recherche et afficher tous les élèves
  const resetStudentSearch = () => {
    setFilteredStudents(null);
    setSearchQuery('');
    setSearchError('');
  };

  // Fonction de recherche de séance par date
  const handleSearchSession = () => {
    setSearchSessionError('');
    
    if (!searchSessionMonth) {
      setSearchSessionError('Veuillez sélectionner au moins un mois');
      return;
    }

    // Construire la date de recherche
    const monthStr = searchSessionMonth.toString().padStart(2, '0');
    let searchDate = `${searchSessionYear}-${monthStr}`;
    let dateLabel = `${monthNames.find(m => m.num === parseInt(searchSessionMonth))?.label} ${searchSessionYear}`;
    
    if (searchSessionDay) {
      const dayStr = searchSessionDay.toString().padStart(2, '0');
      searchDate = `${searchSessionYear}-${monthStr}-${dayStr}`;
      dateLabel = `${searchSessionDay} ${monthNames.find(m => m.num === parseInt(searchSessionMonth))?.label} ${searchSessionYear}`;
    }

    // Filtrer les séances
    const results = sessions.filter(session => {
      if (searchSessionDay) {
        // Recherche par jour précis
        return session.date === searchDate;
      } else {
        // Recherche par mois
        return session.date.startsWith(searchDate);
      }
    });

    if (results.length === 0) {
      setSearchSessionError(`Aucune séance trouvée pour le ${dateLabel}. Cette séance n'existe pas ou a été supprimée.`);
      return;
    }

    // Succès - fermer le modal et afficher les résultats
    setFilteredSessionsSearch(results);
    setShowSearchSession(false);
    setSearchSessionMonth('');
    setSearchSessionDay('');
  };

  // Fonction pour réinitialiser la recherche de séances
  const resetSessionSearch = () => {
    setFilteredSessionsSearch(null);
    setSearchSessionMonth('');
    setSearchSessionDay('');
    setSearchSessionError('');
  };

  // Générer la liste des jours pour un mois donné
  const getDaysInMonth = (year, month) => {
    if (!month) return [];
    const daysCount = new Date(year, month, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: TERCIFORM_BLUE }}></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src="https://customer-assets.emergentagent.com/job_f0bae013-d5d3-4906-a078-392b9e03aa37/artifacts/tiidl44l_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png" alt="Terciform" className="h-10" />
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>Espace Administrateur</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
              {/* Boutons d'action dans le header */}
              <div className="flex items-center gap-2 ml-6 pl-6 border-l border-gray-200">
                <Button
                  onClick={() => {
                    setShowPlanning(!showPlanning);
                    setShowBilling(false);
                  }}
                  size="sm"
                  className="inline-flex items-center gap-1.5 bg-blue-800 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-md text-sm"
                >
                  <CalendarDays className="w-4 h-4" />
                  {showPlanning ? 'Retour' : 'Planning'}
                </Button>
                <Button
                  onClick={() => {
                    setShowBilling(!showBilling);
                    setShowPlanning(false);
                  }}
                  size="sm"
                  className="inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white font-medium px-3 py-1.5 rounded-md text-sm"
                >
                  <Euro className="w-4 h-4" />
                  {showBilling ? 'Retour' : 'Facturation'}
                </Button>
                <Button
                  onClick={() => window.location.href = '/qualite/bilan'}
                  size="sm"
                  className="inline-flex items-center gap-1.5 bg-[#2B8A3E] hover:bg-[#237A32] text-white font-medium px-3 py-1.5 rounded-md text-sm"
                >
                  📊 Bilan Qualité
                </Button>
                <Button
                  onClick={() => window.location.href = '/bilan-tests'}
                  size="sm"
                  className="inline-flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6b29d4] text-white font-medium px-3 py-1.5 rounded-md text-sm"
                >
                  📈 Bilan Tests
                </Button>
              </div>
            </div>
            <Button onClick={onLogout} variant="outline" className="gap-2"><LogOut className="w-4 h-4" />Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {showPlanning ? (
          <PlanningView sessions={sessions} onSessionsUpdate={loadSessions} />
        ) : showBilling ? (
          <BillingView sessions={sessions} onSessionsUpdate={loadSessions} />
        ) : (
          <>
          {/* Fond coloré selon l'onglet actif - comme un papier peint */}
          <div 
            className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${
              activeTab === 'sessions' 
                ? 'bg-emerald-300' 
                : activeTab === 'students' 
                  ? 'bg-violet-300' 
                  : 'bg-amber-300'
            }`}
            style={{ top: '72px' }}
          />

          <Tabs defaultValue="sessions" value={activeTab} onValueChange={setActiveTab} className="space-y-6 relative z-10">
          {/* Gros boutons de navigation centrés */}
          <div className="flex justify-center gap-6 mb-8">
            <TabsList className="bg-transparent border-0 shadow-none p-0 h-auto gap-6">
              <TabsTrigger 
                value="sessions" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-emerald-500 data-[state=inactive]:text-white data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <Calendar className="w-5 h-5 mr-3" />
                SÉANCES
              </TabsTrigger>
              <TabsTrigger 
                value="students" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-violet-500 data-[state=inactive]:text-white data-[state=active]:bg-violet-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <Users className="w-5 h-5 mr-3" />
                ÉLÈVES
              </TabsTrigger>
              <TabsTrigger 
                value="formateurs" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-amber-500 data-[state=inactive]:text-white data-[state=active]:bg-amber-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <PenTool className="w-5 h-5 mr-3" />
                FORMATEURS
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Onglet SÉANCES */}
          <TabsContent value="sessions" className="space-y-6">
            {/* Filtres Année et Mois */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Année :</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ color: TERCIFORM_BLUE }}
                >
                  {yearsList.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Mois :</label>
                <select
                  value={selectedMonthNum}
                  onChange={(e) => setSelectedMonthNum(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ color: TERCIFORM_BLUE }}
                >
                  {monthNames.map(m => (
                    <option key={m.num} value={m.num}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="ml-auto text-sm text-gray-500">
                Période : <span className="font-medium" style={{ color: TERCIFORM_BLUE }}>{monthNames.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</span>
              </div>
            </div>

            {/* Statistiques du mois sélectionné */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="card-hover border-2 shadow-md" style={{ borderColor: TERCIFORM_BLUE }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Heures totales du mois</p>
                      <p className="text-xs text-gray-500 mb-2">{monthNames.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</p>
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
                      <p className="text-xs text-gray-500 mb-2">{monthNames.find(m => m.num === selectedMonthNum)?.label} {selectedYear}</p>
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

              {stats && stats.month === selectedMonth && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total des heures réalisées</p><p className="text-3xl font-bold mt-1" style={{ color: TERCIFORM_BLUE }}>{stats.total_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.total_sessions} séance(s)</p></div><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}><Calendar className="w-6 h-6" style={{ color: TERCIFORM_BLUE }} /></div></div></CardContent></Card>
                  <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total des heures confirmées</p><p className="text-3xl font-bold text-green-600 mt-1">{stats.confirmed_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.confirmed_sessions} séance(s)</p></div><div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-600" /></div></div></CardContent></Card>
                  <Card className="card-hover border-0 shadow-md"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total des heures refusées</p><p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected_hours || 0}h</p><p className="text-xs text-gray-500 mt-1">{stats.rejected_sessions} séance(s)</p></div><div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><XCircle className="w-6 h-6 text-red-600" /></div></div></CardContent></Card>
                </div>
              )}

            {/* Bulle Séance du jour - Compacte avec icônes */}
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const todaySessions = sessions.filter(s => s.date === today);
              const todayFormatted = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
              
              // Vérifier s'il y a des séances en visio aujourd'hui
              const hasVisioToday = todaySessions.some(session => 
                session.modality === 'distanciel' || 
                session.meeting_link ||
                session.visio_link
              );
              const visioLinkToday = todaySessions.find(s => s.meeting_link || s.visio_link);
              
              // Icône selon la matière
              const getSubjectIcon = (subject) => {
                const subjectLower = (subject || '').toLowerCase();
                if (subjectLower.includes('anglais')) return '🇬🇧';
                if (subjectLower.includes('informatique') || subjectLower.includes('bureautique')) return '💻';
                if (subjectLower.includes('français')) return '🇫🇷';
                if (subjectLower.includes('math')) return '🔢';
                if (subjectLower.includes('espagnol')) return '🇪🇸';
                if (subjectLower.includes('allemand')) return '🇩🇪';
                return '📚';
              };
              
              return (
                <Card className="border-2 border-red-400 shadow-md bg-gradient-to-r from-red-50 to-orange-50">
                  <CardContent className="py-4 px-5">
                    {/* En-tête compact */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-red-500" />
                        <div>
                          <span className="font-bold text-red-600">Séances du jour</span>
                          <span className="text-xs text-gray-500 ml-2 capitalize">({todayFormatted})</span>
                        </div>
                      </div>
                      {hasVisioToday && visioLinkToday && (
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 text-white gap-1 h-8 text-xs"
                          onClick={() => window.open(visioLinkToday.meeting_link || visioLinkToday.visio_link, '_blank')}
                        >
                          <Video className="w-3 h-3" />
                          Rejoindre
                        </Button>
                      )}
                    </div>
                    
                    {todaySessions.length === 0 ? (
                      <div className="flex items-center gap-3 py-2 text-center justify-center">
                        <span className="text-2xl">🌴</span>
                        <p className="text-sm text-gray-600">Aucune séance aujourd'hui</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {todaySessions.slice(0, 4).map(session => {
                          const student = students.find(st => st.id === session.student_id);
                          const isVisio = session.modality === 'distanciel' || session.meeting_link;
                          
                          return (
                            <div 
                              key={session.id} 
                              className="flex items-center justify-between p-2 rounded bg-white border border-gray-100 text-sm"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-lg">{getSubjectIcon(session.subject)}</span>
                                {isVisio ? (
                                  <Monitor className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                ) : (
                                  <School className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                )}
                                <span className="font-medium truncate">{student?.name || 'Élève'}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 truncate">{session.subject}</span>
                                <span className="text-gray-400 text-xs">({session.start_time}-{session.end_time})</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {session.signature ? (
                                  <span className="text-green-500 text-xs">✓</span>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="h-6 px-2 text-xs text-orange-600 hover:bg-orange-50"
                                    onClick={() => setCurrentSessionToSign(session)}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {todaySessions.length > 4 && (
                          <p className="text-xs text-gray-500 text-center">+{todaySessions.length - 4} autres séances</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Liste des Séances */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Liste des Séances</h2>
              <div className="flex items-center gap-3">
                {/* Bouton pour réinitialiser la recherche si filtre actif */}
                {filteredSessionsSearch !== null && (
                  <Button 
                    onClick={resetSessionSearch}
                    variant="outline"
                    className="gap-2 border-gray-400 text-gray-600 hover:bg-gray-100"
                  >
                    <XCircle className="w-4 h-4" />
                    Afficher toutes les séances
                  </Button>
                )}
                
                {/* Bouton Rechercher une séance */}
                <Dialog open={showSearchSession} onOpenChange={(open) => {
                  setShowSearchSession(open);
                  if (!open) {
                    setSearchSessionMonth('');
                    setSearchSessionDay('');
                    setSearchSessionError('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 text-white" style={{ backgroundColor: '#4A6FA5' }}>
                      <Search className="w-4 h-4" />
                      Rechercher une séance
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" style={{ color: TERCIFORM_BLUE }} />
                        Rechercher une séance
                      </DialogTitle>
                      <DialogDescription>
                        Recherchez par date (année, mois, jour)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Sélecteur Année */}
                      <div className="space-y-2">
                        <Label>Année *</Label>
                        <select
                          value={searchSessionYear}
                          onChange={(e) => setSearchSessionYear(parseInt(e.target.value))}
                          className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                        >
                          {yearsList.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sélecteur Mois */}
                      <div className="space-y-2">
                        <Label>Mois *</Label>
                        <select
                          value={searchSessionMonth}
                          onChange={(e) => {
                            setSearchSessionMonth(e.target.value);
                            setSearchSessionDay(''); // Reset jour quand mois change
                            setSearchSessionError('');
                          }}
                          className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">-- Sélectionner un mois --</option>
                          {monthNames.map(m => (
                            <option key={m.num} value={m.num}>{m.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sélecteur Jour (optionnel) */}
                      <div className="space-y-2">
                        <Label>Jour (optionnel)</Label>
                        <select
                          value={searchSessionDay}
                          onChange={(e) => {
                            setSearchSessionDay(e.target.value);
                            setSearchSessionError('');
                          }}
                          className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                          disabled={!searchSessionMonth}
                        >
                          <option value="">-- Tous les jours du mois --</option>
                          {getDaysInMonth(searchSessionYear, parseInt(searchSessionMonth)).map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500">
                          💡 Laissez vide pour afficher toutes les séances du mois
                        </p>
                      </div>
                      
                      {searchSessionError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700 flex items-center gap-2">
                            <XCircle className="w-4 h-4 flex-shrink-0" />
                            {searchSessionError}
                          </p>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowSearchSession(false)}
                      >
                        Annuler
                      </Button>
                      <Button 
                        type="button"
                        onClick={handleSearchSession}
                        style={{ backgroundColor: TERCIFORM_BLUE }}
                        className="text-white gap-2"
                      >
                        <Search className="w-4 h-4" />
                        Soumettre
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Bouton Créer une séance */}
                <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 text-white" style={{ backgroundColor: TERCIFORM_BLUE }}><Plus className="w-4 h-4" />Créer une séance</Button>
                  </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Créer des séances</DialogTitle><DialogDescription>Créer une ou plusieurs séances pour un élève</DialogDescription></DialogHeader>
                  <form onSubmit={handleCreateMultiSessions} className="space-y-4">
                    {/* Sélection multi-élèves */}
                    <div className="space-y-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-bold">Élèves * ({selectedStudents.length} sélectionné(s))</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={selectAllStudents}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            Tout sélectionner
                          </Button>
                          <Button
                            type="button"
                            onClick={deselectAllStudents}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            Tout désélectionner
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-white rounded border">
                        {students.map(student => (
                          <div
                            key={student.id}
                            onClick={() => toggleStudentSelection(student.id)}
                            className={`
                              p-3 rounded cursor-pointer border-2 transition-all
                              ${selectedStudents.includes(student.id)
                                ? 'bg-blue-100 border-blue-500 font-bold'
                                : 'bg-white border-gray-300 hover:border-blue-300'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedStudents.includes(student.id)}
                                onChange={() => {}}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">{student.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 italic">
                        💡 Cliquez sur les élèves pour créer les mêmes séances pour plusieurs élèves
                      </p>
                    </div>

                    {/* Liste des séances à créer */}
                    {selectedStudents.length > 0 && (
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

                            {/* Créneaux horaires */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="font-semibold">Créneaux horaires</Label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addTimeSlot(index)}
                                  className="text-xs"
                                >
                                  + Ajouter un créneau
                                </Button>
                              </div>
                              
                              {session.time_slots.map((slot, slotIndex) => (
                                <div key={slotIndex} className="flex items-end gap-2 p-3 bg-gray-50 rounded-md border">
                                  <div className="flex-1 space-y-2">
                                    <Label className="text-xs">Début</Label>
                                    <Input
                                      type="time"
                                      value={slot.start_time}
                                      onChange={(e) => updateTimeSlot(index, slotIndex, 'start_time', e.target.value)}
                                      required
                                    />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <Label className="text-xs">Fin</Label>
                                    <Input
                                      type="time"
                                      value={slot.end_time}
                                      onChange={(e) => updateTimeSlot(index, slotIndex, 'end_time', e.target.value)}
                                      required
                                    />
                                  </div>
                                  {session.time_slots.length > 1 && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => removeTimeSlot(index, slotIndex)}
                                      className="mb-0.5"
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  )}
                                </div>
                              ))}
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
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Modifier la Séance</DialogTitle><DialogDescription>Modifier les informations de la séance</DialogDescription></DialogHeader>
                  <form onSubmit={handleUpdateSession} className="space-y-4">
                    <div className="space-y-2"><Label>Matière</Label><Input placeholder="ex: Anglais" value={sessionForm.subject} onChange={(e) => setSessionForm({ ...sessionForm, subject: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} required /></div>
                    
                    {/* Créneaux horaires multiples */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Créneaux horaires</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addEditSessionTimeSlot}
                          className="text-xs"
                          style={{color: TERCIFORM_BLUE, borderColor: TERCIFORM_BLUE}}
                        >
                          + Ajouter un créneau
                        </Button>
                      </div>
                      
                      {sessionForm.time_slots && sessionForm.time_slots.map((slot, index) => (
                        <div key={index} className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                          <div className="flex-1 space-y-2">
                            <Label className="text-sm font-medium">Heure début</Label>
                            <Input
                              type="time"
                              value={slot.start_time}
                              onChange={(e) => updateEditSessionTimeSlot(index, 'start_time', e.target.value)}
                              required
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label className="text-sm font-medium">Heure fin</Label>
                            <Input
                              type="time"
                              value={slot.end_time}
                              onChange={(e) => updateEditSessionTimeSlot(index, 'end_time', e.target.value)}
                              required
                            />
                          </div>
                          {sessionForm.time_slots.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => removeEditSessionTimeSlot(index)}
                              className="mb-0.5"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      ))}
                      
                      {sessionForm.time_slots && sessionForm.time_slots.length > 1 && (
                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-300">
                          <p className="text-sm text-yellow-800">
                            ⚠️ <strong>Attention :</strong> La séance actuelle sera supprimée et {sessionForm.time_slots.length} nouvelles séances seront créées avec les créneaux horaires définis.
                          </p>
                        </div>
                      )}
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
            </div>

            {/* Indicateur de recherche active */}
            {filteredSessionsSearch !== null && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-emerald-700 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="font-medium">{filteredSessionsSearch.length} séance(s) trouvée(s)</span> pour votre recherche
                </p>
              </div>
            )}

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
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-1">
                              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(group.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{group.start_time} - {group.end_time} ({group.duration_hours}h)</span>
                              {/* Bouton Visio pour toute la séance - affiché uniquement pour le distanciel */}
                              {group.sessions[0]?.modality === 'distanciel' && (
                                <a
                                  href={generateJitsiLink(group.sessions[0])}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-white transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                  style={{ 
                                    backgroundColor: '#E91E63',
                                    boxShadow: '0 4px 14px 0 rgba(233, 30, 99, 0.39)'
                                  }}
                                >
                                  <Video className="w-4 h-4" />
                                  Rejoindre la visio
                                </a>
                              )}
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
                                
                                {/* Menu Actions compact */}
                                <div className="flex justify-end mt-3 gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="gap-2"
                                        style={{ borderColor: TERCIFORM_BLUE, color: TERCIFORM_BLUE }}
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                        Actions
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                      <DropdownMenuItem 
                                        onClick={() => handleResendEmail(session.id)}
                                        className="cursor-pointer"
                                      >
                                        <Mail className="w-4 h-4 mr-2 text-blue-600" />
                                        Renvoyer confirmation
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleResendAttendanceEmail(session.id)}
                                        className="cursor-pointer"
                                      >
                                        <PenTool className="w-4 h-4 mr-2 text-orange-600" />
                                        Renvoyer émargement élève
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => openTeacherSignatureDialog(session)}
                                        className="cursor-pointer"
                                      >
                                        <PenTool className="w-4 h-4 mr-2 rotate-180" style={{ color: '#6B2E6F' }} />
                                        Émargement professeur
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handleEditSession(session)}
                                        className="cursor-pointer"
                                      >
                                        <Edit className="w-4 h-4 mr-2 text-green-600" />
                                        Modifier
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteSession(session.id)}
                                        className="cursor-pointer text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
            <div className="flex justify-end items-center gap-3">
              {/* Bouton pour réinitialiser la recherche si filtre actif */}
              {filteredStudents !== null && (
                <Button 
                  onClick={resetStudentSearch}
                  variant="outline"
                  className="gap-2 border-gray-400 text-gray-600 hover:bg-gray-100"
                >
                  <XCircle className="w-4 h-4" />
                  Afficher tous les élèves ({students.length})
                </Button>
              )}
              
              {/* Bouton Rechercher un élève */}
              <Dialog open={showSearchStudent} onOpenChange={(open) => {
                setShowSearchStudent(open);
                if (!open) {
                  setSearchQuery('');
                  setSearchError('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 text-white" style={{ backgroundColor: '#4A6FA5' }}>
                    <Search className="w-4 h-4" />
                    Rechercher un élève
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Search className="w-5 h-5" style={{ color: TERCIFORM_BLUE }} />
                      Rechercher un élève
                    </DialogTitle>
                    <DialogDescription>
                      Recherchez par nom, prénom ou numéro de téléphone
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nom, prénom ou téléphone</Label>
                      <Input 
                        placeholder="ex: Cédric, Dupont, 0612345678..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setSearchError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchStudent();
                          }
                        }}
                        autoFocus
                      />
                      <p className="text-xs text-gray-500">
                        💡 La recherche fonctionne avec ou sans accents (Cédric = Cedric)
                      </p>
                    </div>
                    
                    {searchError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700 flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          {searchError}
                        </p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowSearchStudent(false)}
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="button"
                      onClick={handleSearchStudent}
                      style={{ backgroundColor: TERCIFORM_BLUE }}
                      className="text-white gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Soumettre
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Bouton Ajouter un élève */}
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
                      <Label>Parcours / Matière *</Label>
                      <select 
                        value={studentForm.parcours} 
                        onChange={(e) => setStudentForm({ ...studentForm, parcours: e.target.value })} 
                        className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="Anglais">Anglais</option>
                        <option value="Management">Management</option>
                        <option value="Bureautique">Bureautique</option>
                        <option value="Informatique">Informatique</option>
                      </select>
                    </div>
                    <div className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50 space-y-3">
                      <h4 className="font-bold text-indigo-900">👤 Assigner un formateur</h4>
                      
                      {/* Dropdown historique des formateurs */}
                      {teacherHistory.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-indigo-700">📋 Sélectionner depuis l'historique</Label>
                          <select 
                            className="w-full border rounded-md p-2 text-sm bg-white"
                            onChange={(e) => {
                              const teacher = teacherHistory.find(t => t.key === e.target.value);
                              if (teacher) applyTeacherFromHistory(teacher);
                            }}
                            value=""
                          >
                            <option value="">-- Choisir un formateur existant --</option>
                            {teacherHistory.map(t => (
                              <option key={t.key} value={t.key}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Sélection photo de profil */}
                      <div className="space-y-2">
                        <Label>Photo de profil</Label>
                        <div className="grid grid-cols-3 gap-3">
                          <div 
                            className={`cursor-pointer border-2 rounded-lg p-3 text-center ${studentForm.teacher_profile_picture_type === 'homme' ? 'border-indigo-500 bg-indigo-100' : 'border-gray-300'}`}
                            onClick={() => setStudentForm({ ...studentForm, teacher_profile_picture_type: 'homme', teacher_profile_picture: '/api/profile-pictures/homme_default.png' })}
                          >
                            <img src={`${process.env.REACT_APP_BACKEND_URL}/api/profile-pictures/homme_default.png`} alt="Homme" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                            <p className="text-xs">Homme</p>
                          </div>
                          <div 
                            className={`cursor-pointer border-2 rounded-lg p-3 text-center ${studentForm.teacher_profile_picture_type === 'femme' ? 'border-indigo-500 bg-indigo-100' : 'border-gray-300'}`}
                            onClick={() => setStudentForm({ ...studentForm, teacher_profile_picture_type: 'femme', teacher_profile_picture: '/api/profile-pictures/femme_default.png' })}
                          >
                            <img src={`${process.env.REACT_APP_BACKEND_URL}/api/profile-pictures/femme_default.png`} alt="Femme" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                            <p className="text-xs">Femme</p>
                          </div>
                          <div 
                            className={`cursor-pointer border-2 rounded-lg p-3 text-center ${studentForm.teacher_profile_picture_type === 'custom' ? 'border-indigo-500 bg-indigo-100' : 'border-gray-300'}`}
                          >
                            <label className="cursor-pointer">
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    
                                    try {
                                      const token = localStorage.getItem('token');
                                      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/upload-profile-picture`, formData, {
                                        headers: { 
                                          'Authorization': `Bearer ${token}`,
                                          'Content-Type': 'multipart/form-data'
                                        }
                                      });
                                      setStudentForm({ 
                                        ...studentForm, 
                                        teacher_profile_picture_type: 'custom', 
                                        teacher_profile_picture: response.data.url 
                                      });
                                    } catch (error) {
                                      alert('Erreur lors de l\'upload de l\'image');
                                    }
                                  }
                                }}
                              />
                              {studentForm.teacher_profile_picture_type === 'custom' && studentForm.teacher_profile_picture && studentForm.teacher_profile_picture !== '/api/profile-pictures/homme_default.png' ? (
                                <img src={`${process.env.REACT_APP_BACKEND_URL}${studentForm.teacher_profile_picture}`} alt="Personnalisée" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                              ) : (
                                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-2xl">📷</span>
                                </div>
                              )}
                              <p className="text-xs">Photo personnelle</p>
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Nom du formateur</Label>
                        <Input 
                          placeholder="ex: M. Dupont, Mme Martin" 
                          value={studentForm.teacher_name} 
                          onChange={(e) => setStudentForm({ ...studentForm, teacher_name: e.target.value })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email du formateur</Label>
                        <Input 
                          type="email"
                          placeholder="ex: formateur@email.com" 
                          value={studentForm.teacher_email} 
                          onChange={(e) => setStudentForm({ ...studentForm, teacher_email: e.target.value })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Numéro de téléphone du formateur</Label>
                        <Input 
                          placeholder="ex: 06 12 34 56 78" 
                          value={studentForm.teacher_phone} 
                          onChange={(e) => setStudentForm({ ...studentForm, teacher_phone: e.target.value })} 
                        />
                      </div>
                    </div>
                    {/* BLOC 1 : Tests de parcours */}
                    <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50 space-y-3">
                      <h4 className="font-bold text-blue-900">🟦 Tests de parcours</h4>
                      <p className="text-sm text-gray-700">Souhaitez-vous introduire les tests du parcours « {studentForm.parcours} » ?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeTests" checked={includeTests === true} onChange={() => setIncludeTests(true)} />
                          <span>Oui</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeTests" checked={includeTests === false} onChange={() => setIncludeTests(false)} />
                          <span>Non</span>
                        </label>
                      </div>
                      
                      {includeTests && (
                        <div className="space-y-3 mt-3 pl-4 border-l-4 border-blue-300">
                          <div className="space-y-2">
                            <Label className="text-sm">T1 - Test de positionnement</Label>
                            <select 
                              value={selectedTests.positionnement}
                              onChange={(e) => setSelectedTests({...selectedTests, positionnement: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {testModels[studentForm.parcours]?.positionnement.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">T2 - Test à mi parcours</Label>
                            <select 
                              value={selectedTests.miParcours}
                              onChange={(e) => setSelectedTests({...selectedTests, miParcours: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {testModels[studentForm.parcours]?.miParcours.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">T3 - Test de fin de formation</Label>
                            <select 
                              value={selectedTests.fin}
                              onChange={(e) => setSelectedTests({...selectedTests, fin: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {testModels[studentForm.parcours]?.fin.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BLOC 2 : Questionnaires Qualiopi */}
                    <div className="p-4 border-2 border-yellow-200 rounded-lg bg-yellow-50 space-y-3">
                      <h4 className="font-bold text-yellow-900">🟨 Questionnaires de besoin en formation (Qualiopi)</h4>
                      <p className="text-sm text-gray-700">Souhaitez-vous introduire les questionnaires de besoin en formation pour le parcours « {studentForm.parcours} » ?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeQuestionnaires" checked={includeQuestionnaires === true} onChange={() => setIncludeQuestionnaires(true)} />
                          <span>Oui</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeQuestionnaires" checked={includeQuestionnaires === false} onChange={() => setIncludeQuestionnaires(false)} />
                          <span>Non</span>
                        </label>
                      </div>
                      
                      {includeQuestionnaires && (
                        <div className="space-y-3 mt-3 pl-4 border-l-4 border-yellow-300">
                          <div className="space-y-2">
                            <Label className="text-sm">Questionnaire de besoin en formation "{studentForm.parcours}" (avant formation)</Label>
                            <select 
                              value={selectedQuestionnaires.q1}
                              onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, q1: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {questionnaireModels[studentForm.parcours]?.q1.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Questionnaire à mi-parcours "{studentForm.parcours}"</Label>
                            <select 
                              value={selectedQuestionnaires.q2}
                              onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, q2: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {questionnaireModels[studentForm.parcours]?.q2.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Questionnaire de fin de formation "{studentForm.parcours}"</Label>
                            <select 
                              value={selectedQuestionnaires.q3}
                              onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, q3: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {questionnaireModels[studentForm.parcours]?.q3.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
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
                    
                    {/* Champs d'adresse si Présentiel */}
                    {studentForm.session_type === "présentiel" && (
                      <div className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50 space-y-3">
                        <h4 className="font-bold text-purple-900">📍 Adresse de la formation</h4>
                        
                        
                        {/* Dropdown historique des lieux */}
                        {locationHistory.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-purple-700">📋 Sélectionner depuis l'historique</Label>
                            <select 
                              className="w-full border rounded-md p-2 text-sm bg-white"
                              onChange={(e) => {
                                const location = locationHistory.find(l => l.key === e.target.value);
                                if (location) applyLocationFromHistory(location);
                              }}
                              value=""
                            >
                              <option value="">-- Choisir un lieu existant --</option>
                              {locationHistory.map(l => (
                                <option key={l.key} value={l.key}>{l.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2 col-span-2">
                            <Label>Établissement / Bâtiment</Label>
                            <Input 
                              placeholder="Ex: Campus Emergent - Bâtiment A" 
                              value={studentForm.formation_building} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_building: e.target.value })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>N° de rue</Label>
                            <Input 
                              placeholder="10" 
                              value={studentForm.formation_street_number} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_street_number: e.target.value })} 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2 col-span-2">
                            <Label>Rue</Label>
                            <Input 
                              placeholder="Rue de la Paix" 
                              value={studentForm.formation_street} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_street: e.target.value })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Code postal</Label>
                            <Input 
                              placeholder="75002" 
                              value={studentForm.formation_postal_code} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_postal_code: e.target.value })} 
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Ville</Label>
                          <Input 
                            placeholder="Paris" 
                            value={studentForm.formation_city} 
                            onChange={(e) => setStudentForm({ ...studentForm, formation_city: e.target.value })} 
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Transports à proximité (optionnel)</Label>
                          <textarea 
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="Ex: Métro Ligne 4 – Porte de Clignancourt (5 min à pied)"
                            rows={2}
                            value={studentForm.formation_transports} 
                            onChange={(e) => setStudentForm({ ...studentForm, formation_transports: e.target.value })} 
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Date d'entrée</Label><Input type="date" value={studentForm.start_date} onChange={(e) => setStudentForm({ ...studentForm, start_date: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Date de sortie</Label><Input type="date" value={studentForm.end_date} onChange={(e) => setStudentForm({ ...studentForm, end_date: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label>Heures totales</Label><Input type="number" step="0.5" min="0" placeholder="ex: 20" value={studentForm.total_hours} onChange={(e) => setStudentForm({ ...studentForm, total_hours: parseFloat(e.target.value) || 0 })} /></div>
                    
                    {/* Boutons : Créer + Ajouter un autre */}
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1 text-white" style={{ backgroundColor: TERCIFORM_BLUE }}>
                        Créer l'élève
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        className="flex-1 border-green-500 text-green-700 hover:bg-green-50"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsMultiMode(true);
                          // Soumettre le formulaire via ref
                          e.target.form?.requestSubmit();
                        }}
                      >
                        ➕ Créer et ajouter un autre
                      </Button>
                    </div>
                    
                    {/* Liste des élèves créés en mode multi */}
                    {multiStudents.length > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium mb-2">✅ {multiStudents.length} élève(s) créé(s) :</p>
                        <ul className="text-xs text-green-700 space-y-1">
                          {multiStudents.map((s, i) => (
                            <li key={i}>• {s.name} ({s.email})</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                      <Label>Parcours / Matière *</Label>
                      <select 
                        value={studentForm.parcours} 
                        onChange={(e) => setStudentForm({ ...studentForm, parcours: e.target.value })} 
                        className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        <option value="Anglais">Anglais</option>
                        <option value="Management">Management</option>
                        <option value="Bureautique">Bureautique</option>
                        <option value="Informatique">Informatique</option>
                      </select>
                    </div>
                    <div className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50 space-y-3">
                      <h4 className="font-bold text-indigo-900">👤 Assigner un formateur</h4>
                      
                      {/* Dropdown historique des formateurs */}
                      {teacherHistory.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-indigo-700">📋 Sélectionner depuis l'historique</Label>
                          <select 
                            className="w-full border rounded-md p-2 text-sm bg-white"
                            onChange={(e) => {
                              const teacher = teacherHistory.find(t => t.key === e.target.value);
                              if (teacher) applyTeacherFromHistory(teacher);
                            }}
                            value=""
                          >
                            <option value="">-- Choisir un formateur existant --</option>
                            {teacherHistory.map(t => (
                              <option key={t.key} value={t.key}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Sélection photo de profil */}
                      <div className="space-y-2">
                        <Label>Photo de profil</Label>
                        <div className="grid grid-cols-3 gap-3">
                          <div 
                            className={`cursor-pointer border-2 rounded-lg p-3 text-center ${studentForm.teacher_profile_picture_type === 'homme' ? 'border-indigo-500 bg-indigo-100' : 'border-gray-300'}`}
                            onClick={() => setStudentForm({ ...studentForm, teacher_profile_picture_type: 'homme', teacher_profile_picture: '/api/profile-pictures/homme_default.png' })}
                          >
                            <img src={`${process.env.REACT_APP_BACKEND_URL}/api/profile-pictures/homme_default.png`} alt="Homme" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                            <p className="text-xs">Homme</p>
                          </div>
                          <div 
                            className={`cursor-pointer border-2 rounded-lg p-3 text-center ${studentForm.teacher_profile_picture_type === 'femme' ? 'border-indigo-500 bg-indigo-100' : 'border-gray-300'}`}
                            onClick={() => setStudentForm({ ...studentForm, teacher_profile_picture_type: 'femme', teacher_profile_picture: '/api/profile-pictures/femme_default.png' })}
                          >
                            <img src={`${process.env.REACT_APP_BACKEND_URL}/api/profile-pictures/femme_default.png`} alt="Femme" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                            <p className="text-xs">Femme</p>
                          </div>
                          <div 
                            className={`cursor-pointer border-2 rounded-lg p-3 text-center ${studentForm.teacher_profile_picture_type === 'custom' ? 'border-indigo-500 bg-indigo-100' : 'border-gray-300'}`}
                          >
                            <label className="cursor-pointer">
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    
                                    try {
                                      const token = localStorage.getItem('token');
                                      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/upload-profile-picture`, formData, {
                                        headers: { 
                                          'Authorization': `Bearer ${token}`,
                                          'Content-Type': 'multipart/form-data'
                                        }
                                      });
                                      setStudentForm({ 
                                        ...studentForm, 
                                        teacher_profile_picture_type: 'custom', 
                                        teacher_profile_picture: response.data.url 
                                      });
                                    } catch (error) {
                                      alert('Erreur lors de l\'upload de l\'image');
                                    }
                                  }
                                }}
                              />
                              {studentForm.teacher_profile_picture_type === 'custom' && studentForm.teacher_profile_picture && studentForm.teacher_profile_picture !== '/api/profile-pictures/homme_default.png' ? (
                                <img src={`${process.env.REACT_APP_BACKEND_URL}${studentForm.teacher_profile_picture}`} alt="Personnalisée" className="w-16 h-16 mx-auto mb-2 rounded-full object-cover" />
                              ) : (
                                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-2xl">📷</span>
                                </div>
                              )}
                              <p className="text-xs">Photo personnelle</p>
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Nom du formateur</Label>
                        <Input 
                          placeholder="ex: M. Dupont, Mme Martin" 
                          value={studentForm.teacher_name} 
                          onChange={(e) => setStudentForm({ ...studentForm, teacher_name: e.target.value })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email du formateur</Label>
                        <Input 
                          type="email"
                          placeholder="ex: formateur@email.com" 
                          value={studentForm.teacher_email} 
                          onChange={(e) => setStudentForm({ ...studentForm, teacher_email: e.target.value })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Numéro de téléphone du formateur</Label>
                        <Input 
                          placeholder="ex: 06 12 34 56 78" 
                          value={studentForm.teacher_phone} 
                          onChange={(e) => setStudentForm({ ...studentForm, teacher_phone: e.target.value })} 
                        />
                      </div>
                    </div>
                    {/* BLOC 1 : Tests de parcours */}
                    <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50 space-y-3">
                      <h4 className="font-bold text-blue-900">🟦 Tests de parcours</h4>
                      <p className="text-sm text-gray-700">Souhaitez-vous introduire les tests du parcours « {studentForm.parcours} » ?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeTests" checked={includeTests === true} onChange={() => setIncludeTests(true)} />
                          <span>Oui</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeTests" checked={includeTests === false} onChange={() => setIncludeTests(false)} />
                          <span>Non</span>
                        </label>
                      </div>
                      
                      {includeTests && (
                        <div className="space-y-3 mt-3 pl-4 border-l-4 border-blue-300">
                          <div className="space-y-2">
                            <Label className="text-sm">T1 - Test de positionnement</Label>
                            <select 
                              value={selectedTests.positionnement}
                              onChange={(e) => setSelectedTests({...selectedTests, positionnement: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {testModels[studentForm.parcours]?.positionnement.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">T2 - Test à mi parcours</Label>
                            <select 
                              value={selectedTests.miParcours}
                              onChange={(e) => setSelectedTests({...selectedTests, miParcours: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {testModels[studentForm.parcours]?.miParcours.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">T3 - Test de fin de formation</Label>
                            <select 
                              value={selectedTests.fin}
                              onChange={(e) => setSelectedTests({...selectedTests, fin: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {testModels[studentForm.parcours]?.fin.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BLOC 2 : Questionnaires Qualiopi */}
                    <div className="p-4 border-2 border-yellow-200 rounded-lg bg-yellow-50 space-y-3">
                      <h4 className="font-bold text-yellow-900">🟨 Questionnaires de besoin en formation (Qualiopi)</h4>
                      <p className="text-sm text-gray-700">Souhaitez-vous introduire les questionnaires de besoin en formation pour le parcours « {studentForm.parcours} » ?</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeQuestionnaires" checked={includeQuestionnaires === true} onChange={() => setIncludeQuestionnaires(true)} />
                          <span>Oui</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="includeQuestionnaires" checked={includeQuestionnaires === false} onChange={() => setIncludeQuestionnaires(false)} />
                          <span>Non</span>
                        </label>
                      </div>
                      
                      {includeQuestionnaires && (
                        <div className="space-y-3 mt-3 pl-4 border-l-4 border-yellow-300">
                          <div className="space-y-2">
                            <Label className="text-sm">Questionnaire de besoin en formation "{studentForm.parcours}" (avant formation)</Label>
                            <select 
                              value={selectedQuestionnaires.q1}
                              onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, q1: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {questionnaireModels[studentForm.parcours]?.q1.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Questionnaire à mi-parcours "{studentForm.parcours}"</Label>
                            <select 
                              value={selectedQuestionnaires.q2}
                              onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, q2: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {questionnaireModels[studentForm.parcours]?.q2.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Questionnaire de fin de formation "{studentForm.parcours}"</Label>
                            <select 
                              value={selectedQuestionnaires.q3}
                              onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, q3: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Choisir un modèle --</option>
                              {questionnaireModels[studentForm.parcours]?.q3.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
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
                    
                    {/* Champs d'adresse si Présentiel */}
                    {studentForm.session_type === "présentiel" && (
                      <div className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50 space-y-3">
                        <h4 className="font-bold text-purple-900">📍 Adresse de la formation</h4>
                        
                        {/* Dropdown historique des lieux */}
                        {locationHistory.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-purple-700">📋 Sélectionner depuis l'historique</Label>
                            <select 
                              className="w-full border rounded-md p-2 text-sm bg-white"
                              onChange={(e) => {
                                const location = locationHistory.find(l => l.key === e.target.value);
                                if (location) applyLocationFromHistory(location);
                              }}
                              value=""
                            >
                              <option value="">-- Choisir un lieu existant --</option>
                              {locationHistory.map(l => (
                                <option key={l.key} value={l.key}>{l.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2 col-span-2">
                            <Label>Établissement / Bâtiment</Label>
                            <Input 
                              placeholder="Ex: Campus Emergent - Bâtiment A" 
                              value={studentForm.formation_building} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_building: e.target.value })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>N° de rue</Label>
                            <Input 
                              placeholder="10" 
                              value={studentForm.formation_street_number} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_street_number: e.target.value })} 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2 col-span-2">
                            <Label>Rue</Label>
                            <Input 
                              placeholder="Rue de la Paix" 
                              value={studentForm.formation_street} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_street: e.target.value })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Code postal</Label>
                            <Input 
                              placeholder="75002" 
                              value={studentForm.formation_postal_code} 
                              onChange={(e) => setStudentForm({ ...studentForm, formation_postal_code: e.target.value })} 
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Ville</Label>
                          <Input 
                            placeholder="Paris" 
                            value={studentForm.formation_city} 
                            onChange={(e) => setStudentForm({ ...studentForm, formation_city: e.target.value })} 
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Transports à proximité (optionnel)</Label>
                          <textarea 
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="Ex: Métro Ligne 4 – Porte de Clignancourt (5 min à pied)"
                            rows={2}
                            value={studentForm.formation_transports} 
                            onChange={(e) => setStudentForm({ ...studentForm, formation_transports: e.target.value })} 
                          />
                        </div>
                      </div>
                    )}
                    
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

            {/* Indicateur de recherche active */}
            {filteredStudents !== null && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="font-medium">{filteredStudents.length} élève(s) trouvé(s)</span> pour votre recherche
                </p>
              </div>
            )}

            <div className="grid gap-4">
              {(filteredStudents !== null ? filteredStudents : students).length === 0 ? (
                <Card className="border-0 shadow-md"><CardContent className="pt-6 text-center text-gray-500">Aucun élève enregistré</CardContent></Card>
              ) : (
                (filteredStudents !== null ? filteredStudents : students).map(student => {
                  // Récupérer TOUTES les séances de l'élève
                  const allStudentSessions = sessions
                    .filter(s => s.student_id === student.id)
                    .sort((a, b) => new Date(a.date) - new Date(b.date)); // Ordre chronologique (plus ancien au plus récent)
                  
                  // Grouper les séances par mois
                  const sessionsByMonth = {};
                  allStudentSessions.forEach(session => {
                    const monthKey = session.date.substring(0, 7); // "YYYY-MM"
                    if (!sessionsByMonth[monthKey]) {
                      sessionsByMonth[monthKey] = [];
                    }
                    sessionsByMonth[monthKey].push(session);
                  });
                  
                  // Trier les mois chronologiquement
                  const sortedMonths = Object.keys(sessionsByMonth).sort();
                  
                  // Formater le nom du mois
                  const formatMonthLabel = (monthKey) => {
                    const [year, month] = monthKey.split('-');
                    const monthName = monthNames.find(m => m.num === parseInt(month))?.label || month;
                    return `${monthName} ${year}`;
                  };
                  
                  // Déterminer si une séance est à venir
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  return (
                    <Card key={student.id} className="shadow-md card-hover border-2" style={{ borderColor: TERCIFORM_BLUE }}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                                {student.parcours && (
                                  <span 
                                    className="px-3 py-1 rounded-full text-sm font-bold"
                                    style={{
                                      backgroundColor: 
                                        student.parcours === 'Anglais' ? '#FFE4F0' :
                                        student.parcours === 'Bureautique' ? '#D1FAE5' :
                                        student.parcours === 'Management' ? '#DBEAFE' :
                                        student.parcours === 'Informatique' ? '#F3E8FF' :
                                        '#F3F4F6',
                                      color: 
                                        student.parcours === 'Anglais' ? '#DB2777' :
                                        student.parcours === 'Bureautique' ? '#059669' :
                                        student.parcours === 'Management' ? '#2563EB' :
                                        student.parcours === 'Informatique' ? '#9333EA' :
                                        '#6B7280'
                                    }}
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
                              {/* Bouton Historique */}
                              <Button 
                                onClick={() => handleOpenStudentHistory(student.id, student.name)} 
                                size="sm" 
                                className="w-full py-3 rounded-md flex items-center justify-start gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700"
                              >
                                <FileText className="w-5 h-5 text-gray-700" />
                                <span className="font-medium">Historique</span>
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
                          {sortedMonths.length > 0 && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Historique des séances</h4>
                              <div className="space-y-4">
                                {sortedMonths.map(monthKey => {
                                  const monthSessions = sessionsByMonth[monthKey];
                                  return (
                                    <div key={monthKey} className="space-y-2">
                                      {/* En-tête du mois */}
                                      <div className="flex items-center gap-2 py-2 px-3 bg-violet-100 rounded-lg">
                                        <Calendar className="w-4 h-4 text-violet-600" />
                                        <span className="font-bold text-violet-800">{formatMonthLabel(monthKey)}</span>
                                        <span className="text-sm text-violet-600">({monthSessions.length} séance{monthSessions.length > 1 ? 's' : ''})</span>
                                      </div>
                                      {/* Séances du mois */}
                                      {monthSessions.map(session => {
                                        const sessionDate = new Date(session.date);
                                        sessionDate.setHours(0, 0, 0, 0);
                                        const isFuture = sessionDate > today;
                                        
                                        return (
                                          <div key={session.id} className={`flex items-center justify-between text-sm py-3 px-4 rounded-lg ${isFuture ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                                            <div className="flex items-center gap-3 flex-1 flex-wrap">
                                              {isFuture && <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">À VENIR</span>}
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
                                        );
                                      })}
                                    </div>
                                  );
                                })}
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

          {/* Onglet Formateurs (vide pour le moment) */}
          <TabsContent value="formateurs" className="space-y-6">
            {/* Bouton créer un formateur */}
            <div className="flex justify-end">
              <Button 
                className="gap-2 text-white"
                style={{ backgroundColor: TERCIFORM_BLUE }}
              >
                <Plus className="w-4 h-4" />
                Créer un nouveau formateur
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mb-6">
                <PenTool className="w-12 h-12 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Espace Formateur</h2>
              <p className="text-gray-500 text-center max-w-md">
                Cette section sera bientôt disponible.
              </p>
            </div>
          </TabsContent>
          </Tabs>
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
                <div className="flex gap-2">
                  <select 
                    className="flex-1 px-3 py-2 border rounded-md"
                    value={attendanceMonth ? attendanceMonth.split('-')[0] : selectedYear}
                    onChange={(e) => {
                      const year = e.target.value;
                      const month = attendanceMonth ? attendanceMonth.split('-')[1] : '01';
                      setAttendanceMonth(`${year}-${month}`);
                    }}
                  >
                    {yearsList.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select 
                    className="flex-1 px-3 py-2 border rounded-md"
                    value={attendanceMonth ? parseInt(attendanceMonth.split('-')[1]) : 1}
                    onChange={(e) => {
                      const month = e.target.value.toString().padStart(2, '0');
                      const year = attendanceMonth ? attendanceMonth.split('-')[0] : selectedYear;
                      setAttendanceMonth(`${year}-${month}`);
                    }}
                  >
                    {monthNames.map(m => (
                      <option key={m.num} value={m.num}>{m.label}</option>
                    ))}
                  </select>
                </div>
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


      {/* Dialog Modifier horaires */}
      <Dialog open={showEditTimesDialog} onOpenChange={setShowEditTimesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>
              Modifier les horaires - {editingSession?.student_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Infos de la séance */}
            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-semibold">Matière :</span> {editingSession?.subject}
                </div>
                <div>
                  <span className="font-semibold">Date :</span> {editingSession?.date ? new Date(editingSession.date).toLocaleDateString('fr-FR') : ''}
                </div>
                <div>
                  <span className="font-semibold">Élève :</span> {editingSession?.student_name}
                </div>
                <div>
                  <span className="font-semibold">Modalité :</span> {editingSession?.modality}
                </div>
              </div>
            </div>

            {/* Créneaux horaires */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Créneaux horaires</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addEditTimeSlot}
                  className="text-xs"
                  style={{color: TERCIFORM_BLUE, borderColor: TERCIFORM_BLUE}}
                >
                  + Ajouter un créneau
                </Button>
              </div>
              
              {editTimeSlots.map((slot, index) => (
                <div key={index} className="flex items-end gap-2 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-medium">Heure de début</Label>
                    <Input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => updateEditTimeSlot(index, 'start_time', e.target.value)}
                      required
                      className="text-base"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-medium">Heure de fin</Label>
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateEditTimeSlot(index, 'end_time', e.target.value)}
                      required
                      className="text-base"
                    />
                  </div>
                  {editTimeSlots.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removeEditTimeSlot(index)}
                      className="mb-0.5"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {editTimeSlots.length > 1 && (
              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-300">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Attention :</strong> La séance actuelle sera supprimée et {editTimeSlots.length} nouvelles séances seront créées pour cet élève avec les créneaux horaires définis.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditTimesDialog(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSaveEditTimes}
              style={{backgroundColor: TERCIFORM_BLUE}}
              className="text-white"
            >
              <Clock className="w-4 h-4 mr-2" />
              Enregistrer les horaires
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog Historique Élève */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{color: TERCIFORM_BLUE}}>
              📋 Historique de {historyStudent?.name}
            </DialogTitle>
            <DialogDescription>
              Traçabilité complète de toutes les actions et événements
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{borderColor: TERCIFORM_BLUE}}></div>
                  <p className="text-gray-600">Chargement de l'historique...</p>
                </div>
              </div>
            ) : studentHistory.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Aucun événement enregistré pour cet élève</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Timeline */}
                <div className="relative">
                  {/* Ligne verticale de la timeline */}
                  <div className="absolute left-[21px] top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  
                  {studentHistory.map((event, index) => {
                    // Définir les couleurs et icônes selon le type d'événement
                    let bgColor = 'bg-blue-100';
                    let borderColor = 'border-blue-400';
                    let textColor = 'text-blue-800';
                    let icon = '📄';
                    
                    if (event.type === 'connection' || event.type === 'login') {
                      bgColor = 'bg-green-100';
                      borderColor = 'border-green-400';
                      textColor = 'text-green-800';
                      icon = '🔐';
                    } else if (event.type === 'signature' || event.type === 'signed') {
                      bgColor = 'bg-purple-100';
                      borderColor = 'border-purple-400';
                      textColor = 'text-purple-800';
                      icon = '✍️';
                    } else if (event.type === 'email' || event.type === 'notification') {
                      bgColor = 'bg-yellow-100';
                      borderColor = 'border-yellow-400';
                      textColor = 'text-yellow-800';
                      icon = '📧';
                    } else if (event.type === 'session' || event.type === 'attendance') {
                      bgColor = 'bg-indigo-100';
                      borderColor = 'border-indigo-400';
                      textColor = 'text-indigo-800';
                      icon = '📚';
                    } else if (event.type === 'request' || event.type === 'demand') {
                      bgColor = 'bg-orange-100';
                      borderColor = 'border-orange-400';
                      textColor = 'text-orange-800';
                      icon = '📝';
                    } else if (event.type === 'document') {
                      bgColor = 'bg-pink-100';
                      borderColor = 'border-pink-400';
                      textColor = 'text-pink-800';
                      icon = '📎';
                    }

                    const eventDate = new Date(event.timestamp);
                    const formattedDate = eventDate.toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });
                    const formattedTime = eventDate.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div key={index} className="relative flex gap-4 pb-6">
                        {/* Point sur la timeline */}
                        <div className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-full ${bgColor} border-4 ${borderColor} flex items-center justify-center text-xl shadow-sm`}>
                          {icon}
                        </div>
                        
                        {/* Contenu de l'événement */}
                        <div className="flex-1 bg-white rounded-lg border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
                                  {event.category || 'Général'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formattedDate} à {formattedTime}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900 mb-1">
                                {event.title}
                              </p>
                              {event.description && (
                                <p className="text-sm text-gray-600">
                                  {event.description}
                                </p>
                              )}
                              {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(event.metadata).map(([key, value]) => (
                                      <span key={key} className="text-xs text-gray-500">
                                        <strong>{key}:</strong> {String(value)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setShowHistoryDialog(false)}
            >
              Fermer
            </Button>
            <Button
              style={{backgroundColor: TERCIFORM_BLUE}}
              className="text-white"
              onClick={() => {
                // Export CSV ou PDF de l'historique
                toast.info('Export de l\'historique - Fonctionnalité à venir');
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
          </DialogFooter>
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
