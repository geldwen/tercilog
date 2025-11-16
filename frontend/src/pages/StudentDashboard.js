import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, BookOpen, MessageSquare, Download, FileText, TrendingUp, CheckCircle } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import FormationNeedsQuestionnaire from "@/components/FormationNeedsQuestionnaire";
import MidCourseQuestionnaire from "@/components/MidCourseQuestionnaire";
import EndCourseQuestionnaire from "@/components/EndCourseQuestionnaire";
import BureautiqueFormationNeedsQuestionnaire from "@/components/BureautiqueFormationNeedsQuestionnaire";
import BureautiqueMidCourseQuestionnaire from "@/components/BureautiqueMidCourseQuestionnaire";
import BureautiqueEndCourseQuestionnaire from "@/components/BureautiqueEndCourseQuestionnaire";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TERCIFORM_BLUE = '#0D2040';

export default function StudentDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('formation');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNeedsDialog, setShowNeedsDialog] = useState(false);
  const [showMidCourseDialog, setShowMidCourseDialog] = useState(false);
  const [showEndCourseDialog, setShowEndCourseDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  
  // États pour les questionnaires soumis
  const [formationNeedsSubmitted, setFormationNeedsSubmitted] = useState(false);
  const [midCourseSubmitted, setMidCourseSubmitted] = useState(false);
  const [endCourseSubmitted, setEndCourseSubmitted] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [currentSessionToSign, setCurrentSessionToSign] = useState(null);

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
  }, []);

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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg" style={{color: TERCIFORM_BLUE}}>Total heures du parcours</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold" style={{color: TERCIFORM_BLUE}}>{totalHours}h</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg" style={{color: TERCIFORM_BLUE}}>Heures restantes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-green-600">{remainingHours}h</p>
                </CardContent>
              </Card>
            </div>

            {/* Sessions Table */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle style={{color: TERCIFORM_BLUE}}>Planning complet</CardTitle>
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
          </div>
        )}

        {activeTab === 'parcours' && (
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle style={{color: TERCIFORM_BLUE}}>Mon livret d'accueil</CardTitle>
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

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle style={{color: TERCIFORM_BLUE}}>Mes besoins en formation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">Partagez vos attentes et objectifs de formation</p>
                <div className="space-y-3">
                  <Button 
                    onClick={() => !formationNeedsSubmitted && setShowNeedsDialog(true)} 
                    style={{backgroundColor: formationNeedsSubmitted ? '#22c55e' : TERCIFORM_BLUE}}
                    className="w-full justify-start"
                    disabled={formationNeedsSubmitted}
                  >
                    1) Questionnaire de besoin en formation
                    {formationNeedsSubmitted && <span className="ml-2 text-xs">✓ Validé</span>}
                  </Button>
                  <Button 
                    onClick={() => !midCourseSubmitted && setShowMidCourseDialog(true)} 
                    style={{backgroundColor: midCourseSubmitted ? '#22c55e' : TERCIFORM_BLUE}}
                    className="w-full justify-start"
                    disabled={midCourseSubmitted}
                  >
                    2) Questionnaire à mi-parcours
                    {midCourseSubmitted && <span className="ml-2 text-xs">✓ Validé</span>}
                  </Button>
                  <Button 
                    onClick={() => !endCourseSubmitted && setShowEndCourseDialog(true)} 
                    style={{backgroundColor: endCourseSubmitted ? '#22c55e' : TERCIFORM_BLUE}}
                    className="w-full justify-start"
                    disabled={endCourseSubmitted}
                  >
                    3) Questionnaire de fin de formation
                    {endCourseSubmitted && <span className="ml-2 text-xs">✓ Validé</span>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-dashed border-2">
              <CardHeader>
                <CardTitle className="text-gray-500">Progression du parcours</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-center py-8">
                  Graphique de progression à venir
                  <br />
                  <span className="text-sm">Heures émargées / Objectif total</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'avis' && (
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle style={{color: TERCIFORM_BLUE}}>Mon avis sur la formation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">Votre retour est précieux pour améliorer nos formations</p>
                <Button onClick={() => setShowFeedbackDialog(true)} style={{backgroundColor: TERCIFORM_BLUE}}>
                  <MessageSquare size={16} className="mr-2" />
                  Donner mon avis
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Training Needs Questionnaires - Affichage selon le parcours */}
      {user?.parcours === "Bureautique" ? (
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
    </div>
  );
}
