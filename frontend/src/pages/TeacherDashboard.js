import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Plus, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Mail, Edit, PenTool, FileText, FileCheck, CalendarDays, Euro, FolderOpen, Download, MoreVertical, Video, Search, Monitor, School, Smile, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone, Award, Upload, X, Building, MessageSquare, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import PlanningView from "@/components/PlanningView";
import BillingView from "@/components/BillingView";
import ParcoursEleveModal from "@/components/ParcoursEleveModal";
import TicketingModal from "@/components/TicketingModal";

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

  // States pour la gestion des formateurs
  const [showCreateFormateurDialog, setShowCreateFormateurDialog] = useState(false);
  const [showEditFormateurDialog, setShowEditFormateurDialog] = useState(false);
  const [showFormateurPlanningDialog, setShowFormateurPlanningDialog] = useState(false);
  const [editingFormateur, setEditingFormateur] = useState(null);
  const [selectedFormateurForPlanning, setSelectedFormateurForPlanning] = useState(null);
  const [formateurPlanningMonth, setFormateurPlanningMonth] = useState(new Date().getMonth() + 1);
  const [formateurPlanningYear, setFormateurPlanningYear] = useState(new Date().getFullYear());
  const [formateurs, setFormateurs] = useState([]);
  const [formateurSearchQuery, setFormateurSearchQuery] = useState('');
  const [formateurForm, setFormateurForm] = useState({
    photo: null,
    photoPreview: null,
    nom: '',
    prenom: '',
    societe: '',
    email: '',
    telephone: '',
    siret: '',
    nda: '',
    matieres: [''],
    cv: null,
    cvName: '',
    diplome1: null,
    diplome1Name: '',
    diplome2: null,
    diplome2Name: ''
  });
  const [loadingFormateurs, setLoadingFormateurs] = useState(false);

  // ===== STATES POUR LES CLIENTS (CRM) =====
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showCreateClientDialog, setShowCreateClientDialog] = useState(false);
  const [showEditClientDialog, setShowEditClientDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClientData, setNewClientData] = useState({
    nom_centre: '',
    adresse_siege: '',
    telephone_siege: '',
    siret: '',
    nom_responsable: '',
    email_responsable: '',
    nom_gestionnaire: '',
    email_gestionnaire: '',
    password: '',
    photo: null,
    photoName: '',
    formateur_id: ''
  });
  const [showClientHistoryDialog, setShowClientHistoryDialog] = useState(false);
  const [showClientActionsDialog, setShowClientActionsDialog] = useState(false);
  const [clientActionsTab, setClientActionsTab] = useState('salles'); // 'salles' ou 'facturation'
  
  // États pour les notifications de tickets non lus
  const [unreadTicketCounts, setUnreadTicketCounts] = useState({});
  
  // États pour les demandes de salle
  const [roomRequests, setRoomRequests] = useState([]);
  const [loadingRoomRequests, setLoadingRoomRequests] = useState(false);
  const [showRoomRequestForm, setShowRoomRequestForm] = useState(false);
  const [roomRequestFormData, setRoomRequestFormData] = useState([
    { date: '', start_time: '', end_time: '', location_name: '', location_address: '', num_learners: 1 }
  ]);
  const [locationsHistory, setLocationsHistory] = useState([]);
  const [sendRoomRequestTo, setSendRoomRequestTo] = useState('gestionnaire');
  const [submittingRoomRequest, setSubmittingRoomRequest] = useState(false);

  // Liste des mois pour le planning formateur
  const MOIS_NOMS = [
    { num: 1, label: 'Janvier' }, { num: 2, label: 'Février' }, { num: 3, label: 'Mars' },
    { num: 4, label: 'Avril' }, { num: 5, label: 'Mai' }, { num: 6, label: 'Juin' },
    { num: 7, label: 'Juillet' }, { num: 8, label: 'Août' }, { num: 9, label: 'Septembre' },
    { num: 10, label: 'Octobre' }, { num: 11, label: 'Novembre' }, { num: 12, label: 'Décembre' }
  ];

  // Filtrer les formateurs par recherche
  const filteredFormateurs = useMemo(() => {
    if (!formateurSearchQuery.trim()) return formateurs;
    const query = formateurSearchQuery.toLowerCase().trim();
    return formateurs.filter(f => {
      const nomComplet = `${f.prenom} ${f.nom}`.toLowerCase();
      const matieresStr = (f.matieres || []).join(' ').toLowerCase();
      return nomComplet.includes(query) || matieresStr.includes(query) || 
             f.email?.toLowerCase().includes(query) || 
             f.societe?.toLowerCase().includes(query);
    });
  }, [formateurs, formateurSearchQuery]);

  // Filtrer les clients par recherche
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const query = clientSearchQuery.toLowerCase().trim();
    return clients.filter(c => {
      return c.nom_centre?.toLowerCase().includes(query) || 
             c.nom_responsable?.toLowerCase().includes(query) ||
             c.nom_gestionnaire?.toLowerCase().includes(query) ||
             c.email_responsable?.toLowerCase().includes(query) ||
             c.siret?.toLowerCase().includes(query);
    });
  }, [clients, clientSearchQuery]);

  // Helper pour construire l'URL complète des fichiers formateur
  const getFormateurFileUrl = (path) => {
    if (!path) return null;
    // Si c'est déjà une URL complète, la retourner
    if (path.startsWith('http')) return path;
    // Sinon, préfixer avec BACKEND_URL
    return `${BACKEND_URL}${path}`;
  };

  // Helper pour obtenir l'URL de photo d'un formateur via l'API
  const getFormateurPhotoUrl = (formateurId) => {
    return `${API}/formateurs/${formateurId}/photo`;
  };

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

  // Fonctions de navigation pour attendanceMonth (Facturation)
  const goToPreviousAttendanceMonth = () => {
    if (!attendanceMonth) {
      const now = new Date();
      setAttendanceMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      return;
    }
    const [year, month] = attendanceMonth.split('-').map(Number);
    if (month === 1) {
      setAttendanceMonth(`${year - 1}-12`);
    } else {
      setAttendanceMonth(`${year}-${String(month - 1).padStart(2, '0')}`);
    }
  };

  const goToNextAttendanceMonth = () => {
    if (!attendanceMonth) {
      const now = new Date();
      setAttendanceMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      return;
    }
    const [year, month] = attendanceMonth.split('-').map(Number);
    if (month === 12) {
      setAttendanceMonth(`${year + 1}-01`);
    } else {
      setAttendanceMonth(`${year}-${String(month + 1).padStart(2, '0')}`);
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
  // Pour les séances de groupe (même date/heure/matière), le lien sera identique
  const generateJitsiLink = (session) => {
    // Créer un nom de salle basé sur la date, l'heure et la matière
    // Cela permet à tous les élèves d'une même séance de groupe d'avoir le même lien
    const dateStr = (session.date || '').replace(/-/g, '');
    const timeStr = (session.start_time || '').replace(':', '');
    const subjectClean = (session.subject || 'cours')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15);
    
    const roomName = `terciform-${dateStr}-${timeStr}-${subjectClean}`;
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

  // ============================================================================
  // Fonctions de gestion des FORMATEURS
  // ============================================================================

  // Charger les formateurs
  const loadFormateurs = async () => {
    setLoadingFormateurs(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/formateurs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFormateurs(response.data || []);
    } catch (error) {
      console.error('Erreur chargement formateurs:', error);
      // Ne pas afficher d'erreur si endpoint n'existe pas encore
    } finally {
      setLoadingFormateurs(false);
    }
  };

  // ===== FONCTIONS CLIENTS (CRM) =====
  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/clients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const clientsData = response.data || [];
      setClients(clientsData);
      
      // Charger les compteurs de tickets non lus pour chaque client
      loadUnreadTicketCounts(clientsData);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  // Charger les compteurs de tickets non lus
  const loadUnreadTicketCounts = async (clientsList) => {
    try {
      const token = localStorage.getItem('token');
      const counts = {};
      
      for (const client of clientsList) {
        try {
          const response = await axios.get(`${API}/tickets/unread-count/${client.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          counts[client.id] = response.data.unread_count || 0;
        } catch (err) {
          counts[client.id] = 0;
        }
      }
      
      setUnreadTicketCounts(counts);
    } catch (error) {
      console.error('Erreur chargement compteurs tickets:', error);
    }
  };

  // Marquer les tickets comme lus quand on ouvre le ticketing
  const markTicketsAsRead = async (clientId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/tickets/mark-read/${clientId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Mettre à jour le compteur local
      setUnreadTicketCounts(prev => ({
        ...prev,
        [clientId]: 0
      }));
    } catch (error) {
      console.error('Erreur marquage tickets lus:', error);
    }
  };

  const resetClientForm = () => {
    setNewClientData({
      nom_centre: '',
      adresse_siege: '',
      telephone_siege: '',
      siret: '',
      nom_responsable: '',
      email_responsable: '',
      nom_gestionnaire: '',
      email_gestionnaire: '',
      password: '',
      photo: null,
      photoName: '',
      formateur_id: ''
    });
  };

  const handleCreateClient = async () => {
    if (!newClientData.nom_centre.trim()) {
      toast.error('Le nom du centre est obligatoire');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('nom_centre', newClientData.nom_centre);
      formData.append('adresse_siege', newClientData.adresse_siege);
      formData.append('telephone_siege', newClientData.telephone_siege);
      formData.append('siret', newClientData.siret);
      formData.append('nom_responsable', newClientData.nom_responsable);
      formData.append('email_responsable', newClientData.email_responsable);
      formData.append('nom_gestionnaire', newClientData.nom_gestionnaire);
      formData.append('email_gestionnaire', newClientData.email_gestionnaire);
      formData.append('password', newClientData.password);
      formData.append('formateur_id', newClientData.formateur_id);
      
      if (newClientData.photo) {
        formData.append('photo', newClientData.photo);
      }

      const response = await axios.post(`${API}/clients`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });

      // Afficher un message adapté si des emails ont été envoyés
      const emailsSent = response.data?.emails_sent || [];
      if (emailsSent.length > 0) {
        toast.success(`Client créé ! Emails de bienvenue envoyés à: ${emailsSent.join(', ')}`);
      } else {
        toast.success('Client créé avec succès');
      }
      setShowCreateClientDialog(false);
      resetClientForm();
      loadClients();
    } catch (error) {
      console.error('Erreur création client:', error);
      toast.error('Erreur lors de la création du client');
    }
  };

  const handleEditClient = async () => {
    if (!selectedClient || !newClientData.nom_centre.trim()) {
      toast.error('Le nom du centre est obligatoire');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('nom_centre', newClientData.nom_centre);
      formData.append('adresse_siege', newClientData.adresse_siege);
      formData.append('telephone_siege', newClientData.telephone_siege);
      formData.append('siret', newClientData.siret);
      formData.append('nom_responsable', newClientData.nom_responsable);
      formData.append('email_responsable', newClientData.email_responsable);
      formData.append('nom_gestionnaire', newClientData.nom_gestionnaire);
      formData.append('email_gestionnaire', newClientData.email_gestionnaire);
      
      if (newClientData.photo) {
        formData.append('photo', newClientData.photo);
      }

      await axios.put(`${API}/clients/${selectedClient.id}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });

      toast.success('Client modifié avec succès');
      setShowEditClientDialog(false);
      setSelectedClient(null);
      resetClientForm();
      loadClients();
    } catch (error) {
      console.error('Erreur modification client:', error);
      toast.error('Erreur lors de la modification du client');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Client supprimé avec succès');
      loadClients();
    } catch (error) {
      console.error('Erreur suppression client:', error);
      toast.error('Erreur lors de la suppression du client');
    }
  };

  const openEditClientDialog = (client) => {
    setSelectedClient(client);
    setNewClientData({
      nom_centre: client.nom_centre || '',
      adresse_siege: client.adresse_siege || '',
      telephone_siege: client.telephone_siege || '',
      siret: client.siret || '',
      nom_responsable: client.nom_responsable || '',
      email_responsable: client.email_responsable || '',
      nom_gestionnaire: client.nom_gestionnaire || '',
      email_gestionnaire: client.email_gestionnaire || '',
      photo: null,
      photoName: ''
    });
    setShowEditClientDialog(true);
  };

  // ===== FONCTIONS DEMANDES DE SALLE =====
  const loadRoomRequests = async (clientId) => {
    setLoadingRoomRequests(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/clients/${clientId}/room-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoomRequests(response.data || []);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoadingRoomRequests(false);
    }
  };

  const loadLocationsHistory = async (clientId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/clients/${clientId}/locations-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLocationsHistory(response.data || []);
    } catch (error) {
      console.error('Erreur chargement historique lieux:', error);
    }
  };

  const addRoomRequestLine = () => {
    setRoomRequestFormData([
      ...roomRequestFormData,
      { date: '', start_time: '', end_time: '', location_name: '', location_address: '', num_learners: 1 }
    ]);
  };

  const removeRoomRequestLine = (index) => {
    if (roomRequestFormData.length > 1) {
      setRoomRequestFormData(roomRequestFormData.filter((_, i) => i !== index));
    }
  };

  const updateRoomRequestLine = (index, field, value) => {
    const updated = [...roomRequestFormData];
    updated[index][field] = value;
    
    // Si on sélectionne un lieu de l'historique, remplir l'adresse automatiquement
    if (field === 'location_name') {
      const found = locationsHistory.find(l => l.name === value);
      if (found) {
        updated[index]['location_address'] = found.address;
      }
    }
    
    setRoomRequestFormData(updated);
  };

  const submitRoomRequests = async () => {
    if (!selectedClient) return;
    
    // Valider les données
    const validRequests = roomRequestFormData.filter(r => 
      r.date && r.start_time && r.end_time && r.location_name && r.num_learners > 0
    );
    
    if (validRequests.length === 0) {
      toast.error('Veuillez remplir au moins une demande complète');
      return;
    }
    
    // Vérifier que le destinataire a un email
    const recipientEmail = sendRoomRequestTo === 'responsable' 
      ? selectedClient.email_responsable 
      : selectedClient.email_gestionnaire;
    
    if (!recipientEmail) {
      toast.error(`Pas d'email ${sendRoomRequestTo} pour ce client`);
      return;
    }
    
    setSubmittingRoomRequest(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/clients/${selectedClient.id}/room-requests`, {
        requests: validRequests,
        send_to: sendRoomRequestTo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Demande envoyée à ${recipientEmail}`);
      setShowRoomRequestForm(false);
      setRoomRequestFormData([{ date: '', start_time: '', end_time: '', location_name: '', location_address: '', num_learners: 1 }]);
      loadRoomRequests(selectedClient.id);
      loadLocationsHistory(selectedClient.id); // Rafraîchir l'historique des lieux
    } catch (error) {
      console.error('Erreur envoi demande:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi de la demande');
    } finally {
      setSubmittingRoomRequest(false);
    }
  };

  // Helper pour formater une date en français avec horodatage complet
  const formatDateTimeFr = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                         'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const dayName = dayNames[date.getDay()];
      const day = date.getDate();
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${dayName} ${day} ${month} ${year} à ${hours}h${minutes}`;
    } catch {
      return dateStr;
    }
  };

  // Charger les demandes quand on ouvre le dialog Actions
  useEffect(() => {
    if (showClientActionsDialog && selectedClient) {
      loadRoomRequests(selectedClient.id);
      loadLocationsHistory(selectedClient.id);
    }
  }, [showClientActionsDialog, selectedClient]);

  // Charger les formateurs au montage
  useEffect(() => {
    loadFormateurs();
  }, []);

  // Charger les clients au montage
  useEffect(() => {
    loadClients();
  }, []);

  // Réinitialiser le formulaire formateur
  const resetFormateurForm = () => {
    setFormateurForm({
      photo: null,
      photoPreview: null,
      nom: '',
      prenom: '',
      societe: '',
      email: '',
      telephone: '',
      siret: '',
      nda: '',
      matieres: [''],
      cv: null,
      cvName: '',
      diplome1: null,
      diplome1Name: '',
      diplome2: null,
      diplome2Name: ''
    });
  };

  // Gérer les changements de champs
  const handleFormateurChange = (field, value) => {
    // Gérer les uploads de fichiers
    if (field === 'photo' && value instanceof File) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormateurForm(prev => ({
          ...prev,
          photo: value,
          photoPreview: event.target.result
        }));
      };
      reader.readAsDataURL(value);
      return;
    }
    
    if (field === 'cv' && value instanceof File) {
      setFormateurForm(prev => ({
        ...prev,
        cv: value,
        cvName: value.name
      }));
      return;
    }
    
    if (field === 'diplome1' && value instanceof File) {
      setFormateurForm(prev => ({
        ...prev,
        diplome1: value,
        diplome1Name: value.name
      }));
      return;
    }
    
    if (field === 'diplome2' && value instanceof File) {
      setFormateurForm(prev => ({
        ...prev,
        diplome2: value,
        diplome2Name: value.name
      }));
      return;
    }
    
    setFormateurForm(prev => ({ ...prev, [field]: value }));
  };

  // Gérer la photo de profil
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormateurForm(prev => ({
          ...prev,
          photo: file,
          photoPreview: event.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Gérer les fichiers (CV, diplômes)
  const handleFileChange = (field, nameField, e) => {
    const file = e.target.files[0];
    if (file) {
      setFormateurForm(prev => ({
        ...prev,
        [field]: file,
        [nameField]: file.name
      }));
    }
  };

  // Ajouter une matière pour formateur
  const addMatiereFormateur = () => {
    setFormateurForm(prev => ({
      ...prev,
      matieres: [...prev.matieres, '']
    }));
  };

  // Supprimer une matière pour formateur
  const removeMatiereFormateur = (index) => {
    if (formateurForm.matieres.length > 1) {
      setFormateurForm(prev => ({
        ...prev,
        matieres: prev.matieres.filter((_, i) => i !== index)
      }));
    }
  };

  // Modifier une matière pour formateur
  const updateMatiereFormateur = (index, value) => {
    setFormateurForm(prev => ({
      ...prev,
      matieres: prev.matieres.map((m, i) => i === index ? value : m)
    }));
  };

  // Créer un formateur
  const handleCreateFormateur = async () => {
    // Validation
    if (!formateurForm.nom || !formateurForm.prenom || !formateurForm.email) {
      toast.error('Veuillez remplir au moins le nom, prénom et email');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Créer un FormData pour les fichiers
      const formData = new FormData();
      formData.append('nom', formateurForm.nom);
      formData.append('prenom', formateurForm.prenom);
      formData.append('societe', formateurForm.societe || '');
      formData.append('email', formateurForm.email);
      formData.append('telephone', formateurForm.telephone || '');
      formData.append('siret', formateurForm.siret || '');
      formData.append('nda', formateurForm.nda || '');
      formData.append('matieres', JSON.stringify(formateurForm.matieres.filter(m => m.trim())));
      
      if (formateurForm.photo) {
        formData.append('photo', formateurForm.photo);
      }
      if (formateurForm.cv) {
        formData.append('cv', formateurForm.cv);
      }
      if (formateurForm.diplome1) {
        formData.append('diplome1', formateurForm.diplome1);
      }
      if (formateurForm.diplome2) {
        formData.append('diplome2', formateurForm.diplome2);
      }

      const response = await axios.post(`${API}/formateurs`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`
          // Ne PAS définir Content-Type - axios le fait automatiquement avec le bon boundary
        }
      });

      toast.success('Formateur créé avec succès !');
      setShowCreateFormateurDialog(false);
      resetFormateurForm();
      loadFormateurs();
    } catch (error) {
      console.error('Erreur création formateur:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la création du formateur');
    }
  };

  // Supprimer un formateur
  const handleDeleteFormateur = async (formateurId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce formateur ?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/formateurs/${formateurId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Formateur supprimé avec succès');
      loadFormateurs();
    } catch (error) {
      console.error('Erreur suppression formateur:', error);
      toast.error('Erreur lors de la suppression du formateur');
    }
  };

  // Ouvrir le dialog d'édition d'un formateur
  const openEditFormateurDialog = (formateur) => {
    setEditingFormateur(formateur);
    setFormateurForm({
      photo: null,
      photoPreview: formateur.photo_url ? getFormateurPhotoUrl(formateur.id) : null,
      nom: formateur.nom || '',
      prenom: formateur.prenom || '',
      societe: formateur.societe || '',
      email: formateur.email || '',
      telephone: formateur.telephone || '',
      siret: formateur.siret || '',
      nda: formateur.nda || '',
      matieres: formateur.matieres?.length > 0 ? formateur.matieres : [''],
      cv: null,
      cvName: formateur.cv_url ? 'CV existant' : '',
      diplome1: null,
      diplome1Name: formateur.diplome1_url ? 'Diplôme 1 existant' : '',
      diplome2: null,
      diplome2Name: formateur.diplome2_url ? 'Diplôme 2 existant' : ''
    });
    setShowEditFormateurDialog(true);
  };

  // Mettre à jour un formateur
  const handleUpdateFormateur = async () => {
    if (!editingFormateur) return;
    
    if (!formateurForm.nom || !formateurForm.prenom || !formateurForm.email) {
      toast.error('Veuillez remplir au moins le nom, prénom et email');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('nom', formateurForm.nom);
      formData.append('prenom', formateurForm.prenom);
      formData.append('societe', formateurForm.societe || '');
      formData.append('email', formateurForm.email);
      formData.append('telephone', formateurForm.telephone || '');
      formData.append('siret', formateurForm.siret || '');
      formData.append('nda', formateurForm.nda || '');
      formData.append('matieres', JSON.stringify(formateurForm.matieres.filter(m => m.trim())));
      
      // Ajouter les fichiers seulement s'ils ont été modifiés
      if (formateurForm.photo) {
        formData.append('photo', formateurForm.photo);
      }
      if (formateurForm.cv) {
        formData.append('cv', formateurForm.cv);
      }
      if (formateurForm.diplome1) {
        formData.append('diplome1', formateurForm.diplome1);
      }
      if (formateurForm.diplome2) {
        formData.append('diplome2', formateurForm.diplome2);
      }

      await axios.patch(`${API}/formateurs/${editingFormateur.id}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });

      toast.success('Formateur mis à jour avec succès !');
      setShowEditFormateurDialog(false);
      setEditingFormateur(null);
      resetFormateurForm();
      loadFormateurs();
    } catch (error) {
      console.error('Erreur mise à jour formateur:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  // Ouvrir le planning d'un formateur
  const openFormateurPlanningDialog = (formateur) => {
    setSelectedFormateurForPlanning(formateur);
    setFormateurPlanningMonth(new Date().getMonth() + 1);
    setFormateurPlanningYear(new Date().getFullYear());
    setShowFormateurPlanningDialog(true);
  };

  // Obtenir les sessions d'un formateur pour un mois donné
  const getFormateurSessions = useMemo(() => {
    if (!selectedFormateurForPlanning) return [];
    
    // Construire le nom complet du formateur pour la comparaison
    const formateurFullName = `${selectedFormateurForPlanning.prenom} ${selectedFormateurForPlanning.nom}`.toLowerCase();
    
    return sessions.filter(session => {
      // Vérifier si le formateur est assigné à cette session
      const teacherName = (session.teacher_name || '').toLowerCase().trim();
      
      // Comparaison exacte ou partielle
      if (teacherName !== formateurFullName && 
          !teacherName.includes(selectedFormateurForPlanning.prenom?.toLowerCase()) &&
          !teacherName.includes(selectedFormateurForPlanning.nom?.toLowerCase())) {
        return false;
      }
      
      // Filtrer par mois et année
      const sessionDate = new Date(session.date);
      return sessionDate.getMonth() + 1 === formateurPlanningMonth && 
             sessionDate.getFullYear() === formateurPlanningYear;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedFormateurForPlanning, sessions, formateurPlanningMonth, formateurPlanningYear]);

  // Générer les jours du mois pour le planning formateur
  const getFormateurCalendarDays = useMemo(() => {
    const year = formateurPlanningYear;
    const month = formateurPlanningMonth - 1; // JavaScript months are 0-indexed
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Jour de la semaine du premier jour (0 = Dimanche, 1 = Lundi, etc.)
    let startDay = firstDay.getDay();
    if (startDay === 0) startDay = 7; // Convertir dimanche de 0 à 7
    
    const days = [];
    
    // Ajouter les jours vides avant le premier du mois
    for (let i = 1; i < startDay; i++) {
      days.push({ day: null, sessions: [] });
    }
    
    // Ajouter les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daySessions = getFormateurSessions.filter(s => s.date === dateStr);
      days.push({ day, date: dateStr, sessions: daySessions });
    }
    
    return days;
  }, [formateurPlanningYear, formateurPlanningMonth, getFormateurSessions]);

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
  const [historyCategory, setHistoryCategory] = useState('all'); // Catégorie sélectionnée
  const [historyStudent, setHistoryStudent] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fonction pour ouvrir l'historique d'un élève
  const handleOpenStudentHistory = async (studentId, studentName) => {
    setHistoryStudent({ id: studentId, name: studentName });
    setShowHistoryDialog(true);
    setLoadingHistory(true);
    
    try {
      const token = localStorage.getItem('token');
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
      // NE PAS envoyer credit_hours lors de la mise à jour - préserver les heures restantes existantes
      // credit_hours est calculé automatiquement en fonction des séances
      delete updateData.credit_hours;
      await axios.put(`${API}/students/${editingStudent.id}`, updateData);
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

  // Liste des élèves actifs (avec heures restantes > 0)
  // Les élèves à 0 heures sont "historisés" : masqués de la liste mais consultables via recherche
  // Exception: Laura Lenfant est toujours historisée
  const activeStudents = useMemo(() => {
    return students.filter(student => {
      const remainingHours = student.credit_hours || 0;
      // Exception spécifique pour Laura Lenfant (toujours historisée)
      const studentName = `${student.name || ''} ${student.last_name || ''}`.toLowerCase();
      if (studentName.includes('laura') && studentName.includes('lenfant')) {
        return false; // Toujours historisée
      }
      return remainingHours > 0;
    });
  }, [students]);

  // Liste des élèves historisés (pour le modal)
  const archivedStudents = useMemo(() => {
    return students.filter(student => {
      const remainingHours = student.credit_hours || 0;
      const studentName = `${student.name || ''} ${student.last_name || ''}`.toLowerCase();
      // Historisé si 0h restantes OU si c'est Laura Lenfant
      if (studentName.includes('laura') && studentName.includes('lenfant')) {
        return true;
      }
      return remainingHours <= 0;
    }).map(student => {
      // Trouver la dernière séance signée pour avoir la date de sortie
      const studentSessions = sessions
        .filter(s => s.student_id === student.id && s.signature_status === 'signed')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastSession = studentSessions[0];
      return {
        ...student,
        exit_date: lastSession?.date || null,
        exit_month: lastSession?.date?.substring(0, 7) || null
      };
    });
  }, [students, sessions]);

  // State pour le modal des sorties de parcours
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedMonthFilter, setArchivedMonthFilter] = useState('');
  const [showExitBanner, setShowExitBanner] = useState(false);
  const [exitYearFilter, setExitYearFilter] = useState('');
  const [exitMonthFilter, setExitMonthFilter] = useState('');
  const [exitSearchQuery, setExitSearchQuery] = useState('');
  const [exportingArchivedPdf, setExportingArchivedPdf] = useState(false);
  const [showTicketingModal, setShowTicketingModal] = useState(false);
  const [ticketingClient, setTicketingClient] = useState(null);

  // Liste des mois disponibles pour le filtre
  const availableExitMonths = useMemo(() => {
    const months = [...new Set(archivedStudents.map(s => s.exit_month).filter(Boolean))];
    return months.sort().reverse();
  }, [archivedStudents]);

  // Élèves historisés filtrés par mois
  const filteredArchivedStudents = useMemo(() => {
    if (!archivedMonthFilter) return archivedStudents;
    return archivedStudents.filter(s => s.exit_month === archivedMonthFilter);
  }, [archivedStudents, archivedMonthFilter]);

  // Années disponibles pour le filtre sorties de parcours
  const availableExitYears = useMemo(() => {
    const years = [...new Set(archivedStudents.map(s => s.exit_date ? s.exit_date.substring(0, 4) : null).filter(Boolean))];
    return years.sort().reverse();
  }, [archivedStudents]);

  // Mois disponibles pour le filtre (selon l'année sélectionnée)
  const availableExitMonthsForBanner = useMemo(() => {
    let filtered = archivedStudents;
    if (exitYearFilter) {
      filtered = filtered.filter(s => s.exit_date && s.exit_date.startsWith(exitYearFilter));
    }
    const months = [...new Set(filtered.map(s => s.exit_date ? s.exit_date.substring(5, 7) : null).filter(Boolean))];
    return months.sort();
  }, [archivedStudents, exitYearFilter]);

  // Filtre des sorties de parcours par année, mois et recherche
  const filteredExitStudents = useMemo(() => {
    let result = archivedStudents;
    if (exitYearFilter) {
      result = result.filter(s => s.exit_date && s.exit_date.startsWith(exitYearFilter));
    }
    if (exitMonthFilter) {
      result = result.filter(s => s.exit_date && s.exit_date.substring(5, 7) === exitMonthFilter);
    }
    if (exitSearchQuery.trim()) {
      const query = exitSearchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      result = result.filter(s => {
        const fullName = `${s.name || ''} ${s.last_name || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return fullName.includes(query);
      });
    }
    return result;
  }, [archivedStudents, exitYearFilter, exitMonthFilter, exitSearchQuery]);

  // Export PDF des sorties de parcours
  const handleExportArchivedPdf = async () => {
    setExportingArchivedPdf(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/students/archived/export-pdf`, {
        month_filter: archivedMonthFilter || null,
        students: filteredArchivedStudents.map(s => ({
          id: s.id,
          name: s.name,
          last_name: s.last_name,
          organism: s.organism,
          email: s.email,
          total_hours: s.total_hours,
          credit_hours: s.credit_hours,
          exit_date: s.exit_date
        }))
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const monthSuffix = archivedMonthFilter ? `_${archivedMonthFilter}` : '';
      link.download = `Sorties_Parcours${monthSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF des sorties de parcours exporté');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setExportingArchivedPdf(false);
    }
  };

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
          <PlanningView sessions={sessions} onSessionsUpdate={loadSessions} onBack={() => setShowPlanning(false)} />
        ) : showBilling ? (
          <BillingView sessions={sessions} onSessionsUpdate={loadSessions} onBack={() => setShowBilling(false)} />
        ) : (
          <>
          {/* Fond coloré selon l'onglet actif - comme un papier peint */}
          <div 
            className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${
              activeTab === 'sessions' 
                ? 'bg-emerald-300' 
                : activeTab === 'students' 
                  ? 'bg-violet-300' 
                  : activeTab === 'formateurs'
                    ? 'bg-amber-300'
                    : 'bg-sky-300'
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
              <TabsTrigger 
                value="clients" 
                className="px-10 py-4 text-lg font-bold uppercase tracking-wide rounded-xl shadow-lg transition-all duration-200 data-[state=active]:scale-105 data-[state=inactive]:opacity-80 data-[state=inactive]:hover:opacity-100 data-[state=inactive]:bg-sky-500 data-[state=inactive]:text-white data-[state=active]:bg-sky-600 data-[state=active]:text-white hover:shadow-xl"
              >
                <Building className="w-5 h-5 mr-3" />
                CLIENTS
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Onglet SÉANCES */}
          <TabsContent value="sessions" className="space-y-6">
            {/* Filtres Année et Mois avec boutons navigation */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              {/* Bouton Mois Précédent */}
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                title="Mois précédent"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              
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
              
              {/* Bouton Mois Suivant */}
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                title="Mois suivant"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              
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
              const todaySessions = sessions
                .filter(s => s.date === today)
                .sort((a, b) => {
                  // Trier par heure de début (start_time)
                  const timeA = a.start_time || '00:00';
                  const timeB = b.start_time || '00:00';
                  return timeA.localeCompare(timeB);
                });
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
            {/* En-tête avec titre et boutons - même style que Clients */}
            <div className="flex items-center justify-between mb-6 p-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Gestion des Élèves</h2>
              <div className="flex gap-3">
                {/* Bouton pour réinitialiser la recherche si filtre actif */}
                {filteredStudents !== null && (
                  <Button 
                    onClick={resetStudentSearch}
                    variant="outline"
                    className="gap-2 border-gray-400 text-gray-600 hover:bg-gray-100"
                  >
                    <XCircle className="w-4 h-4" />
                    Tous ({students.length})
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
                    <button className="flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors">
                      <Search className="w-4 h-4" />
                      Rechercher un élève
                    </button>
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
                  <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-md">
                    <Plus className="w-4 h-4" />
                    Créer un élève
                  </button>
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
              </div>
            </div>

            {/* Dialog Modifier Élève - séparé de l'en-tête */}
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

            {/* Indicateur de recherche active */}
            {filteredStudents !== null && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="font-medium">{filteredStudents.length} élève(s) trouvé(s)</span> pour votre recherche
                  <span className="text-xs text-blue-500">(inclut les élèves historisés)</span>
                </p>
              </div>
            )}

            {/* ===== BANDEAU SORTIES DE PARCOURS ===== */}
            {filteredStudents === null && archivedStudents.length > 0 && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden border border-blue-200">
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
                      <p className="text-sm text-blue-600">{archivedStudents.length} élève(s) ayant terminé leur formation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setShowArchivedModal(true); }}
                      className="border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export PDF
                    </Button>
                    {showExitBanner ? (
                      <ChevronUp className="w-6 h-6 text-blue-600" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
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
                          onChange={(e) => { setExitYearFilter(e.target.value); setExitMonthFilter(''); }}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Toutes</option>
                          {availableExitYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Mois :</label>
                        <select
                          value={exitMonthFilter}
                          onChange={(e) => setExitMonthFilter(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Tous</option>
                          {availableExitMonthsForBanner.map(month => (
                            <option key={month} value={month}>{monthNames[parseInt(month) - 1]?.label || month}</option>
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
                        {filteredExitStudents.length} résultat(s)
                      </span>
                    </div>

                    {/* Liste des sorties */}
                    <div className="max-h-96 overflow-y-auto">
                      {filteredExitStudents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p>Aucun élève trouvé</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {filteredExitStudents.map(student => {
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
                                      {(student.name?.[0] || '').toUpperCase()}{(student.last_name?.[0] || '').toUpperCase()}
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-gray-900">{student.name} {student.last_name}</h4>
                                      <p className="text-sm text-gray-500">{student.organism || 'Sans organisme'}</p>
                                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                        <span><span className="font-medium">{student.total_hours || 0}h</span> réalisées</span>
                                        {student.credit_hours > 0 && (
                                          <span className="text-orange-600"><span className="font-medium">{student.credit_hours}h</span> restantes</span>
                                        )}
                                      </div>
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

            <div className="grid gap-4">
              {(filteredStudents !== null ? filteredStudents : activeStudents).length === 0 ? (
                <Card className="border-0 shadow-md"><CardContent className="pt-6 text-center text-gray-500">{filteredStudents !== null ? "Aucun élève trouvé" : "Aucun élève actif (tous historisés ou aucun élève enregistré)"}</CardContent></Card>
              ) : (
                (filteredStudents !== null ? filteredStudents : activeStudents).map(student => {
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
                                {student.teacher_name && (
                                  <p className="flex items-center gap-1">
                                    <span className="font-medium">Formateur:</span> 
                                    <span className="text-purple-700 font-semibold">{student.teacher_name}</span>
                                  </p>
                                )}
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

          {/* Onglet Formateurs */}
          <TabsContent value="formateurs" className="space-y-6">
            {/* En-tête avec titre et boutons - même style que Clients */}
            <div className="flex items-center justify-between mb-6 p-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Gestion des Formateurs</h2>
              <div className="flex gap-3">
                {/* Recherche */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, matière..."
                    value={formateurSearchQuery}
                    onChange={(e) => setFormateurSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 w-64 bg-amber-50 text-gray-800 placeholder-gray-500"
                  />
                  {formateurSearchQuery && (
                    <button
                      onClick={() => setFormateurSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button 
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-md"
                  onClick={() => setShowCreateFormateurDialog(true)}
                >
                  <Plus className="w-4 h-4" />
                  <Plus className="w-4 h-4" />
                  Créer un formateur
                </button>
              </div>
            </div>

            {/* Indicateur de résultats de recherche */}
            {formateurSearchQuery && (
              <div className="text-sm text-amber-700 bg-amber-100 px-4 py-2 rounded-lg">
                {filteredFormateurs.length} résultat(s) pour "{formateurSearchQuery}"
              </div>
            )}

            {/* Liste des formateurs */}
            {loadingFormateurs ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Chargement des formateurs...</p>
              </div>
            ) : filteredFormateurs.length === 0 ? (
              <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg">
                <PenTool className="w-20 h-20 mx-auto text-amber-300 mb-4" />
                <p className="text-gray-600 text-lg">
                  {formateurSearchQuery ? `Aucun résultat pour "${formateurSearchQuery}"` : 'Aucun formateur enregistré'}
                </p>
                <p className="text-gray-500 mt-2">
                  {formateurSearchQuery 
                    ? 'Essayez avec un autre terme de recherche'
                    : 'Cliquez sur "Créer un formateur" pour commencer'}
                </p>
                {formateurSearchQuery && (
                  <button 
                    onClick={() => setFormateurSearchQuery('')}
                    className="mt-4 text-amber-600 hover:text-amber-700 text-sm"
                  >
                    Effacer la recherche
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Liste des formateurs */}
                {filteredFormateurs.map((formateur) => (
                  <div key={formateur.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow" data-testid={`formateur-card-${formateur.id}`}>
                    {/* En-tête de la fiche */}
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden flex-shrink-0">
                          {formateur.photo_url ? (
                            <img 
                              src={getFormateurPhotoUrl(formateur.id)} 
                              alt={`${formateur.prenom} ${formateur.nom}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full bg-amber-100 items-center justify-center ${formateur.photo_url ? 'hidden' : 'flex'}`}>
                            <span className="text-2xl font-bold text-amber-600">
                              {formateur.prenom?.[0]}{formateur.nom?.[0]}
                            </span>
                          </div>
                        </div>
                        <div className="text-white">
                          <h3 className="text-xl font-bold">{formateur.prenom} {formateur.nom}</h3>
                          {formateur.societe && (
                            <p className="text-amber-100 text-sm">{formateur.societe}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Corps de la fiche */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm truncate">{formateur.email}</span>
                      </div>
                      
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

                      {/* Matières enseignées */}
                      {formateur.matieres && formateur.matieres.length > 0 && formateur.matieres[0] && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">MATIÈRES ENSEIGNÉES</p>
                          <div className="flex flex-wrap gap-1">
                            {formateur.matieres.filter(m => m).map((matiere, idx) => (
                              <span 
                                key={idx}
                                className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium"
                              >
                                {matiere}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documents - Boutons de téléchargement */}
                      {(formateur.cv_url || formateur.diplome1_url || formateur.diplome2_url) && (
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-2">DOCUMENTS</p>
                          <div className="flex flex-wrap gap-2">
                            {formateur.cv_url && (
                              <button 
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  window.open(`${API}/formateurs/${formateur.id}/download/cv?token=${token}`, '_blank');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs hover:bg-blue-200 transition-colors cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                CV
                              </button>
                            )}
                            {formateur.diplome1_url && (
                              <button 
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  window.open(`${API}/formateurs/${formateur.id}/download/diplome1?token=${token}`, '_blank');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs hover:bg-green-200 transition-colors cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                Diplôme 1
                              </button>
                            )}
                            {formateur.diplome2_url && (
                              <button 
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  window.open(`${API}/formateurs/${formateur.id}/download/diplome2?token=${token}`, '_blank');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs hover:bg-green-200 transition-colors cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                Diplôme 2
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Boutons Modifier et Supprimer en bas */}
                      <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                        <button
                          onClick={() => openEditFormateurDialog(formateur)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                          data-testid={`edit-formateur-btn-${formateur.id}`}
                        >
                          <Edit className="w-4 h-4" />
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteFormateur(formateur.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          data-testid={`delete-formateur-btn-${formateur.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== ONGLET CLIENTS (CRM) ===== */}
          <TabsContent value="clients" className="space-y-6">
            {/* En-tête avec titre et boutons */}
            <div className="flex items-center justify-between mb-6 p-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold text-gray-800">Gestion des Clients (CRM)</h2>
              <div className="flex gap-3">
                {/* Barre de recherche */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 w-64 bg-sky-50 text-gray-800 placeholder-gray-500"
                    data-testid="client-search-input"
                  />
                </div>
                {/* Bouton créer un client */}
                <button
                  onClick={() => {
                    resetClientForm();
                    setShowCreateClientDialog(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors shadow-md"
                  data-testid="create-client-btn"
                >
                  <Plus className="w-4 h-4" />
                  Créer un client
                </button>
              </div>
            </div>

            {/* Indicateur de recherche */}
            {clientSearchQuery && (
              <div className="text-sm text-sky-700 bg-sky-100 px-4 py-2 rounded-lg">
                {filteredClients.length} résultat(s) pour "{clientSearchQuery}"
              </div>
            )}

            {/* Liste des clients */}
            {loadingClients ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg">
                <Building className="w-20 h-20 mx-auto text-sky-300 mb-4" />
                <p className="text-gray-600 text-lg">
                  {clientSearchQuery ? 'Aucun client trouvé pour cette recherche' : 'Aucun client enregistré'}
                </p>
                <p className="text-gray-500 mt-2">
                  Cliquez sur "Créer un client" pour ajouter votre premier client
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredClients.map((client) => (
                  <div 
                    key={client.id} 
                    className="flex gap-6 items-stretch"
                    data-testid={`client-row-${client.id}`}
                  >
                    {/* Carte Client */}
                    <div 
                      className="w-[400px] flex-shrink-0 bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow border border-sky-100"
                      data-testid={`client-card-${client.id}`}
                    >
                      {/* En-tête avec photo */}
                      <div className="p-4 flex gap-4">
                        {/* Photo du centre - en haut à gauche */}
                        <div className="w-24 h-24 flex-shrink-0 rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center overflow-hidden">
                          {client.photo_url ? (
                            <img 
                              src={`${API}/clients/${client.id}/photo`} 
                              alt={client.nom_centre}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Building className="w-10 h-10 text-sky-400" />
                          )}
                        </div>
                      </div>
                      
                      {/* Informations du client */}
                      <div className="px-4 pb-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">{client.nom_centre}</h3>
                        
                        {client.adresse_siege && (
                          <p className="text-sm text-gray-600 mb-1 flex items-start gap-2">
                            <span className="text-sky-500 mt-0.5">📍</span>
                            <span>{client.adresse_siege}</span>
                          </p>
                        )}
                        
                        {client.telephone_siege && (
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-sky-500" />
                            <span>{client.telephone_siege}</span>
                          </p>
                        )}
                        
                        {client.siret && (
                          <p className="text-sm text-gray-500 mb-3">
                            <span className="font-medium">SIRET:</span> {client.siret}
                          </p>
                        )}

                        {/* Responsable */}
                        {client.nom_responsable && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Responsable</p>
                            <p className="text-sm font-medium text-gray-700">{client.nom_responsable}</p>
                            {client.email_responsable && (
                              <p className="text-xs text-sky-600">{client.email_responsable}</p>
                            )}
                          </div>
                        )}

                        {/* Gestionnaire */}
                        {client.nom_gestionnaire && (
                          <div className="mt-2">
                            <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Gestionnaire</p>
                            <p className="text-sm font-medium text-gray-700">{client.nom_gestionnaire}</p>
                            {client.email_gestionnaire && (
                              <p className="text-xs text-sky-600">{client.email_gestionnaire}</p>
                            )}
                          </div>
                        )}

                        {/* Boutons d'action */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedClient(client);
                              setShowClientHistoryDialog(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                            data-testid={`history-client-btn-${client.id}`}
                          >
                            <Clock className="w-4 h-4" />
                            Historique
                          </button>
                          <button
                            onClick={() => openEditClientDialog(client)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors"
                            data-testid={`edit-client-btn-${client.id}`}
                          >
                            <Edit className="w-4 h-4" />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                            data-testid={`delete-client-btn-${client.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bandeau d'échange à côté de la carte client */}
                    <div 
                      onClick={() => {
                        setTicketingClient(client);
                        setShowTicketingModal(true);
                        markTicketsAsRead(client.id);
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl hover:scale-[1.01] transition-all flex flex-col justify-between relative"
                      data-testid={`ticketing-banner-${client.id}`}
                    >
                      {/* Puce de notification rouge */}
                      {unreadTicketCounts[client.id] > 0 && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg animate-pulse">
                          {unreadTicketCounts[client.id]}
                        </div>
                      )}
                      
                      <div className="flex flex-col items-center text-center">
                        <div className="p-4 bg-white/20 rounded-xl mb-4 relative">
                          <MessageSquare className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Échanger avec {client.nom_centre}</h3>
                        <p className="text-blue-200 text-sm mb-6">Faites vos demandes à ce centre</p>
                        
                        <div className="flex flex-wrap gap-3 justify-center mb-6">
                          <span className="flex items-center gap-2 text-base font-semibold bg-white/15 px-4 py-2 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-blue-300"></div>
                            Salles
                          </span>
                          <span className="flex items-center gap-2 text-base font-semibold bg-white/15 px-4 py-2 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-orange-300"></div>
                            Matériel
                          </span>
                          <span className="flex items-center gap-2 text-base font-semibold bg-white/15 px-4 py-2 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-purple-300"></div>
                            Supports
                          </span>
                          <span className="flex items-center gap-2 text-base font-semibold bg-white/15 px-4 py-2 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-green-300"></div>
                            Organisation
                          </span>
                          <span className="flex items-center gap-2 text-base font-semibold bg-white/15 px-4 py-2 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-pink-300"></div>
                            Accueil
                          </span>
                          <span className="flex items-center gap-2 text-base font-semibold bg-white/15 px-4 py-2 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                            Email
                          </span>
                        </div>
                      </div>
                      
                      <button className="w-full px-4 py-3 bg-white text-blue-700 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Accéder aux échanges
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
      <Dialog open={showHistoryDialog} onOpenChange={(open) => { setShowHistoryDialog(open); if (!open) setHistoryCategory('all'); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{color: TERCIFORM_BLUE}}>
              📋 Historique de {historyStudent?.name}
            </DialogTitle>
            <DialogDescription>
              Traçabilité complète de toutes les actions et événements (Qualiopi)
            </DialogDescription>
          </DialogHeader>

          {/* Onglets de catégories */}
          {!loadingHistory && studentHistory.length > 0 && (
            <div className="border-b border-gray-200 -mx-6 px-6">
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'Tout', icon: '📋', count: studentHistory.length },
                  { id: 'connection', label: 'Connexions', icon: '🔐', filter: e => e.category === 'Connexion' || e.type === 'connection' || e.type === 'login' },
                  { id: 'visio', label: 'Visio', icon: '📹', filter: e => e.category === 'Visioconférence' || e.type === 'visio' || e.category?.toLowerCase().includes('visio') },
                  { id: 'email', label: 'Emails', icon: '📧', filter: e => e.type === 'email' || e.type === 'notification' || e.category?.toLowerCase().includes('email') },
                  { id: 'signature', label: 'Émargements', icon: '✍️', filter: e => e.type === 'signature' || e.type === 'signed' || e.category === 'Émargement' || e.category === 'Séance émargée' },
                  { id: 'session', label: 'Séances', icon: '📚', filter: e => e.type === 'session' || e.type === 'attendance' || e.category === 'Confirmation' || e.category?.includes('Séance') },
                  { id: 'questionnaire', label: 'Questionnaires', icon: '📝', filter: e => e.category?.includes('Questionnaire') || e.category?.includes('Q1') || e.category?.includes('Q2') || e.category?.includes('Q3') },
                  { id: 'test', label: 'Tests', icon: '🎯', filter: e => e.category?.includes('Test') || e.category?.includes('T1') || e.category?.includes('T2') || e.category?.includes('T3') },
                  { id: 'livret', label: 'Livret', icon: '📖', filter: e => e.category?.includes('Livret') || e.type === 'livret' },
                  { id: 'account', label: 'Compte', icon: '👤', filter: e => e.type === 'account' || e.category === 'Compte créé' || e.category === 'Création compte' }
                ].map(cat => {
                  const count = cat.id === 'all' ? studentHistory.length : studentHistory.filter(cat.filter || (() => false)).length;
                  if (cat.id !== 'all' && count === 0) return null;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setHistoryCategory(cat.id)}
                      className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
                        historyCategory === cat.id
                          ? 'bg-white border-t-2 border-x border-gray-200 -mb-px'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                      }`}
                      style={historyCategory === cat.id ? { borderTopColor: TERCIFORM_BLUE, color: TERCIFORM_BLUE } : {}}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${historyCategory === cat.id ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-1 mt-4">
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
                {/* Timeline filtrée */}
                <div className="relative">
                  {/* Ligne verticale de la timeline */}
                  <div className="absolute left-[21px] top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  
                  {studentHistory
                    .filter(event => {
                      if (historyCategory === 'all') return true;
                      if (historyCategory === 'connection') return event.category === 'Connexion' || event.type === 'connection' || event.type === 'login';
                      if (historyCategory === 'visio') return event.category === 'Visioconférence' || event.type === 'visio' || event.category?.toLowerCase().includes('visio');
                      if (historyCategory === 'email') return event.type === 'email' || event.type === 'notification' || event.category?.toLowerCase().includes('email');
                      if (historyCategory === 'signature') return event.type === 'signature' || event.type === 'signed' || event.category === 'Émargement' || event.category === 'Séance émargée';
                      if (historyCategory === 'session') return event.type === 'session' || event.type === 'attendance' || event.category === 'Confirmation' || event.category?.includes('Séance');
                      if (historyCategory === 'questionnaire') return event.category?.includes('Questionnaire') || event.category?.includes('Q1') || event.category?.includes('Q2') || event.category?.includes('Q3');
                      if (historyCategory === 'test') return event.category?.includes('Test') || event.category?.includes('T1') || event.category?.includes('T2') || event.category?.includes('T3');
                      if (historyCategory === 'livret') return event.category?.includes('Livret') || event.type === 'livret';
                      if (historyCategory === 'account') return event.type === 'account' || event.category === 'Compte créé' || event.category === 'Création compte';
                      return true;
                    })
                    .map((event, index) => {
                    // Définir les couleurs et icônes selon le type d'événement
                    let bgColor = 'bg-blue-100';
                    let borderColor = 'border-blue-400';
                    let textColor = 'text-blue-800';
                    let icon = '📄';
                    
                    const category = event.category?.toLowerCase() || '';
                    const type = event.type?.toLowerCase() || '';
                    
                    if (category.includes('connexion') || type === 'connection' || type === 'login') {
                      bgColor = 'bg-green-100';
                      borderColor = 'border-green-400';
                      textColor = 'text-green-800';
                      icon = '🔐';
                    } else if (category.includes('émargement') || category.includes('signé') || type === 'signature' || type === 'signed') {
                      bgColor = 'bg-purple-100';
                      borderColor = 'border-purple-400';
                      textColor = 'text-purple-800';
                      icon = '✍️';
                    } else if (category.includes('visio') || type === 'visio') {
                      bgColor = 'bg-rose-100';
                      borderColor = 'border-rose-400';
                      textColor = 'text-rose-800';
                      icon = '📹';
                    } else if (category.includes('email') || type === 'email' || type === 'notification') {
                      bgColor = 'bg-yellow-100';
                      borderColor = 'border-yellow-400';
                      textColor = 'text-yellow-800';
                      icon = '📧';
                    } else if (category.includes('séance') || category.includes('confirmation') || type === 'session' || type === 'attendance') {
                      bgColor = 'bg-indigo-100';
                      borderColor = 'border-indigo-400';
                      textColor = 'text-indigo-800';
                      icon = '📚';
                    } else if (category.includes('questionnaire') || category.includes('q1') || category.includes('q2') || category.includes('q3')) {
                      bgColor = 'bg-orange-100';
                      borderColor = 'border-orange-400';
                      textColor = 'text-orange-800';
                      icon = '📝';
                    } else if (category.includes('test') || category.includes('t1') || category.includes('t2') || category.includes('t3')) {
                      bgColor = 'bg-pink-100';
                      borderColor = 'border-pink-400';
                      textColor = 'text-pink-800';
                      icon = '🎯';
                    } else if (category.includes('livret') || type === 'livret') {
                      bgColor = 'bg-emerald-100';
                      borderColor = 'border-emerald-400';
                      textColor = 'text-emerald-800';
                      icon = '📖';
                    } else if (category.includes('compte') || type === 'account') {
                      bgColor = 'bg-teal-100';
                      borderColor = 'border-teal-400';
                      textColor = 'text-teal-800';
                      icon = '👤';
                    } else if (type === 'document') {
                      bgColor = 'bg-cyan-100';
                      borderColor = 'border-cyan-400';
                      textColor = 'text-cyan-800';
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
                      <div key={index} className="relative flex gap-4 pb-4">
                        {/* Point sur la timeline */}
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${bgColor} border-3 ${borderColor} flex items-center justify-center text-lg shadow-sm`}>
                          {icon}
                        </div>
                        
                        {/* Contenu de l'événement */}
                        <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
                                  {event.category || 'Général'}
                                </span>
                                <span className="text-xs text-gray-500 font-medium">
                                  {formattedDate} à {formattedTime}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">
                                {event.title}
                              </p>
                              {event.description && (
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {event.description}
                                </p>
                              )}
                              {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                                    {Object.entries(event.metadata).map(([key, value]) => (
                                      <span key={key} className="text-xs text-gray-500">
                                        <strong className="text-gray-600">{key}:</strong> {String(value)}
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

      {/* Modal Sorties de parcours (élèves historisés) */}
      <Dialog open={showArchivedModal} onOpenChange={setShowArchivedModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: TERCIFORM_BLUE }}>
              <FolderOpen className="w-6 h-6" />
              Sorties de parcours
            </DialogTitle>
            <DialogDescription>
              Liste des élèves ayant terminé leur parcours de formation ({archivedStudents.length} élève(s))
            </DialogDescription>
          </DialogHeader>

          {/* Filtres et actions */}
          <div className="flex items-center justify-between gap-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Filtrer par mois :</label>
              <select
                value={archivedMonthFilter}
                onChange={(e) => setArchivedMonthFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les mois</option>
                {availableExitMonths.map(month => {
                  const [year, monthNum] = month.split('-');
                  const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                  return (
                    <option key={month} value={month}>
                      {monthNames[parseInt(monthNum)]} {year}
                    </option>
                  );
                })}
              </select>
              <span className="text-sm text-gray-500">
                {filteredArchivedStudents.length} résultat(s)
              </span>
            </div>
            <Button
              onClick={handleExportArchivedPdf}
              disabled={exportingArchivedPdf || filteredArchivedStudents.length === 0}
              style={{ backgroundColor: TERCIFORM_BLUE }}
              className="text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              {exportingArchivedPdf ? 'Export...' : 'Exporter PDF'}
            </Button>
          </div>

          {/* Liste des élèves historisés */}
          <div className="flex-1 overflow-y-auto py-4">
            {filteredArchivedStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun élève historisé{archivedMonthFilter ? ' pour ce mois' : ''}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredArchivedStudents.map(student => {
                  const exitDateFormatted = student.exit_date 
                    ? new Date(student.exit_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Non définie';
                  
                  return (
                    <div 
                      key={student.id} 
                      className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: TERCIFORM_BLUE }}>
                              {(student.name?.[0] || '').toUpperCase()}{(student.last_name?.[0] || '').toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-800">
                                {student.name} {student.last_name}
                              </h4>
                              <p className="text-sm text-gray-500">{student.organism || 'Sans organisme'}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-gray-500">Email :</span>
                              <p className="font-medium truncate">{student.email || '-'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Heures réalisées :</span>
                              <p className="font-medium">{student.total_hours || 0}h</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Heures restantes :</span>
                              <p className="font-medium text-orange-600">{student.credit_hours || 0}h</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
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

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowArchivedModal(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Créer un Formateur */}
      <Dialog open={showCreateFormateurDialog} onOpenChange={(open) => {
        setShowCreateFormateurDialog(open);
        if (!open) resetFormateurForm();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3" style={{color: TERCIFORM_BLUE}}>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <PenTool className="w-6 h-6 text-amber-600" />
              </div>
              Nouveau Formateur
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations du formateur. Les champs marqués * sont obligatoires.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Photo de profil */}
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-full border-4 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {formateurForm.photoPreview ? (
                    <img 
                      src={formateurForm.photoPreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-10 h-10 text-gray-400" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <Label className="text-sm font-semibold text-gray-700">Photo de profil</Label>
                <p className="text-xs text-gray-500 mb-2">Formats acceptés : JPG, PNG, WebP (max 5 Mo)</p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('La photo ne doit pas dépasser 5 Mo');
                            return;
                          }
                          handleFormateurChange('photo', file);
                        }
                      }}
                    />
                    <span className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                      <Upload className="w-4 h-4 mr-2" />
                      Choisir une photo
                    </span>
                  </label>
                  {formateurForm.photo && (
                    <span className="text-sm text-green-600 font-medium">{formateurForm.photo.name}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Informations personnelles */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Informations personnelles
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formateur-prenom" className="text-sm font-medium">
                    Prénom <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="formateur-prenom"
                    value={formateurForm.prenom}
                    onChange={(e) => handleFormateurChange('prenom', e.target.value)}
                    placeholder="Jean"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formateur-nom" className="text-sm font-medium">
                    Nom <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="formateur-nom"
                    value={formateurForm.nom}
                    onChange={(e) => handleFormateurChange('nom', e.target.value)}
                    placeholder="Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formateur-societe" className="text-sm font-medium">
                    Société / Entreprise
                  </Label>
                  <Input
                    id="formateur-societe"
                    value={formateurForm.societe}
                    onChange={(e) => handleFormateurChange('societe', e.target.value)}
                    placeholder="Formation Pro SARL"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Contact
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formateur-email" className="text-sm font-medium">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="formateur-email"
                    type="email"
                    value={formateurForm.email}
                    onChange={(e) => handleFormateurChange('email', e.target.value)}
                    placeholder="formateur@exemple.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formateur-telephone" className="text-sm font-medium">
                    Téléphone
                  </Label>
                  <Input
                    id="formateur-telephone"
                    value={formateurForm.telephone}
                    onChange={(e) => handleFormateurChange('telephone', e.target.value)}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>
            </div>

            {/* Informations administratives */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5" />
                Informations administratives
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formateur-siret" className="text-sm font-medium">
                    N° SIRET
                  </Label>
                  <Input
                    id="formateur-siret"
                    value={formateurForm.siret}
                    onChange={(e) => handleFormateurChange('siret', e.target.value)}
                    placeholder="123 456 789 00012"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formateur-nda" className="text-sm font-medium">
                    N° de déclaration d'activité (NDA)
                  </Label>
                  <Input
                    id="formateur-nda"
                    value={formateurForm.nda}
                    onChange={(e) => handleFormateurChange('nda', e.target.value)}
                    placeholder="11 75 12345 67"
                  />
                </div>
              </div>
            </div>

            {/* Matières enseignées */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <School className="w-5 h-5" />
                Matières enseignées
              </h3>
              <div className="space-y-3">
                {formateurForm.matieres.map((matiere, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={matiere}
                      onChange={(e) => updateMatiereFormateur(index, e.target.value)}
                      placeholder="Ex: Anglais professionnel, Management..."
                      className="flex-1"
                    />
                    {formateurForm.matieres.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMatiereFormateur(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMatiereFormateur}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter une matière
                </Button>
              </div>
            </div>

            {/* Documents */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents
              </h3>
              <p className="text-sm text-gray-500 mb-4">Formats acceptés: PDF uniquement</p>
              <div className="grid grid-cols-1 gap-4">
                {/* CV */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">CV</p>
                        <p className="text-sm text-gray-500">
                          {formateurForm.cvName || 'Aucun fichier sélectionné'}
                        </p>
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleFormateurChange('cv', file);
                          }
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        <Upload className="w-4 h-4 mr-2" />
                        Choisir
                      </span>
                    </label>
                  </div>
                </div>

                {/* Diplôme 1 */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Award className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">Diplôme 1</p>
                        <p className="text-sm text-gray-500">
                          {formateurForm.diplome1Name || 'Aucun fichier sélectionné'}
                        </p>
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleFormateurChange('diplome1', file);
                          }
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                        <Upload className="w-4 h-4 mr-2" />
                        Choisir
                      </span>
                    </label>
                  </div>
                </div>

                {/* Diplôme 2 */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Award className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">Diplôme 2</p>
                        <p className="text-sm text-gray-500">
                          {formateurForm.diplome2Name || 'Aucun fichier sélectionné'}
                        </p>
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleFormateurChange('diplome2', file);
                          }
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                        <Upload className="w-4 h-4 mr-2" />
                        Choisir
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateFormateurDialog(false);
                resetFormateurForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateFormateur}
              className="text-white"
              style={{ backgroundColor: TERCIFORM_BLUE }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer le formateur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Modifier un Formateur */}
      <Dialog open={showEditFormateurDialog} onOpenChange={(open) => {
        setShowEditFormateurDialog(open);
        if (!open) {
          setEditingFormateur(null);
          resetFormateurForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3" style={{color: TERCIFORM_BLUE}}>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Edit className="w-6 h-6 text-amber-600" />
              </div>
              Modifier le Formateur
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du formateur. Les champs marqués * sont obligatoires.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Photo de profil */}
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-full border-4 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {formateurForm.photoPreview ? (
                    <img 
                      src={formateurForm.photoPreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-10 h-10 text-gray-400" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <Label className="text-sm font-semibold text-gray-700">Photo de profil</Label>
                <div className="mt-2 flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          handleFormateurChange('photo', file);
                        }
                      }}
                    />
                    <span className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                      <Upload className="w-4 h-4 mr-2" />
                      {formateurForm.photo ? 'Changer' : 'Choisir une photo'}
                    </span>
                  </label>
                  {formateurForm.photo && (
                    <span className="text-sm text-green-600">{formateurForm.photo.name}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Formats acceptés : PNG, JPG, JPEG, WebP</p>
              </div>
            </div>

            {/* Informations personnelles */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Informations personnelles
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Prénom <span className="text-red-500">*</span></Label>
                  <Input
                    value={formateurForm.prenom}
                    onChange={(e) => handleFormateurChange('prenom', e.target.value)}
                    placeholder="Jean"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nom <span className="text-red-500">*</span></Label>
                  <Input
                    value={formateurForm.nom}
                    onChange={(e) => handleFormateurChange('nom', e.target.value)}
                    placeholder="Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Société / Entreprise</Label>
                  <Input
                    value={formateurForm.societe}
                    onChange={(e) => handleFormateurChange('societe', e.target.value)}
                    placeholder="Formation Pro SARL"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Contact
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={formateurForm.email}
                    onChange={(e) => handleFormateurChange('email', e.target.value)}
                    placeholder="formateur@exemple.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Téléphone</Label>
                  <Input
                    value={formateurForm.telephone}
                    onChange={(e) => handleFormateurChange('telephone', e.target.value)}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>
            </div>

            {/* Informations administratives */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5" />
                Informations administratives
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">N° SIRET</Label>
                  <Input
                    value={formateurForm.siret}
                    onChange={(e) => handleFormateurChange('siret', e.target.value)}
                    placeholder="123 456 789 00012"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">N° de déclaration d'activité (NDA)</Label>
                  <Input
                    value={formateurForm.nda}
                    onChange={(e) => handleFormateurChange('nda', e.target.value)}
                    placeholder="11 75 12345 67"
                  />
                </div>
              </div>
            </div>

            {/* Matières enseignées */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <School className="w-5 h-5" />
                Matières enseignées
              </h3>
              <div className="space-y-3">
                {formateurForm.matieres.map((matiere, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={matiere}
                      onChange={(e) => updateMatiereFormateur(index, e.target.value)}
                      placeholder="Ex: Anglais professionnel, Management..."
                      className="flex-1"
                    />
                    {formateurForm.matieres.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMatiereFormateur(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMatiereFormateur}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter une matière
                </Button>
              </div>
            </div>

            {/* Documents */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents
              </h3>
              <p className="text-sm text-gray-500 mb-4">Uploadez de nouveaux fichiers pour les remplacer. Les documents existants seront conservés si vous n'uploadez pas de nouveau fichier.</p>
              <div className="grid grid-cols-1 gap-4">
                {/* CV */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">CV</p>
                        <p className="text-sm text-gray-500">
                          {formateurForm.cv ? formateurForm.cv.name : formateurForm.cvName || 'Aucun fichier'}
                        </p>
                        {/* Lien pour voir le CV existant */}
                        {editingFormateur?.cv_url && !formateurForm.cv && (
                          <a 
                            href={`${BACKEND_URL}${editingFormateur.cv_url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Voir le CV actuel
                          </a>
                        )}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) handleFormateurChange('cv', file);
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        <Upload className="w-4 h-4 mr-2" />
                        {formateurForm.cv ? 'Remplacer' : editingFormateur?.cv_url ? 'Remplacer' : 'Choisir'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Diplôme 1 */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Award className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">Diplôme 1</p>
                        <p className="text-sm text-gray-500">
                          {formateurForm.diplome1 ? formateurForm.diplome1.name : formateurForm.diplome1Name || 'Aucun fichier'}
                        </p>
                        {/* Lien pour voir le diplôme 1 existant */}
                        {editingFormateur?.diplome1_url && !formateurForm.diplome1 && (
                          <a 
                            href={`${BACKEND_URL}${editingFormateur.diplome1_url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Voir le diplôme actuel
                          </a>
                        )}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) handleFormateurChange('diplome1', file);
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                        <Upload className="w-4 h-4 mr-2" />
                        {formateurForm.diplome1 ? 'Remplacer' : editingFormateur?.diplome1_url ? 'Remplacer' : 'Choisir'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Diplôme 2 */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Award className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">Diplôme 2</p>
                        <p className="text-sm text-gray-500">
                          {formateurForm.diplome2 ? formateurForm.diplome2.name : formateurForm.diplome2Name || 'Aucun fichier'}
                        </p>
                        {/* Lien pour voir le diplôme 2 existant */}
                        {editingFormateur?.diplome2_url && !formateurForm.diplome2 && (
                          <a 
                            href={`${BACKEND_URL}${editingFormateur.diplome2_url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Voir le diplôme actuel
                          </a>
                        )}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) handleFormateurChange('diplome2', file);
                        }}
                      />
                      <span className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                        <Upload className="w-4 h-4 mr-2" />
                        {formateurForm.diplome2 ? 'Remplacer' : editingFormateur?.diplome2_url ? 'Remplacer' : 'Choisir'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditFormateurDialog(false);
                setEditingFormateur(null);
                resetFormateurForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateFormateur}
              className="text-white"
              style={{ backgroundColor: TERCIFORM_BLUE }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Planning Formateur - Style grille horaire comme le planning général */}
      <Dialog open={showFormateurPlanningDialog} onOpenChange={setShowFormateurPlanningDialog}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3" style={{color: '#8B5CF6'}}>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              Planning - {selectedFormateurForPlanning?.prenom} {selectedFormateurForPlanning?.nom}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Filtres Mois/Année - Style identique au planning général */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm mb-4 flex-shrink-0">
              <button
                onClick={() => {
                  if (formateurPlanningMonth === 1) {
                    setFormateurPlanningMonth(12);
                    setFormateurPlanningYear(formateurPlanningYear - 1);
                  } else {
                    setFormateurPlanningMonth(formateurPlanningMonth - 1);
                  }
                }}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Année :</label>
                <select
                  value={formateurPlanningYear}
                  onChange={(e) => setFormateurPlanningYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-700"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Mois :</label>
                <select
                  value={formateurPlanningMonth}
                  onChange={(e) => setFormateurPlanningMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-700"
                >
                  {MOIS_NOMS.map(m => (
                    <option key={m.num} value={m.num}>{m.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  if (formateurPlanningMonth === 12) {
                    setFormateurPlanningMonth(1);
                    setFormateurPlanningYear(formateurPlanningYear + 1);
                  } else {
                    setFormateurPlanningMonth(formateurPlanningMonth + 1);
                  }
                }}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>

              <span className="text-sm text-gray-500 ml-4">
                Période : <span className="font-medium text-blue-700">{MOIS_NOMS.find(m => m.num === formateurPlanningMonth)?.label} {formateurPlanningYear}</span>
                <span className="ml-2 text-purple-600">({getFormateurSessions.length} séance(s))</span>
              </span>
            </div>

            {/* Grille Planning - Style identique */}
            <div className="border rounded-lg overflow-hidden bg-white flex flex-col flex-1" style={{ maxHeight: '60vh' }}>
              {/* HEADER FIGÉ - Ligne des dates */}
              <div className="flex-shrink-0 border-b border-gray-400 bg-gray-100">
                <div className="flex">
                  {/* Case vide pour aligner avec colonne heures */}
                  <div className="flex-shrink-0 border-r border-gray-400 bg-gray-100" style={{ width: '60px', height: '48px' }}></div>
                  {/* Headers des jours */}
                  <div className="flex overflow-x-auto" id="formateur-planning-header">
                    {(() => {
                      const year = formateurPlanningYear;
                      const month = formateurPlanningMonth - 1;
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                      const days = [];
                      for (let d = 1; d <= daysInMonth; d++) {
                        const date = new Date(year, month, d);
                        days.push({
                          day: d,
                          date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                          dayName: dayNames[date.getDay()]
                        });
                      }
                      return days.map(({ day, date, dayName }) => (
                        <div 
                          key={date} 
                          className="flex-shrink-0 border-r border-gray-400 flex flex-col items-center justify-center text-xs font-semibold bg-gray-100"
                          style={{ width: '100px', height: '48px' }}
                        >
                          <span className="text-gray-500">{dayName}</span>
                          <span className="text-gray-800">{String(day).padStart(2, '0')}/{String(formateurPlanningMonth).padStart(2, '0')}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              
              {/* CONTENU SCROLLABLE - Grille horaire */}
              <div 
                className="flex-1 overflow-auto"
                onScroll={(e) => {
                  const header = document.getElementById('formateur-planning-header');
                  if (header) header.scrollLeft = e.target.scrollLeft;
                }}
              >
                <div className="flex min-w-max">
                  {/* Colonne des heures - sticky left */}
                  <div className="sticky left-0 z-20 bg-gray-50 border-r border-gray-400 flex-shrink-0" style={{ width: '60px' }}>
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(hour => (
                      <div
                        key={hour}
                        className="border-b border-gray-400 text-xs text-gray-600 flex items-start justify-center pt-1 font-medium bg-gray-50"
                        style={{ height: '50px' }}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Colonnes des jours */}
                  {(() => {
                    const year = formateurPlanningYear;
                    const month = formateurPlanningMonth - 1;
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const days = [];
                    for (let d = 1; d <= daysInMonth; d++) {
                      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
                    }
                    
                    return days.map((dateStr) => {
                      const daySessions = getFormateurSessions.filter(s => s.date === dateStr);
                      
                      return (
                        <div key={dateStr} className="border-r border-gray-400 flex-shrink-0" style={{ width: '100px' }}>
                          <div className="relative" style={{ height: `${13 * 50}px` }}>
                            {/* Lignes horaires */}
                            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(hour => (
                              <div
                                key={hour}
                                className="absolute w-full border-b border-gray-300 bg-purple-50/30"
                                style={{ top: `${(hour - 8) * 50}px`, height: '50px' }}
                              ></div>
                            ))}

                            {/* Sessions du jour */}
                            {daySessions.map((session, idx) => {
                              const startParts = session.start_time?.split(':') || ['8', '00'];
                              const endParts = session.end_time?.split(':') || ['9', '00'];
                              const startHour = parseInt(startParts[0]);
                              const startMin = parseInt(startParts[1]);
                              const endHour = parseInt(endParts[0]);
                              const endMin = parseInt(endParts[1]);
                              
                              const topPx = (startHour - 8) * 50 + (startMin / 60) * 50;
                              const heightPx = ((endHour - startHour) * 50) + ((endMin - startMin) / 60) * 50;
                              
                              return (
                                <div
                                  key={idx}
                                  className="absolute rounded shadow-md overflow-hidden px-1 py-1 bg-purple-500 text-white text-xs cursor-pointer hover:bg-purple-600 transition-colors"
                                  style={{
                                    top: `${topPx}px`,
                                    height: `${Math.max(heightPx, 25)}px`,
                                    left: '2px',
                                    right: '2px',
                                    zIndex: 10
                                  }}
                                  title={`${session.start_time}-${session.end_time} | ${session.student_name} | ${session.subject}`}
                                >
                                  <div className="font-semibold truncate">{session.start_time}-{session.end_time}</div>
                                  {heightPx > 35 && <div className="truncate opacity-90">{session.student_name?.split(' ')[0]}</div>}
                                  {heightPx > 55 && <div className="truncate opacity-75 text-[10px]">{session.subject}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Message si aucune séance */}
            {getFormateurSessions.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                Aucune séance programmée pour ce mois
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4 flex-shrink-0">
            <Button variant="outline" onClick={() => setShowFormateurPlanningDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG CRÉER UN CLIENT ===== */}
      <Dialog open={showCreateClientDialog} onOpenChange={(open) => {
        setShowCreateClientDialog(open);
        if (!open) resetClientForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-sky-700 flex items-center gap-2">
              <Building className="w-6 h-6" />
              Créer un nouveau client
            </DialogTitle>
            <DialogDescription>
              Renseignez les informations du centre de formation client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Photo du centre */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-xl bg-sky-100 border-2 border-dashed border-sky-300 flex items-center justify-center overflow-hidden">
                {newClientData.photo ? (
                  <img 
                    src={URL.createObjectURL(newClientData.photo)} 
                    alt="Aperçu" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building className="w-12 h-12 text-sky-400" />
                )}
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setNewClientData(prev => ({
                        ...prev,
                        photo: file,
                        photoName: file.name
                      }));
                    }
                  }}
                />
                <span className="px-4 py-2 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors text-sm font-medium">
                  {newClientData.photoName || 'Ajouter une photo du centre'}
                </span>
              </label>
            </div>

            {/* Informations du centre */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du centre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.nom_centre}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, nom_centre: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Ex: Centre de Formation ABC"
                  data-testid="client-nom-centre-input"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse postale du siège
                </label>
                <textarea
                  value={newClientData.adresse_siege}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, adresse_siege: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Adresse complète..."
                  rows={2}
                  data-testid="client-adresse-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone du siège
                </label>
                <input
                  type="tel"
                  value={newClientData.telephone_siege}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, telephone_siege: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="01 23 45 67 89"
                  data-testid="client-telephone-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SIRET
                </label>
                <input
                  type="text"
                  value={newClientData.siret}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, siret: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="123 456 789 00012"
                  data-testid="client-siret-input"
                />
              </div>
            </div>

            {/* Mot de passe pour l'accès gestionnaire */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-sky-600 uppercase tracking-wide mb-3">🔐 Accès Espace Gestionnaire</h4>
              <p className="text-xs text-gray-500 mb-3">
                Ce mot de passe permettra au gestionnaire et au responsable de se connecter à leur espace dédié. Un email de bienvenue leur sera envoyé avec leurs identifiants.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe <span className="text-gray-400">(commun aux deux contacts)</span>
                </label>
                <input
                  type="text"
                  value={newClientData.password}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-sky-50"
                  placeholder="Ex: Bienvenue2026!"
                  data-testid="client-password-input"
                />
              </div>
            </div>

            {/* Responsable */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Responsable</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du responsable
                  </label>
                  <input
                    type="text"
                    value={newClientData.nom_responsable}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, nom_responsable: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Prénom Nom"
                    data-testid="client-nom-responsable-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email du responsable
                  </label>
                  <input
                    type="email"
                    value={newClientData.email_responsable}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, email_responsable: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="responsable@exemple.com"
                    data-testid="client-email-responsable-input"
                  />
                </div>
              </div>
            </div>

            {/* Gestionnaire */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Gestionnaire</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du gestionnaire
                  </label>
                  <input
                    type="text"
                    value={newClientData.nom_gestionnaire}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, nom_gestionnaire: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Prénom Nom"
                    data-testid="client-nom-gestionnaire-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email du gestionnaire
                  </label>
                  <input
                    type="email"
                    value={newClientData.email_gestionnaire}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, email_gestionnaire: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="gestionnaire@exemple.com"
                    data-testid="client-email-gestionnaire-input"
                  />
                </div>
              </div>
            </div>

            {/* Formateur assigné */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <PenTool className="w-4 h-4" />
                Formateur référent
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Sélectionnez un formateur qui sera associé à ce centre de formation.
              </p>
              <div className="space-y-3">
                <select
                  value={newClientData.formateur_id}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, formateur_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-amber-50"
                  data-testid="client-formateur-select"
                >
                  <option value="">-- Sélectionner un formateur --</option>
                  {formateurs.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.speciality ? `(${f.speciality})` : ''} - {f.email}
                    </option>
                  ))}
                </select>
                
                {/* Aperçu du formateur sélectionné */}
                {newClientData.formateur_id && (() => {
                  const selectedFormateur = formateurs.find(f => f.id === newClientData.formateur_id);
                  if (!selectedFormateur) return null;
                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {selectedFormateur.photo_url ? (
                            <img src={selectedFormateur.photo_url} alt={selectedFormateur.name} className="w-full h-full object-cover" />
                          ) : (
                            <PenTool className="w-8 h-8 text-amber-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900">{selectedFormateur.name}</h5>
                          {selectedFormateur.speciality && (
                            <span className="inline-block px-2 py-1 bg-amber-200 text-amber-800 rounded-full text-xs font-medium">
                              {selectedFormateur.speciality}
                            </span>
                          )}
                          <p className="text-sm text-gray-600 mt-1">{selectedFormateur.email}</p>
                          {selectedFormateur.phone && (
                            <p className="text-sm text-gray-500">{selectedFormateur.phone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowCreateClientDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleCreateClient}
              className="bg-sky-600 hover:bg-sky-700"
              data-testid="submit-create-client-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer le client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG MODIFIER UN CLIENT ===== */}
      <Dialog open={showEditClientDialog} onOpenChange={(open) => {
        setShowEditClientDialog(open);
        if (!open) {
          setSelectedClient(null);
          resetClientForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-sky-700 flex items-center gap-2">
              <Edit className="w-6 h-6" />
              Modifier le client
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du centre de formation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Photo du centre */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-xl bg-sky-100 border-2 border-dashed border-sky-300 flex items-center justify-center overflow-hidden">
                {newClientData.photo ? (
                  <img 
                    src={URL.createObjectURL(newClientData.photo)} 
                    alt="Aperçu" 
                    className="w-full h-full object-cover"
                  />
                ) : selectedClient?.photo_url ? (
                  <img 
                    src={`${API}/clients/${selectedClient.id}/photo`} 
                    alt={selectedClient.nom_centre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building className="w-12 h-12 text-sky-400" />
                )}
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setNewClientData(prev => ({
                        ...prev,
                        photo: file,
                        photoName: file.name
                      }));
                    }
                  }}
                />
                <span className="px-4 py-2 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors text-sm font-medium">
                  {newClientData.photoName || 'Changer la photo'}
                </span>
              </label>
            </div>

            {/* Informations du centre */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du centre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.nom_centre}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, nom_centre: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Ex: Centre de Formation ABC"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse postale du siège
                </label>
                <textarea
                  value={newClientData.adresse_siege}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, adresse_siege: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Adresse complète..."
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone du siège
                </label>
                <input
                  type="tel"
                  value={newClientData.telephone_siege}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, telephone_siege: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SIRET
                </label>
                <input
                  type="text"
                  value={newClientData.siret}
                  onChange={(e) => setNewClientData(prev => ({ ...prev, siret: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="123 456 789 00012"
                />
              </div>
            </div>

            {/* Responsable */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Responsable</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du responsable
                  </label>
                  <input
                    type="text"
                    value={newClientData.nom_responsable}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, nom_responsable: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Prénom Nom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email du responsable
                  </label>
                  <input
                    type="email"
                    value={newClientData.email_responsable}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, email_responsable: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="responsable@exemple.com"
                  />
                </div>
              </div>
            </div>

            {/* Gestionnaire */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Gestionnaire</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du gestionnaire
                  </label>
                  <input
                    type="text"
                    value={newClientData.nom_gestionnaire}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, nom_gestionnaire: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Prénom Nom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email du gestionnaire
                  </label>
                  <input
                    type="email"
                    value={newClientData.email_gestionnaire}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, email_gestionnaire: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="gestionnaire@exemple.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowEditClientDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleEditClient}
              className="bg-sky-600 hover:bg-sky-700"
              data-testid="submit-edit-client-btn"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG HISTORIQUE CLIENT ===== */}
      <Dialog open={showClientHistoryDialog} onOpenChange={setShowClientHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-700 flex items-center gap-2">
              <Clock className="w-6 h-6" />
              Historique - {selectedClient?.nom_centre}
            </DialogTitle>
            <DialogDescription>
              Consultez l'historique des connexions et actions du centre
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Onglets d'historique */}
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-700 mb-3">Dernières connexions</h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <p className="italic text-slate-400">Aucune connexion enregistrée pour le moment</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-700 mb-3">Historique des actions</h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2 py-2 border-b border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span>Création du client</span>
                    <span className="ml-auto text-xs text-slate-500 font-medium">
                      {formatDateTimeFr(selectedClient?.created_at)}
                    </span>
                  </div>
                  {selectedClient?.updated_at && selectedClient.updated_at !== selectedClient.created_at && (
                    <div className="flex items-center gap-2 py-2 border-b border-slate-200">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Dernière modification</span>
                      <span className="ml-auto text-xs text-slate-500 font-medium">
                        {formatDateTimeFr(selectedClient?.updated_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientHistoryDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG ACTIONS CLIENT ===== */}
      <Dialog open={showClientActionsDialog} onOpenChange={(open) => {
        setShowClientActionsDialog(open);
        if (!open) {
          setShowRoomRequestForm(false);
          setRoomRequestFormData([{ date: '', start_time: '', end_time: '', location_name: '', location_address: '', num_learners: 1 }]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-sky-700 flex items-center gap-2">
              <FolderOpen className="w-6 h-6" />
              Actions - {selectedClient?.nom_centre}
            </DialogTitle>
            <DialogDescription>
              Gérez les salles et la facturation du centre
            </DialogDescription>
          </DialogHeader>

          {/* Onglets */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setClientActionsTab('salles')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                clientActionsTab === 'salles'
                  ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Building className="w-4 h-4 inline mr-2" />
              Gestion des salles
            </button>
            <button
              onClick={() => setClientActionsTab('facturation')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                clientActionsTab === 'facturation'
                  ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Euro className="w-4 h-4 inline mr-2" />
              Facturation
            </button>
          </div>

          {/* Contenu des onglets */}
          <div className="flex-1 overflow-y-auto">
            {clientActionsTab === 'salles' && (
              <div className="space-y-4">
                {/* Bouton faire une demande */}
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-700">Demandes de salle</h4>
                  <button 
                    onClick={() => setShowRoomRequestForm(!showRoomRequestForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 text-sm font-medium shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    Faire une demande de salle
                  </button>
                </div>

                {/* Formulaire de demande de salle */}
                {showRoomRequestForm && (
                  <div className="bg-sky-50 rounded-xl p-5 border border-sky-200 space-y-4">
                    <h5 className="font-semibold text-sky-800">Nouvelle demande de salle</h5>
                    
                    {/* Lignes de demande */}
                    {roomRequestFormData.map((req, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-sky-100 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-sky-700">Demande #{index + 1}</span>
                          {roomRequestFormData.length > 1 && (
                            <button 
                              onClick={() => removeRoomRequestLine(index)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <input
                              type="date"
                              value={req.date}
                              onChange={(e) => updateRoomRequestLine(index, 'date', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Heure début</label>
                            <input
                              type="time"
                              value={req.start_time}
                              onChange={(e) => updateRoomRequestLine(index, 'start_time', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Heure fin</label>
                            <input
                              type="time"
                              value={req.end_time}
                              onChange={(e) => updateRoomRequestLine(index, 'end_time', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Centre / Lieu</label>
                            <input
                              type="text"
                              value={req.location_name}
                              onChange={(e) => updateRoomRequestLine(index, 'location_name', e.target.value)}
                              list={`locations-${index}`}
                              placeholder="Ex: Centre Envergure"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                            />
                            <datalist id={`locations-${index}`}>
                              {locationsHistory.map((loc, i) => (
                                <option key={i} value={loc.name} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                            <input
                              type="text"
                              value={req.location_address}
                              onChange={(e) => updateRoomRequestLine(index, 'location_address', e.target.value)}
                              placeholder="13 rue du Gal de Gaulle 75018 Paris"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                        
                        <div className="w-1/3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre d'apprenants</label>
                          <input
                            type="number"
                            min="1"
                            value={req.num_learners}
                            onChange={(e) => updateRoomRequestLine(index, 'num_learners', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                    ))}
                    
                    {/* Bouton ajouter une demande */}
                    <button 
                      onClick={addRoomRequestLine}
                      className="text-sky-600 hover:text-sky-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une autre demande
                    </button>
                    
                    {/* Choix du destinataire */}
                    <div className="border-t border-sky-200 pt-4 mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Envoyer la demande à :</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sendTo"
                            value="gestionnaire"
                            checked={sendRoomRequestTo === 'gestionnaire'}
                            onChange={(e) => setSendRoomRequestTo(e.target.value)}
                            className="w-4 h-4 text-sky-600"
                          />
                          <span className="text-sm">
                            Gestionnaire
                            {selectedClient?.nom_gestionnaire && (
                              <span className="text-gray-500 ml-1">({selectedClient.nom_gestionnaire})</span>
                            )}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sendTo"
                            value="responsable"
                            checked={sendRoomRequestTo === 'responsable'}
                            onChange={(e) => setSendRoomRequestTo(e.target.value)}
                            className="w-4 h-4 text-sky-600"
                          />
                          <span className="text-sm">
                            Responsable
                            {selectedClient?.nom_responsable && (
                              <span className="text-gray-500 ml-1">({selectedClient.nom_responsable})</span>
                            )}
                          </span>
                        </label>
                      </div>
                    </div>
                    
                    {/* Bouton soumettre */}
                    <div className="flex justify-end gap-2 mt-4">
                      <button 
                        onClick={() => {
                          setShowRoomRequestForm(false);
                          setRoomRequestFormData([{ date: '', start_time: '', end_time: '', location_name: '', location_address: '', num_learners: 1 }]);
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        Annuler
                      </button>
                      <button 
                        onClick={submitRoomRequests}
                        disabled={submittingRoomRequest}
                        className="flex items-center gap-2 px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium disabled:opacity-50"
                      >
                        {submittingRoomRequest ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Envoi...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            Soumettre la demande
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste des demandes en attente */}
                <div className="mt-6">
                  <h5 className="font-medium text-gray-700 mb-3">Demandes en cours</h5>
                  {loadingRoomRequests ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
                    </div>
                  ) : roomRequests.filter(r => r.status === 'pending').length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <Clock className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500 text-sm">Aucune demande en attente</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roomRequests.filter(r => r.status === 'pending').map((req) => (
                        <div key={req.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">
                              <strong>{req.location_name}</strong> - {new Date(req.date).toLocaleDateString('fr-FR')} de {req.start_time} à {req.end_time}
                            </p>
                            <p className="text-xs text-gray-500">
                              {req.num_learners} apprenant(s) • Envoyé à {req.sent_to}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-amber-200 text-amber-800 rounded text-xs font-medium">En attente</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Demandes validées */}
                {roomRequests.filter(r => r.status === 'validated').length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700 mb-3">Demandes validées</h5>
                    <div className="space-y-2">
                      {roomRequests.filter(r => r.status === 'validated').map((req) => (
                        <div key={req.id} className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">
                              <strong>{req.location_name}</strong> - {new Date(req.date).toLocaleDateString('fr-FR')} de {req.start_time} à {req.end_time}
                            </p>
                            <p className="text-xs text-gray-500">{req.num_learners} apprenant(s)</p>
                          </div>
                          <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-medium">Validée</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {clientActionsTab === 'facturation' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-700">Factures</h4>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 text-sm">
                    <Plus className="w-4 h-4" />
                    Créer une facture
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Euro className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Aucune facture</p>
                  <p className="text-sm text-gray-400 mt-1">Cliquez sur "Créer une facture" pour commencer</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowClientActionsDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ticketing - Mes demandes centre */}
      <TicketingModal
        open={showTicketingModal}
        onClose={() => {
          setShowTicketingModal(false);
          setTicketingClient(null);
        }}
        userRole="teacher"
        userId={user?.id}
        clientId={ticketingClient?.id}
        clientName={ticketingClient?.nom_centre}
      />
    </div>
  );
}
