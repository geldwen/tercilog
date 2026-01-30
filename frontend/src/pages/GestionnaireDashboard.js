import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  LogOut, Users, Calendar, Search, Plus, PenTool,
  Mail, Phone, Clock, CheckCircle, Eye, Building, XCircle, Gift, FolderOpen, ChevronDown, ChevronUp, Download, FileText, Award, MessageSquare
} from "lucide-react";
import TicketingModal from "@/components/TicketingModal";

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
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Recherche
  const [showSearchStudent, setShowSearchStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStudents, setFilteredStudents] = useState(null);
  
  // Création élève
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '', email: '', phone: '', parcours: 'Anglais', 
    total_hours: 0, password: '', organism: '', support_type: '',
    teacher_name: '', teacher_email: '', teacher_phone: '',
    teacher_profile_picture: '', teacher_profile_picture_type: '',
    formateur_id: ''
  });
  const [includeTests, setIncludeTests] = useState(false);
  const [includeQuestionnaires, setIncludeQuestionnaires] = useState(false);
  const [selectedTests, setSelectedTests] = useState({
    positionnement: '', miParcours: '', fin: ''
  });
  const [selectedQuestionnaires, setSelectedQuestionnaires] = useState({
    froid: '', chaud: ''
  });
  
  // Modèles de tests par parcours
  const testModels = {
    'Anglais': {
      positionnement: ['Test A1 Anglais', 'Test A2 Anglais', 'Test B1 Anglais', 'Test B2 Anglais'],
      miParcours: ['Évaluation mi-parcours A1-A2', 'Évaluation mi-parcours B1-B2'],
      fin: ['Certification Anglais Niveau A2', 'Certification Anglais Niveau B1', 'Certification Anglais Niveau B2']
    },
    'Management': {
      positionnement: ['Test Management Débutant', 'Test Management Intermédiaire'],
      miParcours: ['Évaluation mi-parcours Management'],
      fin: ['Certification Management']
    },
    'Bureautique': {
      positionnement: ['Test Word Débutant', 'Test Excel Débutant', 'Test Pack Office'],
      miParcours: ['Évaluation mi-parcours Bureautique'],
      fin: ['Certification TOSA', 'Certification ENI']
    },
    'Informatique': {
      positionnement: ['Test Informatique Général', 'Test Développement Web'],
      miParcours: ['Évaluation mi-parcours Informatique'],
      fin: ['Certification Informatique']
    }
  };
  
  // Modèles de questionnaires par parcours
  const questionnaireModels = {
    'Anglais': {
      froid: ['Questionnaire Qualiopi Anglais - Standard', 'Questionnaire Qualiopi Anglais - Intensif'],
      chaud: ['Évaluation à chaud Anglais']
    },
    'Management': {
      froid: ['Questionnaire Qualiopi Management'],
      chaud: ['Évaluation à chaud Management']
    },
    'Bureautique': {
      froid: ['Questionnaire Qualiopi Bureautique'],
      chaud: ['Évaluation à chaud Bureautique']
    },
    'Informatique': {
      froid: ['Questionnaire Qualiopi Informatique'],
      chaud: ['Évaluation à chaud Informatique']
    }
  };

  // Détail séance
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // Recherche de séances
  const [sessionSearchName, setSessionSearchName] = useState('');
  const [sessionSearchMonth, setSessionSearchMonth] = useState('');
  const [sessionSearchHour, setSessionSearchHour] = useState('');
  const [searchedSession, setSearchedSession] = useState(null);
  const [showSearchResult, setShowSearchResult] = useState(false);

  // Sorties de parcours
  const [showExitBanner, setShowExitBanner] = useState(false);
  const [exitYearFilter, setExitYearFilter] = useState('');
  const [exitMonthFilter, setExitMonthFilter] = useState('');
  const [exitSearchQuery, setExitSearchQuery] = useState('');
  
  // Ticketing
  const [showTicketingModal, setShowTicketingModal] = useState(false);
  const [unreadTicketCount, setUnreadTicketCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  // Charger le compteur de tickets non lus
  const loadUnreadTicketCount = async (clientId) => {
    try {
      const response = await axios.get(`${API}/tickets/unread-count/${clientId}`);
      setUnreadTicketCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Erreur chargement compteur tickets:', error);
    }
  };

  // Marquer les tickets comme lus
  const markTicketsAsRead = async (clientId) => {
    try {
      await axios.post(`${API}/tickets/mark-read/${clientId}`);
      setUnreadTicketCount(0);
    } catch (error) {
      console.error('Erreur marquage tickets lus:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientRes, studentsRes, sessionsRes, formateursRes] = await Promise.all([
        axios.get(`${API}/gestionnaire/client`),
        axios.get(`${API}/gestionnaire/students`),
        axios.get(`${API}/gestionnaire/sessions`),
        axios.get(`${API}/gestionnaire/formateurs`)
      ]);
      
      // Charger les infos de debug
      try {
        const debugRes = await axios.get(`${API}/gestionnaire/debug`);
        setDebugInfo(debugRes.data);
      } catch (e) {
        console.log('Debug endpoint not available');
      }
      
      setClient(clientRes.data);
      setStudents(studentsRes.data || []);
      
      // Charger le compteur de tickets non lus
      if (clientRes.data?.id) {
        loadUnreadTicketCount(clientRes.data.id);
      }
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
      // Récupérer les infos du formateur sélectionné
      let formateurInfo = null;
      if (studentForm.formateur_id) {
        formateurInfo = formateurs.find(f => f.id === studentForm.formateur_id);
      }
      
      const studentData = {
        ...studentForm,
        client_id: user.client_id,
        organism: studentForm.organism || client?.nom_centre || '',
        teacher_name: formateurInfo ? `${formateurInfo.prenom} ${formateurInfo.nom}` : studentForm.teacher_name,
        teacher_email: formateurInfo ? formateurInfo.email : studentForm.teacher_email,
        teacher_phone: formateurInfo ? formateurInfo.telephone : studentForm.teacher_phone,
        includeTests,
        selectedTests,
        includeQuestionnaires,
        selectedQuestionnaires,
        created_by_center: client?.nom_centre || '',
        notify_formateur: true  // Flag pour notifier le formateur
      };
      
      await axios.post(`${API}/gestionnaire/students`, studentData);
      toast.success('Élève créé avec succès');
      setShowCreateStudent(false);
      setStudentForm({ 
        name: '', email: '', phone: '', parcours: 'Anglais', 
        total_hours: 0, password: '', organism: '', support_type: '',
        teacher_name: '', teacher_email: '', teacher_phone: '',
        teacher_profile_picture: '', teacher_profile_picture_type: '',
        formateur_id: ''
      });
      setIncludeTests(false);
      setIncludeQuestionnaires(false);
      setSelectedTests({ positionnement: '', miParcours: '', fin: '' });
      setSelectedQuestionnaires({ froid: '', chaud: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  // Afficher les élèves
  const displayedStudents = filteredStudents || students;

  // Calculer les dates de la semaine en cours (lundi au dimanche)
  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Ajuster pour que lundi soit le premier jour (0 = dimanche, donc on ajuste)
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday, today };
  };

  const { monday: weekStart, sunday: weekEnd, today } = getWeekDates();
  
  // Formater une date pour affichage
  const formatDateFr = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Séances du jour
  const todaySessions = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    return sessions.filter(s => s.date === todayStr).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  }, [sessions, today]);

  // Séances de la semaine (hors aujourd'hui)
  const weekSessions = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    const mondayStr = weekStart.toISOString().split('T')[0];
    const sundayStr = weekEnd.toISOString().split('T')[0];
    
    return sessions
      .filter(s => s.date >= mondayStr && s.date <= sundayStr && s.date !== todayStr)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
  }, [sessions, weekStart, weekEnd, today]);

  // Trier les séances par date (pour l'historique complet)
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  // Formater l'horodatage d'émargement
  const formatSignedAt = (isoDate) => {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

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
  // IMPORTANT: Les élèves actifs sont ceux qui ont des heures restantes OU qui n'ont pas terminé leur formation
  const activeStudents = useMemo(() => {
    return students.filter(s => {
      const remainingHours = s.credit_hours !== undefined ? s.credit_hours : (s.total_hours || 0);
      // Un élève est actif s'il a des heures restantes OU s'il n'a pas de date de fin
      return remainingHours > 0 || !s.end_date;
    });
  }, [students]);

  const exitedStudents = useMemo(() => {
    return students.filter(s => {
      const remainingHours = s.credit_hours !== undefined ? s.credit_hours : 0;
      // Un élève est sorti s'il a 0 heures ET une date de fin définie
      return remainingHours <= 0 && s.end_date;
    }).map(student => {
      // Trouver la dernière séance signée pour avoir la date de sortie réelle
      const studentSessions = sessions
        .filter(sess => sess.student_id === student.id && (sess.signature || sess.teacher_signature))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastSession = studentSessions[0];
      
      // La date de sortie est la date de la dernière séance émargée (priorité) ou end_date
      const exitDate = lastSession?.date || student.end_date;
      
      return {
        ...student,
        exit_date: exitDate,
        exit_year: exitDate ? exitDate.substring(0, 4) : null,
        exit_month: exitDate ? exitDate.substring(5, 7) : null,
        last_session_date: lastSession?.date || null
      };
    });
  }, [students, sessions]);

  // Années disponibles pour le filtre - toujours afficher 2025, 2026, 2027
  const availableExitYears = useMemo(() => {
    return ['2027', '2026', '2025'];
  }, []);

  // Mois disponibles pour le filtre - tous les mois de l'année
  const availableExitMonths = useMemo(() => {
    return ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  }, []);

  const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  // Filtre des sorties de parcours
  const filteredExitedStudents = useMemo(() => {
    let result = exitedStudents;
    if (exitYearFilter) {
      result = result.filter(s => s.exit_year === exitYearFilter);
    }
    if (exitMonthFilter) {
      result = result.filter(s => s.exit_month === exitMonthFilter);
    }
    if (exitSearchQuery.trim()) {
      const query = exitSearchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      result = result.filter(s => {
        const name = (s.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name.includes(query);
      });
    }
    return result;
  }, [exitedStudents, exitYearFilter, exitMonthFilter, exitSearchQuery]);

  // Export PDF des émargements pour un élève (téléchargement direct)
  const exportStudentAttendancePDF = async (student) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Toutes les séances de l'élève (émargées, absentes ET à venir)
    const allStudentSessions = sessions
      .filter(s => s.student_id === student.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Séances passées/émargées/absentes
    const completedSessions = allStudentSessions.filter(s => 
      s.date < today || s.signature || s.teacher_signature || s.is_absent
    );
    
    // Séances à venir (programmées)
    const upcomingSessions = allStudentSessions.filter(s => 
      s.date >= today && !s.signature && !s.teacher_signature && !s.is_absent
    );
    
    if (allStudentSessions.length === 0) {
      toast.warning('Aucune séance pour cet élève');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Logo TerciForm (texte stylisé en attendant le vrai logo)
      doc.setFillColor(13, 32, 64); // TERCIFORM_BLUE
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('TERCIFORM', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Formation Professionnelle', pageWidth / 2, 21, { align: 'center' });
      
      // Titre
      doc.setTextColor(13, 32, 64);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Planning de formation - ${student.name}`, 14, 40);
      
      // Informations élève
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      let yPos = 50;
      doc.text(`Organisme: ${student.organism || 'Non défini'}`, 14, yPos);
      doc.text(`Parcours: ${student.parcours || 'Non défini'}`, 14, yPos + 6);
      doc.text(`Total heures: ${student.total_hours || 0}h`, 14, yPos + 12);
      doc.text(`Heures restantes: ${student.credit_hours !== undefined ? student.credit_hours : student.total_hours || 0}h`, 14, yPos + 18);
      doc.text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, 14, yPos + 24);
      
      yPos = yPos + 34;
      
      // Fonction pour afficher une séance
      const renderSession = (s, isUpcoming = false) => {
        // Vérifier si on a besoin d'une nouvelle page
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = 20;
        }
        
        // Fond de la séance
        const sessionHeight = 55;
        if (s.is_absent) {
          doc.setFillColor(254, 226, 226); // Rouge clair pour absent
        } else if (isUpcoming) {
          doc.setFillColor(219, 234, 254); // Bleu clair pour à venir
        } else {
          doc.setFillColor(240, 253, 244); // Vert clair pour présent
        }
        doc.rect(14, yPos, pageWidth - 28, sessionHeight, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, yPos, pageWidth - 28, sessionHeight, 'S');
        
        // Informations de la séance
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(13, 32, 64);
        doc.text(`Séance du ${s.date}`, 18, yPos + 8);
        
        // Badge statut
        if (isUpcoming) {
          doc.setFillColor(59, 130, 246); // Bleu
          doc.roundedRect(pageWidth - 60, yPos + 3, 40, 10, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.text('À VENIR', pageWidth - 55, yPos + 10);
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`Horaires: ${s.start_time} - ${s.end_time} (${s.duration_hours}h)`, 18, yPos + 16);
        doc.text(`Matière: ${s.subject || 'N/A'}`, 18, yPos + 23);
        
        // Statut de présence
        if (s.is_absent) {
          doc.setTextColor(220, 38, 38); // Rouge
          doc.setFont('helvetica', 'bold');
          doc.text('ÉLÈVE ABSENT DE LA SÉANCE', 18, yPos + 32);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
        } else if (isUpcoming) {
          doc.setTextColor(59, 130, 246); // Bleu
          doc.setFont('helvetica', 'bold');
          doc.text('SÉANCE PROGRAMMÉE', 18, yPos + 32);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
        } else {
          // Signatures
          const sigStartX = 18;
          const sigWidth = 40;
          const sigHeight = 18;
          
          // Signature élève
          if (s.signature && s.signature.startsWith('data:image')) {
            doc.text('Signature élève:', sigStartX, yPos + 32);
            try {
              doc.addImage(s.signature, 'PNG', sigStartX, yPos + 34, sigWidth, sigHeight);
            } catch (e) {
              doc.text('Signé', sigStartX, yPos + 40);
            }
            if (s.signed_at) {
              doc.setFontSize(7);
              doc.text(formatSignedAt(s.signed_at), sigStartX, yPos + 54);
              doc.setFontSize(9);
            }
          } else if (s.signature) {
            doc.text('Signature élève: Signé', sigStartX, yPos + 35);
          }
          
          // Signature formateur
          const teacherSigX = pageWidth / 2 + 10;
          if (s.teacher_signature && s.teacher_signature.startsWith('data:image')) {
            doc.text('Signature formateur:', teacherSigX, yPos + 32);
            try {
              doc.addImage(s.teacher_signature, 'PNG', teacherSigX, yPos + 34, sigWidth, sigHeight);
            } catch (e) {
              doc.text('Signé', teacherSigX, yPos + 40);
            }
            if (s.teacher_signed_at) {
              doc.setFontSize(7);
              doc.text(formatSignedAt(s.teacher_signed_at), teacherSigX, yPos + 54);
              doc.setFontSize(9);
            }
          } else if (s.teacher_signature) {
            doc.text('Signature formateur: Signé', teacherSigX, yPos + 35);
          }
        }
        
        yPos += sessionHeight + 5;
      };
      
      // Afficher les séances effectuées/émargées
      if (completedSessions.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(34, 197, 94); // Vert
        doc.text(`SÉANCES EFFECTUÉES (${completedSessions.length})`, 14, yPos);
        yPos += 8;
        
        for (const s of completedSessions) {
          renderSession(s, false);
        }
      }
      
      // Afficher les séances à venir
      if (upcomingSessions.length > 0) {
        // Nouvelle page si nécessaire
        if (yPos > pageHeight - 100) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(59, 130, 246); // Bleu
        doc.text(`SÉANCES À VENIR (${upcomingSessions.length})`, 14, yPos);
        yPos += 8;
        
        for (const s of upcomingSessions) {
          renderSession(s, true);
        }
      }
      
      // Pied de page sur toutes les pages
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i}/${pageCount} - TerciForm - Document généré le ${new Date().toLocaleString('fr-FR')}`, 
          pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      // Téléchargement direct
      const fileName = `planning_${student.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success(`PDF téléchargé: ${fileName}`);
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  // Export PDF d'une séance individuelle (téléchargement direct)
  const exportSessionPDF = (session) => {
    const student = students.find(s => s.id === session.student_id);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Logo TerciForm
      doc.setFillColor(13, 32, 64);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('TERCIFORM', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Formation Professionnelle', pageWidth / 2, 21, { align: 'center' });
      
      // Titre
      doc.setTextColor(13, 32, 64);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`Feuille d'émargement - Séance du ${session.date}`, 14, 40);
      
      // Informations de la séance
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      let yPos = 55;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Informations de la séance', 14, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 8;
      doc.text(`Élève: ${student?.name || 'N/A'}`, 14, yPos);
      doc.text(`Date: ${session.date}`, 14, yPos + 6);
      doc.text(`Horaires: ${session.start_time} - ${session.end_time}`, 14, yPos + 12);
      doc.text(`Durée: ${session.duration_hours}h`, 14, yPos + 18);
      doc.text(`Matière: ${session.subject || 'N/A'}`, 14, yPos + 24);
      doc.text(`Modalité: ${session.modality === 'distanciel' ? 'Distanciel' : 'Présentiel'}`, 14, yPos + 30);
      
      // Section émargements ou statut absent
      yPos += 45;
      
      // Si l'élève est absent
      if (session.is_absent) {
        doc.setFillColor(254, 226, 226); // Rouge clair
        doc.rect(14, yPos, pageWidth - 28, 40, 'F');
        doc.setDrawColor(220, 38, 38);
        doc.rect(14, yPos, pageWidth - 28, 40, 'S');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(220, 38, 38);
        doc.text('ÉLÈVE ABSENT DE LA SÉANCE', pageWidth / 2, yPos + 20, { align: 'center' });
        
        if (session.absent_marked_at) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(`Marqué absent le: ${formatSignedAt(session.absent_marked_at)}`, pageWidth / 2, yPos + 30, { align: 'center' });
        }
      } else {
        doc.setFont('helvetica', 'bold');
        doc.text('Émargements', 14, yPos);
        
        // Signature élève
        yPos += 10;
        doc.setFillColor(240, 253, 244); // bg-green-50
        doc.rect(14, yPos, 85, 50, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, yPos, 85, 50, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Signature Élève:', 18, yPos + 8);
        doc.setFont('helvetica', 'normal');
        
        if (session.signature && session.signature.startsWith('data:image')) {
          try {
            doc.addImage(session.signature, 'PNG', 18, yPos + 12, 70, 25);
          } catch (e) {
            doc.text('✓ Signé', 18, yPos + 20);
          }
          if (session.signed_at) {
            doc.setFontSize(7);
            doc.text(`Horodatage: ${formatSignedAt(session.signed_at)}`, 18, yPos + 45);
          }
        } else if (session.signature) {
          doc.text('✓ Signé', 18, yPos + 20);
          if (session.signed_at) {
            doc.setFontSize(8);
            doc.text(`Horodatage: ${formatSignedAt(session.signed_at)}`, 18, yPos + 30);
          }
        } else {
          doc.text('Non signé', 18, yPos + 20);
        }
        
        // Signature formateur
        doc.setFillColor(250, 245, 255); // bg-purple-50
        doc.rect(105, yPos, 85, 50, 'F');
        doc.rect(105, yPos, 85, 50, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Signature Formateur:', 109, yPos + 8);
        doc.setFont('helvetica', 'normal');
        
        if (session.teacher_signature && session.teacher_signature.startsWith('data:image')) {
          try {
            doc.addImage(session.teacher_signature, 'PNG', 109, yPos + 12, 70, 25);
          } catch (e) {
            doc.text('✓ Signé', 109, yPos + 20);
          }
          if (session.teacher_signed_at) {
            doc.setFontSize(7);
            doc.text(`Horodatage: ${formatSignedAt(session.teacher_signed_at)}`, 109, yPos + 45);
          }
        } else if (session.teacher_signature) {
          doc.text('✓ Signé', 109, yPos + 20);
          if (session.teacher_signed_at) {
            doc.setFontSize(8);
            doc.text(`Horodatage: ${formatSignedAt(session.teacher_signed_at)}`, 109, yPos + 30);
          }
        } else {
          doc.text('Non signé', 109, yPos + 20);
        }
      }
      
      // Pied de page
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`TerciForm - Document généré le ${new Date().toLocaleString('fr-FR')}`, 
        pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      
      // Téléchargement direct
      const fileName = `emargement_seance_${session.date}_${student?.name?.replace(/\s+/g, '_') || 'eleve'}.pdf`;
      doc.save(fileName);
      toast.success(`PDF téléchargé: ${fileName}`);
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    }
  };

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

      {/* Bandeau de diagnostic - visible pour identifier les problèmes de données */}
      {debugInfo && (
        <div className="bg-yellow-100 border-b-2 border-yellow-400 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-6">
                <span className="font-semibold text-yellow-800">🔍 Diagnostic Production:</span>
                <span>Client ID: <strong>{debugInfo.gestionnaire?.client_id || 'NON DÉFINI'}</strong></span>
                <span>Centre: <strong>{debugInfo.client?.nom_centre || 'NON TROUVÉ'}</strong></span>
                <span>Élèves trouvés: <strong className="text-blue-600">{debugInfo.students_count}</strong></span>
                <span>Séances: <strong className="text-green-600">{debugInfo.sessions_count}</strong></span>
              </div>
              {debugInfo.gestionnaire?.client_id === 'NON DÉFINI' && (
                <span className="text-red-600 font-bold">⚠️ Gestionnaire non lié !</span>
              )}
            </div>
            {/* Infos supplémentaires */}
            <div className="text-xs text-yellow-700 space-y-1">
              <div>📊 Étudiants avec "zepartner" dans organisme: <strong>{debugInfo.students_with_zepartner || 0}</strong></div>
              {debugInfo.all_organisms && debugInfo.all_organisms.length > 0 && (
                <div>📋 Organismes existants: {debugInfo.all_organisms.slice(0, 10).join(', ')}</div>
              )}
              {debugInfo.search_pattern && (
                <div>🔎 Recherche: "{debugInfo.search_pattern}"</div>
              )}
            </div>
          </div>
        </div>
      )}

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
              <h2 className="text-xl font-bold text-gray-800">Élèves actifs ({activeStudents.length})</h2>
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
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Nouvel Élève</DialogTitle>
                      <DialogDescription>Créer un compte élève pour {client?.nom_centre}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateStudent} className="space-y-4">
                      {/* Informations de base */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nom complet *</Label>
                          <Input placeholder="ex: Jean Dupont" value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Numéro de téléphone</Label>
                          <Input placeholder="ex: 06 12 34 56 78" value={studentForm.phone} onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input type="email" placeholder="jean.dupont@email.com" value={studentForm.email} onChange={(e) => setStudentForm({...studentForm, email: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Mot de passe *</Label>
                          <Input type="password" placeholder="••••••••" value={studentForm.password} onChange={(e) => setStudentForm({...studentForm, password: e.target.value})} required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Organisme de formation</Label>
                          <Input placeholder="ex: Pôle Emploi" value={studentForm.organism} onChange={(e) => setStudentForm({...studentForm, organism: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Prise en charge parcours</Label>
                          <Input placeholder="ex: CPF" value={studentForm.support_type} onChange={(e) => setStudentForm({...studentForm, support_type: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
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
                      </div>
                      
                      {/* BLOC : Sélection du formateur */}
                      <div className="p-4 border-2 border-amber-200 rounded-lg bg-amber-50 space-y-3">
                        <h4 className="font-bold text-amber-900 flex items-center gap-2">
                          <PenTool className="w-5 h-5" />
                          Assigner un formateur
                        </h4>
                        <p className="text-sm text-gray-600">Sélectionnez le formateur qui sera en charge de cet élève.</p>
                        
                        <div className="space-y-2">
                          <Label className="text-amber-700">Formateur référent</Label>
                          <select 
                            value={studentForm.formateur_id}
                            onChange={(e) => setStudentForm({...studentForm, formateur_id: e.target.value})}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                          >
                            <option value="">-- Sélectionner un formateur --</option>
                            {formateurs.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.prenom} {f.nom} {f.matieres?.length > 0 ? `(${f.matieres.join(', ')})` : ''} - {f.email}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Aperçu du formateur sélectionné */}
                        {studentForm.formateur_id && (() => {
                          const selectedFormateur = formateurs.find(f => f.id === studentForm.formateur_id);
                          if (!selectedFormateur) return null;
                          return (
                            <div className="p-3 bg-white border border-amber-200 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {selectedFormateur.photo_url ? (
                                    <img src={`${process.env.REACT_APP_BACKEND_URL}${selectedFormateur.photo_url}`} alt={selectedFormateur.nom} className="w-full h-full object-cover" />
                                  ) : (
                                    <PenTool className="w-6 h-6 text-amber-600" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold">{selectedFormateur.prenom} {selectedFormateur.nom}</p>
                                  <p className="text-sm text-gray-500">{selectedFormateur.email}</p>
                                  {selectedFormateur.matieres?.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                      {selectedFormateur.matieres.map(m => (
                                        <span key={m} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{m}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* BLOC : Tests de parcours */}
                      <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50 space-y-3">
                        <h4 className="font-bold text-blue-900">🟦 Tests de parcours</h4>
                        <p className="text-sm text-gray-700">Souhaitez-vous introduire les tests du parcours « {studentForm.parcours} » ?</p>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="includeTests" checked={includeTests === true} onChange={() => setIncludeTests(true)} />
                            <span>Oui</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
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

                      {/* BLOC : Questionnaires Qualiopi */}
                      <div className="p-4 border-2 border-yellow-200 rounded-lg bg-yellow-50 space-y-3">
                        <h4 className="font-bold text-yellow-900">🟨 Questionnaires Qualiopi</h4>
                        <p className="text-sm text-gray-700">Souhaitez-vous introduire les questionnaires pour le parcours « {studentForm.parcours} » ?</p>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="includeQuestionnaires" checked={includeQuestionnaires === true} onChange={() => setIncludeQuestionnaires(true)} />
                            <span>Oui</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="includeQuestionnaires" checked={includeQuestionnaires === false} onChange={() => setIncludeQuestionnaires(false)} />
                            <span>Non</span>
                          </label>
                        </div>
                        
                        {includeQuestionnaires && (
                          <div className="space-y-3 mt-3 pl-4 border-l-4 border-yellow-300">
                            <div className="space-y-2">
                              <Label className="text-sm">Q1 - Questionnaire à froid</Label>
                              <select 
                                value={selectedQuestionnaires.froid}
                                onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, froid: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              >
                                <option value="">-- Choisir un modèle --</option>
                                {questionnaireModels[studentForm.parcours]?.froid.map(model => (
                                  <option key={model} value={model}>{model}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Q2 - Questionnaire à chaud</Label>
                              <select 
                                value={selectedQuestionnaires.chaud}
                                onChange={(e) => setSelectedQuestionnaires({...selectedQuestionnaires, chaud: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              >
                                <option value="">-- Choisir un modèle --</option>
                                {questionnaireModels[studentForm.parcours]?.chaud.map(model => (
                                  <option key={model} value={model}>{model}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
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
                          {availableExitMonths.map(month => (
                            <option key={month} value={month}>{monthNames[parseInt(month)]}</option>
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
                {(filteredStudents || activeStudents).map(student => {
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
                                  <p className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>{student.credit_hours !== undefined ? student.credit_hours : student.total_hours || 0}h</p>
                                </div>
                                <button
                                  onClick={() => exportStudentAttendancePDF(student)}
                                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors shadow-md"
                                  title="Télécharger le planning de l'élève en PDF"
                                >
                                  <Download className="w-4 h-4" />
                                  Télécharger planning élève PDF
                                </button>
                              </div>
                              
                              {/* Séances de l'élève */}
                              {(() => {
                                const today = new Date().toISOString().split('T')[0];
                                const studentSessions = sessions.filter(s => s.student_id === student.id);
                                const completedSessions = studentSessions
                                  .filter(s => s.date < today || (s.signature || s.teacher_signature) || s.is_absent)
                                  .sort((a, b) => new Date(b.date) - new Date(a.date));
                                const upcomingSessions = studentSessions
                                  .filter(s => s.date >= today && !s.signature && !s.teacher_signature && !s.is_absent)
                                  .sort((a, b) => new Date(a.date) - new Date(b.date));
                                
                                // Fonction pour marquer absent
                                const handleMarkAbsent = async (sessionId) => {
                                  try {
                                    await axios.patch(`${API}/sessions/${sessionId}/mark-absent`);
                                    toast.success('Statut de présence mis à jour');
                                    loadData();
                                  } catch (error) {
                                    toast.error('Erreur lors de la mise à jour');
                                  }
                                };
                                
                                return (
                                  <div className="mt-4 space-y-3">
                                    {/* Séances effectuées */}
                                    <details className="group">
                                      <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800">
                                        <CheckCircle className="w-4 h-4" />
                                        Séances effectuées ({completedSessions.length})
                                        <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                                      </summary>
                                      {completedSessions.length > 0 ? (
                                        <div className="mt-2 space-y-1 pl-6 max-h-40 overflow-y-auto">
                                          {completedSessions.map(s => (
                                            <div key={s.id} className={`flex items-center justify-between text-xs p-2 rounded border ${s.is_absent ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
                                              <span className="font-medium">{s.date}</span>
                                              <span>{s.start_time} - {s.end_time}</span>
                                              <span className={s.is_absent ? 'text-red-600' : 'text-green-600'}>{s.duration_hours}h</span>
                                              {s.is_absent ? (
                                                <span className="text-red-600 font-medium">Élève absent de la séance</span>
                                              ) : (s.signature || s.teacher_signature) ? (
                                                <span className="text-green-700 font-medium flex items-center gap-1">
                                                  <CheckCircle className="w-3 h-3" />
                                                  {s.signed_at ? formatSignedAt(s.signed_at) : 'Émargée'}
                                                </span>
                                              ) : null}
                                              {/* Bouton Absent rond */}
                                              <button
                                                onClick={() => handleMarkAbsent(s.id)}
                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                  s.is_absent 
                                                    ? 'bg-red-500 text-white hover:bg-red-600' 
                                                    : 'bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600'
                                                }`}
                                                title={s.is_absent ? 'Annuler absence' : 'Marquer absent'}
                                              >
                                                {s.is_absent ? '✓' : 'A'}
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-gray-500 mt-2 pl-6">Aucune séance effectuée</p>
                                      )}
                                    </details>
                                    
                                    {/* Séances à venir */}
                                    <details className="group">
                                      <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800">
                                        <Calendar className="w-4 h-4" />
                                        Séances à venir ({upcomingSessions.length})
                                        <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                                      </summary>
                                      {upcomingSessions.length > 0 ? (
                                        <div className="mt-2 space-y-1 pl-6 max-h-40 overflow-y-auto">
                                          {upcomingSessions.map(s => (
                                            <div key={s.id} className="flex items-center justify-between text-xs p-2 bg-blue-50 rounded border border-blue-100">
                                              <span className="font-medium">{s.date}</span>
                                              <span>{s.start_time} - {s.end_time}</span>
                                              <span className="text-blue-600">{s.duration_hours}h</span>
                                              <span className="text-blue-700">{s.modality === 'distanciel' ? '📹 Distanciel' : '📍 Présentiel'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-gray-500 mt-2 pl-6">Aucune séance planifiée</p>
                                      )}
                                    </details>
                                  </div>
                                );
                              })()}
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
            {/* En-tête avec résumé */}
            <div className="p-4 bg-white rounded-2xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Séances de {client?.nom_centre || 'votre centre'}</h2>
                <p className="text-sm text-gray-500">Semaine du {weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au {weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">{todaySessions.length}</div>
                  <div className="text-sm text-green-700">Aujourd'hui</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">{weekSessions.length}</div>
                  <div className="text-sm text-blue-700">Cette semaine</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-3xl font-bold text-gray-600">{sessions.length}</div>
                  <div className="text-sm text-gray-700">Total</div>
                </div>
              </div>
            </div>

            {/* Séances du jour */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Séances du jour - {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
              </div>
              {todaySessions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  Aucune séance aujourd'hui
                </div>
              ) : (
                <div className="divide-y">
                  {todaySessions.map(session => {
                    const student = students.find(s => s.id === session.student_id);
                    return (
                      <div key={session.id} className="p-4 hover:bg-green-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center px-4 py-2 bg-green-100 rounded-lg">
                              <div className="text-lg font-bold text-green-700">{session.start_time}</div>
                              <div className="text-xs text-green-600">{session.end_time}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{student?.name || 'Élève'}</div>
                              <div className="text-sm text-gray-500">{session.subject} • {session.duration_hours}h</div>
                              {session.modality && (
                                <span className={`text-xs px-2 py-0.5 rounded ${session.modality === 'distanciel' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {session.modality === 'distanciel' ? 'Distanciel' : 'Présentiel'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {session.signature || session.teacher_signature ? (
                              <div className="flex flex-col gap-1">
                                {session.signature && (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    <img src={session.signature} alt="Signature élève" className="h-6 object-contain" />
                                    {session.signed_at && (
                                      <span className="text-xs text-green-600 ml-1">
                                        {formatSignedAt(session.signed_at)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {session.teacher_signature && (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    <img src={session.teacher_signature} alt="Signature formateur" className="h-6 object-contain" />
                                    {session.teacher_signed_at && (
                                      <span className="text-xs text-purple-600 ml-1">
                                        {formatSignedAt(session.teacher_signed_at)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                                <Clock className="w-4 h-4" />
                                En attente
                              </span>
                            )}
                            <Button variant="outline" size="sm" onClick={() => { setSelectedSession(session); setShowSessionDetail(true); }} title="Voir les détails">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(session.signature || session.teacher_signature) && (
                              <Button variant="outline" size="sm" onClick={() => exportSessionPDF(session)} title="Exporter en PDF">
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Séances de la semaine */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Autres séances de la semaine
                </h3>
              </div>
              {weekSessions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  Aucune autre séance cette semaine
                </div>
              ) : (
                <div className="divide-y">
                  {weekSessions.map(session => {
                    const student = students.find(s => s.id === session.student_id);
                    const sessionDate = new Date(session.date);
                    const isPast = session.date < today.toISOString().split('T')[0];
                    return (
                      <div key={session.id} className={`p-4 hover:bg-blue-50 transition-colors ${isPast ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`text-center px-3 py-2 rounded-lg min-w-[80px] ${isPast ? 'bg-gray-100' : 'bg-blue-100'}`}>
                              <div className={`text-xs ${isPast ? 'text-gray-500' : 'text-blue-600'}`}>
                                {sessionDate.toLocaleDateString('fr-FR', { weekday: 'short' })}
                              </div>
                              <div className={`text-xl font-bold ${isPast ? 'text-gray-600' : 'text-blue-700'}`}>
                                {sessionDate.getDate()}
                              </div>
                              <div className={`text-xs ${isPast ? 'text-gray-500' : 'text-blue-600'}`}>
                                {sessionDate.toLocaleDateString('fr-FR', { month: 'short' })}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{student?.name || 'Élève'}</div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                {session.start_time} - {session.end_time} • {session.subject} • {session.duration_hours}h
                              </div>
                              {session.modality && (
                                <span className={`text-xs px-2 py-0.5 rounded ${session.modality === 'distanciel' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {session.modality === 'distanciel' ? 'Distanciel' : 'Présentiel'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {session.signature || session.teacher_signature ? (
                              <div className="flex flex-col gap-1">
                                {session.signature && (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    <img src={session.signature} alt="Signature élève" className="h-6 object-contain" />
                                    {session.signed_at && (
                                      <span className="text-xs text-green-600 ml-1">
                                        {formatSignedAt(session.signed_at)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {session.teacher_signature && (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    <img src={session.teacher_signature} alt="Signature formateur" className="h-6 object-contain" />
                                    {session.teacher_signed_at && (
                                      <span className="text-xs text-purple-600 ml-1">
                                        {formatSignedAt(session.teacher_signed_at)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                                <Clock className="w-4 h-4" />
                                En attente
                              </span>
                            )}
                            <Button variant="outline" size="sm" onClick={() => { setSelectedSession(session); setShowSessionDetail(true); }} title="Voir les détails">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(session.signature || session.teacher_signature) && (
                              <Button variant="outline" size="sm" onClick={() => exportSessionPDF(session)} title="Exporter en PDF">
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historique complet (collapsible) */}
            <details className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <summary className="p-4 bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors font-semibold text-gray-700 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Voir toutes les séances ({sessions.length})
              </summary>
              <div className="divide-y max-h-96 overflow-y-auto">
                {sortedSessions.map(session => {
                  const student = students.find(s => s.id === session.student_id);
                  const isToday = session.date === today.toISOString().split('T')[0];
                  const isPast = session.date < today.toISOString().split('T')[0];
                  
                  return (
                    <div key={session.id} className={`p-4 hover:bg-gray-50 transition-colors ${isPast && !isToday ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`text-center px-3 py-2 rounded-lg min-w-[80px] ${isToday ? 'bg-green-100' : isPast ? 'bg-gray-100' : 'bg-blue-100'}`}>
                            <div className="text-xs text-gray-500">
                              {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                            </div>
                            <div className={`text-xl font-bold ${isToday ? 'text-green-700' : isPast ? 'text-gray-600' : 'text-blue-700'}`}>
                              {new Date(session.date).getDate()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(session.date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{student?.name || 'Élève'}</div>
                            <div className="text-sm text-gray-500">
                              {session.start_time} - {session.end_time} • {session.subject} • {session.duration_hours}h
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.signature ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-orange-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
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
                <p className="text-gray-500 text-lg">Aucun formateur assigné pour le moment</p>
                <p className="text-gray-400 text-sm mt-2">Les demandes de vos formateurs apparaîtront ici</p>
                
                {/* Bouton pour accéder aux demandes même sans formateur */}
                <button
                  onClick={() => {
                    setShowTicketingModal(true);
                    if (client?.id) markTicketsAsRead(client.id);
                  }}
                  className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2 relative"
                  data-testid="ticketing-access-btn"
                >
                  <MessageSquare className="w-5 h-5" />
                  Voir les demandes en cours
                  {/* Puce de notification */}
                  {unreadTicketCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-xs animate-pulse">
                      {unreadTicketCount}
                    </span>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Liste des formateurs avec bandeau à côté de chaque carte */}
                {formateurs.map(formateur => (
                  <div 
                    key={formateur.id} 
                    className="flex gap-6 items-stretch"
                    data-testid={`formateur-row-${formateur.id}`}
                  >
                    {/* Fiche Formateur */}
                    <div className="w-[400px] flex-shrink-0 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow">
                      {/* En-tête de la fiche */}
                      <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden flex-shrink-0">
                            {formateur.photo_url ? (
                              <img 
                                src={`${process.env.REACT_APP_BACKEND_URL}${formateur.photo_url}`}
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
                      </div>
                    </div>

                    {/* Bandeau d'échange à côté de la carte formateur */}
                    <div 
                      onClick={() => {
                        setShowTicketingModal(true);
                        if (client?.id) markTicketsAsRead(client.id);
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl hover:scale-[1.01] transition-all flex flex-col justify-between relative"
                      data-testid={`ticketing-banner-${formateur.id}`}
                    >
                      {/* Puce de notification rouge */}
                      {unreadTicketCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg animate-pulse">
                          {unreadTicketCount}
                        </div>
                      )}
                      
                      <div className="flex flex-col items-center text-center">
                        <div className="p-4 bg-white/20 rounded-xl mb-4">
                          <MessageSquare className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Échanger avec {formateur.prenom}</h3>
                        <p className="text-blue-200 text-sm mb-6">Gérez les demandes de ce formateur</p>
                        
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

          {/* ===== ONGLET FIDÉLITÉ ===== */}
          <TabsContent value="fidelite" className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <Gift className="w-20 h-20 mx-auto text-pink-200 mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Programme de Fidélité</h2>
              <p className="text-gray-500 mb-4 text-lg">
                Votre programme de fidélité bientôt disponible !
              </p>
              <p className="text-sm text-gray-400">
                Gagnez des points et profitez d&apos;avantages exclusifs.
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
                <p className="text-sm text-gray-500 mb-2">Statut d'émargement</p>
                {selectedSession.signature || selectedSession.teacher_signature ? (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
                    {selectedSession.signature && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <p className="text-green-700 font-medium flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Signature élève:
                          </p>
                          <img src={selectedSession.signature} alt="Signature élève" className="h-12 object-contain border rounded p-1 bg-white" />
                        </div>
                        {selectedSession.signed_at && (
                          <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                            📅 {formatSignedAt(selectedSession.signed_at)}
                          </span>
                        )}
                      </div>
                    )}
                    {selectedSession.teacher_signature && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <p className="text-purple-700 font-medium flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Signature formateur:
                          </p>
                          <img src={selectedSession.teacher_signature} alt="Signature formateur" className="h-12 object-contain border rounded p-1 bg-white" />
                        </div>
                        {selectedSession.teacher_signed_at && (
                          <span className="text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded">
                            📅 {formatSignedAt(selectedSession.teacher_signed_at)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-orange-700 font-medium flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      En attente d&apos;émargement
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-between">
            <div>
              {(selectedSession?.signature || selectedSession?.teacher_signature) && (
                <Button variant="outline" onClick={() => exportSessionPDF(selectedSession)}>
                  <Download className="w-4 h-4 mr-2" />
                  Exporter PDF
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setShowSessionDetail(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ticketing - Mes demandes centre */}
      <TicketingModal
        open={showTicketingModal}
        onClose={() => setShowTicketingModal(false)}
        userRole="gestionnaire"
        userId={user?.id}
        clientId={user?.client_id}
      />
    </div>
  );
}
