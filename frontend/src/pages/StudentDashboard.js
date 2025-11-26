import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LogOut, BookOpen, MessageSquare, Download, FileText, TrendingUp, CheckCircle } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import FormationNeedsQuestionnaire from "@/components/FormationNeedsQuestionnaire";
import MidCourseQuestionnaire from "@/components/MidCourseQuestionnaire";
import EndCourseQuestionnaire from "@/components/EndCourseQuestionnaire";
import BureautiqueFormationNeedsQuestionnaire from "@/components/BureautiqueFormationNeedsQuestionnaire";
import BureautiqueMidCourseQuestionnaire from "@/components/BureautiqueMidCourseQuestionnaire";
import BureautiqueEndCourseQuestionnaire from "@/components/BureautiqueEndCourseQuestionnaire";
import DynamicQuestionnaire from "@/components/DynamicQuestionnaire";
import InformatiqueFormationNeedsQuestionnaire from "@/components/InformatiqueFormationNeedsQuestionnaire";
import InformatiqueMidCourseQuestionnaire from "@/components/InformatiqueMidCourseQuestionnaire";
import InformatiqueEndCourseQuestionnaire from "@/components/InformatiqueEndCourseQuestionnaire";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TERCIFORM_BLUE = '#0D2040';

export default function StudentDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('formation');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNeedsDialog, setShowNeedsDialog] = useState(false);
  const [showMidCourseDialog, setShowMidCourseDialog] = useState(false);
  const [showEndCourseDialog, setShowEndCourseDialog] = useState(false);
  const [activeQuestionnaire, setActiveQuestionnaire] = useState(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  
  // États pour les questionnaires soumis
  const [formationNeedsSubmitted, setFormationNeedsSubmitted] = useState(false);
  const [midCourseSubmitted, setMidCourseSubmitted] = useState(false);
  const [endCourseSubmitted, setEndCourseSubmitted] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [currentSessionToSign, setCurrentSessionToSign] = useState(null);
  const [studentResources, setStudentResources] = useState([]);
  
  // Contact Teacher state
  const [showContactTeacherDialog, setShowContactTeacherDialog] = useState(false);
  const [contactTeacher, setContactTeacher] = useState({
    subject: '',
    message: ''
  });

  // Training Needs state
  const [trainingNeeds, setTrainingNeeds] = useState({
    expectations: '',
    strengths: '',
    improvements: '',
    availability: ''
  });

  // Feedback state
  const [feedback, setFeedback] = useState({
    quality_rating: '',
    teacher_support: '',
    recommendation: ''
  });

  useEffect(() => {
    loadSessions();
    loadTrainingNeeds();
    loadQuestionnairesStatus();
    loadStudentResources();
  }, []);

  const loadStudentResources = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/students/${user.id}/resources`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudentResources(response.data.resources || []);
    } catch (error) {
      console.error('Erreur lors du chargement des ressources:', error);
    }
  };

  const loadQuestionnairesStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Déterminer les endpoints selon le parcours
      const isBureautique = user?.parcours === "Bureautique";
      const q1Endpoint = isBureautique ? 'bureautique-formation-needs' : 'formation-needs';
      const q2Endpoint = isBureautique ? 'bureautique-mid-course-questionnaire' : 'mid-course-questionnaire';
      const q3Endpoint = isBureautique ? 'bureautique-end-course-questionnaire' : 'end-course-questionnaire';
      
      // Vérifier questionnaire de besoins
      const formationNeedsRes = await axios.get(`${API}/students/${user.id}/${q1Endpoint}`, { headers });
      setFormationNeedsSubmitted(formationNeedsRes.data.exists);
      
      // Vérifier questionnaire mi-parcours
      const midCourseRes = await axios.get(`${API}/students/${user.id}/${q2Endpoint}`, { headers });
      setMidCourseSubmitted(midCourseRes.data.exists);
      
      // Vérifier questionnaire fin de formation
      const endCourseRes = await axios.get(`${API}/students/${user.id}/${q3Endpoint}`, { headers });
      setEndCourseSubmitted(endCourseRes.data.exists);
    } catch (error) {
      console.error("Erreur lors du chargement du statut des questionnaires");
    }
  };

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${API}/sessions`);
      setSessions(response.data);
    } catch (error) {
      toast.error("Erreur lors du chargement des séances");
    } finally {
      setLoading(false);
    }
  };

  const loadTrainingNeeds = async () => {
    try {
      const response = await axios.get(`${API}/students/${user.id}/training-needs`);
      if (response.data) {
        setTrainingNeeds({
          expectations: response.data.expectations || '',
          strengths: response.data.strengths || '',
          improvements: response.data.improvements || '',
          availability: response.data.availability || ''
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement des besoins");
    }
  };

  const saveTrainingNeeds = async () => {
    try {
      await axios.post(`${API}/students/${user.id}/training-needs`, trainingNeeds);
      toast.success("Besoins en formation sauvegardés !");
      setShowNeedsDialog(false);
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const submitFeedback = async () => {
    if (!feedback.quality_rating || !feedback.teacher_support || !feedback.recommendation) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      const response = await axios.post(`${API}/students/${user.id}/feedback`, feedback);
      toast.success("Avis soumis avec succès ! PDF généré.");
      setShowFeedbackDialog(false);
      setFeedback({ quality_rating: '', teacher_support: '', recommendation: '' });
      
      if (response.data.feedback_id) {
        downloadFeedbackPDF(response.data.feedback_id);
      }
    } catch (error) {
      toast.error("Erreur lors de la soumission de l'avis");
    }
  };

  const downloadPlanningPDF = async () => {
    try {
      const response = await axios.get(`${API}/students/${user.id}/download-planning-pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `planning_${user.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Planning téléchargé !");
    } catch (error) {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const downloadFeedbackPDF = async (feedbackId) => {
    try {
      const response = await axios.get(`${API}/students/${user.id}/download-feedback-pdf/${feedbackId}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `avis_${user.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error("Erreur lors du téléchargement du PDF");
    }
  };

  const confirmPresence = async (sessionId) => {
    try {
      await axios.patch(`${API}/sessions/${sessionId}/confirm-by-student`);
      toast.success("Séance confirmée !");
      loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de la confirmation");
    }
  };

  // Signature functions
  const openSignatureDialog = (session) => {
    setCurrentSessionToSign(session);
    setShowSignatureDialog(true);
  };

  const saveSignature = async (signatureDataURL) => {
    try {
      await axios.post(`${API}/sessions/${currentSessionToSign.id}/sign`, {
        signature: signatureDataURL
      });
      toast.success("Signature enregistrée !");
      setShowSignatureDialog(false);
      loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de l'enregistrement");
    }
  };

  // Contact Teacher function
  const handleContactTeacher = async (e) => {
    e.preventDefault();
    
    if (!contactTeacher.subject.trim() || !contactTeacher.message.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/students/${user.id}/contact-teacher`,
        {
          subject: contactTeacher.subject,
          message: contactTeacher.message
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Votre message a été envoyé avec succès !");
      setShowContactTeacherDialog(false);
      setContactTeacher({ subject: '', message: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de l'envoi du message");
    }
  };

  const formatFrDate = (dateStr) => {
    const daysFr = {
      'Monday': 'lundi', 'Tuesday': 'mardi', 'Wednesday': 'mercredi',
      'Thursday': 'jeudi', 'Friday': 'vendredi', 'Saturday': 'samedi', 'Sunday': 'dimanche'
    };
    try {
      const date = new Date(dateStr);
      const dayName = daysFr[date.toLocaleDateString('en-US', { weekday: 'long' })] || date.toLocaleDateString('fr-FR', { weekday: 'long' });
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${dayName} ${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatFrDateTime = (dateTimeStr) => {
    try {
      const dt = new Date(dateTimeStr);
      return formatFrDate(dt.toISOString().split('T')[0]) + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateTimeStr;
    }
  };

  const isSessionStarted = (session) => {
    const now = new Date();
    const sessionDateTime = new Date(`${session.date}T${session.start_time}`);
    return now >= sessionDateTime;
  };

  const isSessionEnded = (session) => {
    const now = new Date();
    const sessionDateTime = new Date(`${session.date}T${session.end_time}`);
    return now >= sessionDateTime;
  };

  const getConfirmationCell = (session) => {
    // Si confirmé par l'élève, afficher badge vert avec date
    if (session.confirmed_by_student && session.confirmed_by_student_at) {
      const confirmDate = formatFrDateTime(session.confirmed_by_student_at);
      return (
        <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm bg-green-100 text-green-800 border border-green-300">
          <CheckCircle size={16} className="mr-1" />
          Confirmée le {confirmDate}
        </span>
      );
    }

    // Si déjà signé (donc auto-confirmé)
    if (session.signature_status === 'signed') {
      return (
        <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm bg-green-100 text-green-800 border border-green-300">
          <CheckCircle size={16} className="mr-1" />
          Confirmée (émargé)
        </span>
      );
    }

    // Sinon, afficher le bouton de confirmation
    return (
      <div className="flex flex-col gap-1">
        <Button
          onClick={() => confirmPresence(session.id)}
          className="bg-blue-600 text-white w-full py-2 rounded-md font-medium hover:bg-blue-700"
        >
          Confirmer la séance
        </Button>
        <p className="mt-1 text-xs text-gray-500 text-center">
          Clique ici pour indiquer ta présence
        </p>
      </div>
    );
  };

  const getSignatureEleveCell = (session) => {
    if (session.signature_status === 'signed' && session.signature) {
      const signDate = session.signed_at ? formatFrDateTime(session.signed_at) : '';
      return (
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 border border-green-300 text-sm px-3 py-1 rounded-md">
            <CheckCircle size={16} />
            <span>Signé</span>
            {session.signature && (
              <img 
                src={session.signature} 
                alt="Signature élève" 
                style={{ maxHeight: '24px', objectFit: 'contain', marginLeft: '8px' }}
              />
            )}
          </div>
          <span className="text-xs text-gray-600">Émargé le {signDate} — par l'élève</span>
        </div>
      );
    }

    if (session.signature_status === 'pending') {
      return (
        <Button
          onClick={() => openSignatureDialog(session)}
          className="w-full py-2 rounded-md text-sm font-medium"
          style={{ backgroundColor: '#ff9800', color: 'white' }}
        >
          Vous pouvez émarger votre séance
        </Button>
      );
    }

    return <span className="text-gray-500 text-xs">À signer après la séance</span>;
  };

  const getSignatureFormateurCell = (session) => {
    if (session.teacher_signature_status === 'signed' && session.teacher_signature) {
      const signDate = session.teacher_signed_at ? formatFrDateTime(session.teacher_signed_at) : '';
      return (
        <div className="flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 border border-purple-300 text-sm px-3 py-1 rounded-md">
            <CheckCircle size={16} />
            <span>Signé</span>
            {session.teacher_signature && (
              <img 
                src={session.teacher_signature} 
                alt="Signature formateur" 
                style={{ maxHeight: '24px', objectFit: 'contain', marginLeft: '8px' }}
              />
            )}
          </div>
          <span className="text-xs text-gray-600">Émargé le {signDate} — par le formateur</span>
        </div>
      );
    }

    return <span className="text-gray-500 text-xs">Non signé</span>;
  };

  // Calculate stats
  const totalHours = user.total_hours || 0;
  const remainingHours = user.credit_hours || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/logo_terciform.png" 
              alt="TerciForm" 
              className="h-12"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <div style={{display: 'none'}}>
              <h1 className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>TerciForm</h1>
              <p className="text-xs text-gray-600">Propulsez vos compétences</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold" style={{color: TERCIFORM_BLUE}}>{user.name}</p>
              <p className="text-sm text-gray-600">Espace Élève</p>
            </div>
            <Button variant="outline" onClick={onLogout} className="flex items-center gap-2">
              <LogOut size={16} /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Bandeau Parcours */}
        {user?.parcours && (
          <div className="mb-6 p-4 rounded-lg shadow-md text-center" style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
            <h2 className="text-2xl font-bold">
              Parcours : {user.parcours}
            </h2>
            <p className="text-sm mt-1 opacity-90">Votre programme de formation personnalisé</p>
          </div>
        )}

        {/* Tab Navigation - Large Colored Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setActiveTab('formation')}
            className={`p-6 rounded-lg shadow-md transition-all duration-200 text-left ${
              activeTab === 'formation'
                ? 'ring-2 ring-blue-500'
                : 'hover:shadow-lg'
            }`}
            style={{ backgroundColor: '#E6F0FF' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={28} style={{color: TERCIFORM_BLUE}} />
              <h2 className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>Ma formation</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Mon planning et mes émargements</p>
          </button>

          <button
            onClick={() => setActiveTab('parcours')}
            className={`p-6 rounded-lg shadow-md transition-all duration-200 text-left ${
              activeTab === 'parcours'
                ? 'ring-2 ring-green-500'
                : 'hover:shadow-lg'
            }`}
            style={{ backgroundColor: '#E9F8EF' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={28} style={{color: TERCIFORM_BLUE}} />
              <h2 className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>Mon parcours</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Mes tests et mes ressources pédagogiques</p>
          </button>

          <button
            onClick={() => setActiveTab('avis')}
            className={`p-6 rounded-lg shadow-md transition-all duration-200 text-left ${
              activeTab === 'avis'
                ? 'ring-2 ring-pink-500'
                : 'hover:shadow-lg'
            }`}
            style={{ backgroundColor: '#FDE7F3' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare size={28} style={{color: TERCIFORM_BLUE}} />
              <h2 className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>Mes objectifs</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Mes besoins et mon expérience de formation</p>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'formation' && (
          <div className="space-y-6">
            {/* Nom de l'élève en GROS en haut à gauche */}
            <div className="mb-6">
              <h1 className="text-4xl font-bold" style={{color: TERCIFORM_BLUE}}>
                {user.name}
              </h1>
              <p className="text-gray-600 text-sm mt-1">{user.email}</p>
            </div>

            {/* Stats Cards avec GRANDES heures et icônes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
                  <div className="mb-3">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="#2763FF" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Total heures du parcours</p>
                  <p className="text-6xl font-extrabold" style={{color: TERCIFORM_BLUE}}>{totalHours}h</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
                <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
                  <div className="mb-3">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="#16A34A" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Heures restantes</p>
                  <p className="text-6xl font-extrabold text-green-600">{remainingHours}h</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-2 border-blue-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base" style={{color: TERCIFORM_BLUE}}>
                    {user.teacher_name ? (user.teacher_name.toLowerCase().includes('mme') || user.teacher_name.toLowerCase().includes('mlle') || user.teacher_name.toLowerCase().includes('madame') ? 'Ma formatrice' : 'Mon formateur') : 'Mon formateur'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {user.teacher_name ? (
                    <>
                      <div className="flex items-center gap-4 mb-3">
                        <img 
                          src={user.profile_picture ? `${process.env.REACT_APP_BACKEND_URL}${user.profile_picture}` : `${process.env.REACT_APP_BACKEND_URL}/api/profile-pictures/homme_default.png`}
                          alt={user.teacher_name}
                          className="rounded-full object-cover border-3"
                          style={{width: '130px', height: '130px', borderColor: '#2763FF', borderWidth: '3px'}}
                          onError={(e) => {
                            e.target.src = `${process.env.REACT_APP_BACKEND_URL}/api/profile-pictures/homme_default.png`;
                          }}
                        />
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Mon formateur</p>
                          <p className="text-2xl font-bold" style={{color: '#1e2749'}}>{user.teacher_name}</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full text-sm" 
                        style={{borderColor: TERCIFORM_BLUE, color: TERCIFORM_BLUE}}
                        onClick={() => setShowContactTeacherDialog(true)}
                      >
                        <span className="mr-2">✉️</span>
                        Contacter mon formateur
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Non assigné</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sessions Table - Planning complet */}
            <Card className="shadow-lg border-2 border-blue-200">
              <CardHeader style={{backgroundColor: '#EEF4FF'}}>
                <CardTitle className="flex items-center gap-3" style={{color: TERCIFORM_BLUE}}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Planning complet
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-gray-500">Chargement...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">Aucune séance programmée</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Date</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Horaire</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Matière</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Confirmation</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Signature élève</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Signature formateur</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Durée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.sort((a, b) => new Date(a.date) - new Date(b.date)).map((session) => (
                          <tr key={session.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{formatFrDate(session.date)}</td>
                            <td className="p-3">{session.start_time} - {session.end_time}</td>
                            <td className="p-3">{session.subject}</td>
                            <td className="p-3">{getConfirmationCell(session)}</td>
                            <td className="p-3">{getSignatureEleveCell(session)}</td>
                            <td className="p-3">{getSignatureFormateurCell(session)}</td>
                            <td className="p-3">{session.duration_hours}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6">
                  <Button
                    onClick={downloadPlanningPDF}
                    className="w-full md:w-auto"
                    style={{backgroundColor: TERCIFORM_BLUE}}
                  >
                    <Download size={16} className="mr-2" />
                    Télécharger mon planning
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bandeau Mon lieu de formation - BLEU - JUSTE APRÈS Planning */}
            <Card className="shadow-lg border-2 border-blue-200">
              <CardHeader style={{backgroundColor: '#EEF4FF', borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem'}}>
                <CardTitle className="flex items-center gap-3" style={{color: '#2763FF'}}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Mon lieu de formation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {user.session_type === 'distanciel' ? (
                  <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-5xl">💻</div>
                    <div>
                      <p className="font-bold text-lg" style={{color: TERCIFORM_BLUE}}>À distance</p>
                      <p className="text-sm text-gray-600 mt-1">La formation se déroule intégralement en distanciel.</p>
                    </div>
                  </div>
                ) : user.session_type === 'présentiel' ? (
                  <div className="flex flex-col gap-3">
                    <p className="font-bold text-sm mb-0" style={{color: TERCIFORM_BLUE}}>En présentiel</p>
                    
                    {(user.formation_address || user.formation_city || user.formation_building) ? (
                      <div className="space-y-3">
                        {/* Adresse EN GROS */}
                        <p className="text-base font-semibold mb-3 text-gray-900 whitespace-pre-line" style={{lineHeight: '1.6'}}>
                          {[
                            user.formation_building,
                            [user.formation_street_number, user.formation_street].filter(Boolean).join(' '),
                            [user.formation_postal_code, user.formation_city].filter(Boolean).join(' ')
                          ]
                            .filter(Boolean)
                            .join('\n')}
                        </p>
                        
                        {/* Carte + Transports côte à côte */}
                        <div className="flex gap-4 items-start">
                          {/* Carte Google Maps */}
                          <div className="rounded-lg overflow-hidden border border-blue-200 shadow-sm" style={{height: '280px', width: '420px', flexShrink: 0}}>
                            <iframe
                              title="Localisation du lieu de formation"
                              width="100%"
                              height="100%"
                              style={{border: 0}}
                              loading="lazy"
                              allowFullScreen
                              src={`https://www.google.com/maps?q=${encodeURIComponent(
                                user.formation_address || 
                                [user.formation_building, user.formation_street_number, user.formation_street, user.formation_postal_code, user.formation_city]
                                  .filter(Boolean)
                                  .join(', ')
                              )}&output=embed`}
                            />
                          </div>
                          
                          {/* Bloc transports À DROITE en plus gros */}
                          {user.formation_transports && (
                            <div className="flex-1 p-4 rounded-xl border-2 shadow-sm" style={{backgroundColor: '#E5EDFF', borderColor: '#C0D0FF', minHeight: '280px'}}>
                              <div className="flex items-start gap-3 mb-3">
                                <span className="text-3xl">🚇</span>
                                <div>
                                  <p className="font-bold text-base mb-2" style={{color: '#2763FF'}}>
                                    Pour s'y rendre plus facilement
                                  </p>
                                </div>
                              </div>
                              <p className="text-base text-gray-800 whitespace-pre-line leading-relaxed">{user.formation_transports}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucune adresse n'a été renseignée pour le moment.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Mode de formation non défini.</p>
                )}
              </CardContent>
            </Card>

            {/* Mon livret d'accueil */}
            <Card className="shadow-lg border-2 border-blue-200">
              <CardHeader style={{backgroundColor: '#EEF4FF'}}>
                <CardTitle className="flex items-center gap-3" style={{color: TERCIFORM_BLUE}}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Mon livret d'accueil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <FileText size={48} className="text-gray-400" />
                  <div className="flex-1">
                    <p className="text-gray-600">Votre livret d'accueil personnalisé</p>
                    <p className="text-sm text-gray-500 mt-1">Document disponible prochainement</p>
                  </div>
                  <Button disabled variant="outline">
                    <Download size={16} className="mr-2" />
                    Télécharger PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Mon contrat de formation */}
            <Card className="shadow-lg border-2 border-blue-200">
              <CardHeader style={{backgroundColor: '#EEF4FF'}}>
                <CardTitle className="flex items-center gap-3" style={{color: TERCIFORM_BLUE}}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mon contrat de formation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <FileText size={48} className="text-gray-400" />
                  <div className="flex-1">
                    <p className="text-gray-600">Votre contrat de formation</p>
                    <p className="text-sm text-gray-500 mt-1">Document disponible prochainement</p>
                  </div>
                  <Button disabled variant="outline">
                    <Download size={16} className="mr-2" />
                    Télécharger PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'parcours' && (
          <div className="space-y-6">
            {studentResources.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="py-12">
                  <p className="text-center text-gray-500">
                    Aucun test ou ressource n'a été assigné pour le moment.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Bulle globale : Tests de positionnement */}
                {studentResources.filter(r => r.category === 'TEST_PARCOURS').length > 0 && (
                  <Card className="shadow-lg border-2 border-green-200">
                    <CardHeader style={{backgroundColor: '#E9F8EF'}}>
                      <CardTitle className="text-xl flex items-center gap-2" style={{color: TERCIFORM_BLUE}}>
                        <TrendingUp size={24} />
                        Tests de positionnement (T1, T2, T3)
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Évaluez votre progression tout au long du parcours
                      </p>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {studentResources
                          .filter(r => r.category === 'TEST_PARCOURS')
                          .sort((a, b) => {
                            const order = { 'POSITIONNEMENT': 1, 'MI_PARCOURS': 2, 'FIN_FORMATION': 3 };
                            return (order[a.sub_type] || 99) - (order[b.sub_type] || 99);
                          })
                          .map(resource => (
                            <div key={resource.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-base" style={{color: TERCIFORM_BLUE}}>
                                    {resource.sub_type === 'POSITIONNEMENT' ? '📝 T1 - Test de positionnement' : 
                                     resource.sub_type === 'MI_PARCOURS' ? '📊 T2 - Test à mi-parcours' : 
                                     '🎯 T3 - Test de fin de formation'}
                                  </h4>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {resource.template_name}
                                  </p>
                                </div>
                                <div className="text-right ml-4">
                                  {resource.status === 'SOUMIS' && (
                                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                      ✓ Terminé - {resource.score}%
                                    </div>
                                  )}
                                  {resource.status === 'EN_COURS' && (
                                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                      En cours
                                    </div>
                                  )}
                                  {resource.status === 'NON_COMMENCE' && (
                                    <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                                      Non commencé
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {resource.status === 'SOUMIS' ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <p className="text-green-800 font-medium text-sm">
                                    ✓ Test complété le {new Date(resource.submitted_at).toLocaleDateString('fr-FR')}
                                  </p>
                                  <p className="text-green-700 text-sm mt-1">
                                    Score obtenu : {resource.score}%
                                  </p>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => navigate(`/student/quiz/${resource.id}`)}
                                  style={{backgroundColor: TERCIFORM_BLUE}}
                                  className="w-full mt-2"
                                >
                                  <FileText size={16} className="mr-2" />
                                  {resource.status === 'EN_COURS' ? 'Continuer le test' : 'Commencer le test'}
                                </Button>
                              )}
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bulle : Mes ressources pédagogiques et mes supports */}
                <Card className="shadow-lg border-2 border-green-200">
                  <CardHeader style={{backgroundColor: '#E9F8EF'}}>
                    <CardTitle className="text-xl flex items-center gap-2" style={{color: TERCIFORM_BLUE}}>
                      <BookOpen size={24} />
                      Mes ressources pédagogiques et mes supports
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Documents, exercices et supports de cours
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen size={48} className="mx-auto mb-3 text-gray-300" />
                      <p>Aucune ressource pédagogique disponible pour le moment.</p>
                      <p className="text-sm mt-2">Vos supports de cours apparaîtront ici une fois téléchargés par votre formateur.</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {activeTab === 'avis' && (
          <div className="space-y-6">
            {/* Bandeau ROUGE : Mes besoins en formation */}
            <Card className="shadow-lg border-2 border-red-200">
              <CardHeader style={{backgroundColor: '#FDE7F3'}}>
                <CardTitle className="text-xl flex items-center gap-2" style={{color: TERCIFORM_BLUE}}>
                  <MessageSquare size={24} />
                  Mes besoins en formation
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Partagez vos attentes et objectifs de formation
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button 
                    onClick={() => !formationNeedsSubmitted && setShowNeedsDialog(true)} 
                    style={{backgroundColor: formationNeedsSubmitted ? '#22c55e' : '#0D2040', padding: '20px 24px'}}
                    className="w-full justify-between items-center text-base"
                    disabled={formationNeedsSubmitted}
                  >
                    <span className="text-base font-medium">1) Questionnaire de besoin en formation</span>
                    {formationNeedsSubmitted ? (
                      <span className="text-sm bg-white text-green-600 px-3 py-1.5 rounded-full font-semibold">✓ Validé</span>
                    ) : (
                      <span className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold">À valider</span>
                    )}
                  </Button>
                  <Button 
                    onClick={() => {
                      if (!midCourseSubmitted) {
                        if (user?.parcours === 'Informatique') {
                          const q2Resource = studentResources.find(r => r.category === 'QUESTIONNAIRE_QUALIOPI' && r.sub_type === 'MI_PARCOURS');
                          if (q2Resource) {
                            setActiveQuestionnaire({ resourceId: q2Resource.id, templateId: q2Resource.template_id });
                          }
                        } else {
                          setShowMidCourseDialog(true);
                        }
                      }
                    }} 
                    style={{backgroundColor: midCourseSubmitted ? '#22c55e' : '#0D2040', padding: '20px 24px'}}
                    className="w-full justify-between items-center text-base"
                    disabled={midCourseSubmitted}
                  >
                    <span className="text-base font-medium">2) Questionnaire à mi-parcours</span>
                    {midCourseSubmitted ? (
                      <span className="text-sm bg-white text-green-600 px-3 py-1.5 rounded-full font-semibold">✓ Validé</span>
                    ) : (
                      <span className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold">À valider</span>
                    )}
                  </Button>
                  <Button 
                    onClick={() => {
                      if (!endCourseSubmitted) {
                        if (user?.parcours === 'Informatique') {
                          const q3Resource = studentResources.find(r => r.category === 'QUESTIONNAIRE_QUALIOPI' && r.sub_type === 'FIN');
                          if (q3Resource) {
                            setActiveQuestionnaire({ resourceId: q3Resource.id, templateId: q3Resource.template_id });
                          }
                        } else {
                          setShowEndCourseDialog(true);
                        }
                      }
                    }} 
                    style={{backgroundColor: endCourseSubmitted ? '#22c55e' : '#0D2040', padding: '20px 24px'}}
                    className="w-full justify-between items-center text-base"
                    disabled={endCourseSubmitted}
                  >
                    <span className="text-base font-medium">3) Questionnaire de fin de formation</span>
                    {endCourseSubmitted ? (
                      <span className="text-sm bg-white text-green-600 px-3 py-1.5 rounded-full font-semibold">✓ Validé</span>
                    ) : (
                      <span className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold">À valider</span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bandeau ROUGE : Mon avis sur la formation */}
            <Card className="shadow-lg border-2 border-red-200">
              <CardHeader style={{backgroundColor: '#FDE7F3'}}>
                <CardTitle className="text-xl flex items-center gap-2" style={{color: TERCIFORM_BLUE}}>
                  <MessageSquare size={24} />
                  Mon avis sur la formation
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Votre retour est précieux pour améliorer nos formations
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <Button 
                  onClick={() => setShowFeedbackDialog(true)} 
                  style={{backgroundColor: TERCIFORM_BLUE}}
                  className="w-full"
                >
                  <MessageSquare size={16} className="mr-2" />
                  Donner mon avis
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Training Needs Questionnaires - Affichage selon le parcours */}
      {user?.parcours === 'Informatique' ? (
        <>
          <InformatiqueFormationNeedsQuestionnaire
            open={showNeedsDialog}
            onClose={() => {
              setShowNeedsDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
            resourceId={studentResources.find(r => r.category === 'QUESTIONNAIRE_QUALIOPI' && r.sub_type === 'POSITIONNEMENT')?.id}
          />
          <MidCourseQuestionnaire
            open={showMidCourseDialog}
            onClose={() => {
              setShowMidCourseDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
          <EndCourseQuestionnaire
            open={showEndCourseDialog}
            onClose={() => {
              setShowEndCourseDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
        </>
      ) : user?.parcours === 'Bureautique' ? (
        <>
          <BureautiqueFormationNeedsQuestionnaire
            open={showNeedsDialog}
            onClose={() => {
              setShowNeedsDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
          
          <BureautiqueMidCourseQuestionnaire
            open={showMidCourseDialog}
            onClose={() => {
              setShowMidCourseDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
          
          <BureautiqueEndCourseQuestionnaire
            open={showEndCourseDialog}
            onClose={() => {
              setShowEndCourseDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
        </>
      ) : (
        <>
          <FormationNeedsQuestionnaire
            open={showNeedsDialog}
            onClose={() => {
              setShowNeedsDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
          
          <MidCourseQuestionnaire
            open={showMidCourseDialog}
            onClose={() => {
              setShowMidCourseDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
          
          <EndCourseQuestionnaire
            open={showEndCourseDialog}
            onClose={() => {
              setShowEndCourseDialog(false);
              loadQuestionnairesStatus();
            }}
            studentId={user?.id}
          />
        </>
      )}

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mon avis sur la formation</DialogTitle>
            <DialogDescription>Votre retour nous aide à améliorer nos formations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Comment évaluez-vous la qualité de la formation ?</Label>
              <Textarea
                value={feedback.quality_rating}
                onChange={(e) => setFeedback({ ...feedback, quality_rating: e.target.value })}
                rows={3}
                className="mt-2"
                placeholder="Partagez votre évaluation de la qualité..."
              />
            </div>
            <div>
              <Label>Le formateur vous a-t-il accompagné efficacement ?</Label>
              <Textarea
                value={feedback.teacher_support}
                onChange={(e) => setFeedback({ ...feedback, teacher_support: e.target.value })}
                rows={3}
                className="mt-2"
                placeholder="Parlez de l'accompagnement reçu..."
              />
            </div>
            <div>
              <Label>Recommanderiez-vous cette formation ?</Label>
              <Textarea
                value={feedback.recommendation}
                onChange={(e) => setFeedback({ ...feedback, recommendation: e.target.value })}
                rows={3}
                className="mt-2"
                placeholder="Donneriez-vous votre recommandation ?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>Annuler</Button>
            <Button onClick={submitFeedback} style={{backgroundColor: TERCIFORM_BLUE}}>Soumettre mon avis</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Signature de présence</DialogTitle>
            <DialogDescription>
              {currentSessionToSign && (
                <span>{currentSessionToSign.subject} - {formatFrDate(currentSessionToSign.date)}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <SignaturePad 
            onSave={saveSignature}
            onCancel={() => setShowSignatureDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Contacter mon formateur */}
      <Dialog open={showContactTeacherDialog} onOpenChange={setShowContactTeacherDialog}>
        <DialogContent className="max-w-md sm:max-w-lg" style={{margin: 'auto'}}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>✉️</span>
              Contacter mon formateur
            </DialogTitle>
            <DialogDescription>
              Envoyez un message à {user.teacher_name || 'votre formateur'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContactTeacher} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Objet *</Label>
              <Input
                id="subject"
                placeholder="Ex: Question sur le planning"
                value={contactTeacher.subject}
                onChange={(e) => setContactTeacher({ ...contactTeacher, subject: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Ma demande *</Label>
              <Textarea
                id="message"
                placeholder="Décrivez votre demande..."
                rows={6}
                value={contactTeacher.message}
                onChange={(e) => setContactTeacher({ ...contactTeacher, message: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowContactTeacherDialog(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: TERCIFORM_BLUE }}
                className="text-white"
              >
                <span className="mr-2">📨</span>
                Envoyer ma demande à mon formateur
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
