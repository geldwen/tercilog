import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, BookOpen, MessageSquare, Download, FileText, TrendingUp, PenTool } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TERCIFORM_BLUE = '#0D2040';
const TERCIFORM_BLUE_HOVER = '#152a47';

export default function StudentDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('formation');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNeedsDialog, setShowNeedsDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [currentSessionToSign, setCurrentSessionToSign] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);

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
  }, []);

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
      
      // Download PDF
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

  // Signature functions
  const openSignatureDialog = (session) => {
    setCurrentSessionToSign(session);
    setShowSignatureDialog(true);
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
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
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
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    const signatureDataURL = canvas.toDataURL('image/png');

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

  const formatDate = (dateStr) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr, timeStr) => {
    const date = formatDate(dateStr);
    return `${date} ${timeStr}`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
      confirmed: { text: 'Confirmée', color: 'bg-green-100 text-green-800' },
      rejected: { text: 'Refusée', color: 'bg-red-100 text-red-800' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`px-2 py-1 rounded text-xs ${badge.color}`}>{badge.text}</span>;
  };

  // Calculate stats
  const totalHours = user.total_hours || 0;
  const remainingHours = user.credit_hours || 0;
  const completedHours = totalHours - remainingHours;

  // Filter sessions to sign
  const sessionsToSign = sessions.filter(s => s.signature_status === 'pending');

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
            <Button
              variant="outline"
              onClick={onLogout}
              className="flex items-center gap-2"
            >
              <LogOut size={16} />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Tab Navigation - Large Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setActiveTab('formation')}
            className={`p-6 rounded-lg shadow-md transition-all duration-200 text-left ${
              activeTab === 'formation'
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'bg-white hover:shadow-lg'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={28} style={{color: TERCIFORM_BLUE}} />
              <h2 className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>Ma formation</h2>
            </div>
            <p className="text-sm text-gray-600">Consultez votre parcours complet</p>
          </button>

          <button
            onClick={() => setActiveTab('parcours')}
            className={`p-6 rounded-lg shadow-md transition-all duration-200 text-left ${
              activeTab === 'parcours'
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'bg-white hover:shadow-lg'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp size={28} style={{color: TERCIFORM_BLUE}} />
              <h2 className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>Mon parcours</h2>
            </div>
            <p className="text-sm text-gray-600">Livret et besoins en formation</p>
          </button>

          <button
            onClick={() => setActiveTab('avis')}
            className={`p-6 rounded-lg shadow-md transition-all duration-200 text-left ${
              activeTab === 'avis'
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'bg-white hover:shadow-lg'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare size={28} style={{color: TERCIFORM_BLUE}} />
              <h2 className="text-xl font-bold" style={{color: TERCIFORM_BLUE}}>Mes avis</h2>
            </div>
            <p className="text-sm text-gray-600">Partagez votre expérience</p>
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
                  <p className="text-sm text-gray-600 mt-2">{completedHours}h complétées</p>
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
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Date</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Horaire</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Matière</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Formateur</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Statut</th>
                          <th className="text-left p-3 font-semibold" style={{color: TERCIFORM_BLUE}}>Durée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.sort((a, b) => new Date(a.date) - new Date(b.date)).map((session) => (
                          <tr key={session.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{formatDate(session.date)}</td>
                            <td className="p-3">{session.start_time} - {session.end_time}</td>
                            <td className="p-3">{session.subject}</td>
                            <td className="p-3 text-gray-600">-</td>
                            <td className="p-3">{getStatusBadge(session.status)}</td>
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

            {/* Séances à émarger */}
            {sessionsToSign.length > 0 && (
              <Card className="shadow-lg border-2 border-blue-200">
                <CardHeader>
                  <CardTitle style={{color: TERCIFORM_BLUE}}>Séances à émarger</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sessionsToSign.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                        <div>
                          <p className="font-semibold">{session.subject}</p>
                          <p className="text-sm text-gray-600">
                            {formatDateTime(session.date, session.start_time)}
                          </p>
                        </div>
                        <Button
                          onClick={() => openSignatureDialog(session)}
                          style={{backgroundColor: TERCIFORM_BLUE}}
                        >
                          <PenTool size={16} className="mr-2" />
                          Signer
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'parcours' && (
          <div className="space-y-6">
            {/* Livret d'accueil */}
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

            {/* Besoins en formation */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle style={{color: TERCIFORM_BLUE}}>Mes besoins en formation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Partagez vos attentes et objectifs de formation
                </p>
                <Button
                  onClick={() => setShowNeedsDialog(true)}
                  style={{backgroundColor: TERCIFORM_BLUE}}
                >
                  Remplir le questionnaire
                </Button>
              </CardContent>
            </Card>

            {/* Placeholder progression */}
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
            {/* Formulaire d'avis */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle style={{color: TERCIFORM_BLUE}}>Mon avis sur la formation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Votre retour est précieux pour améliorer nos formations
                </p>
                <Button
                  onClick={() => setShowFeedbackDialog(true)}
                  style={{backgroundColor: TERCIFORM_BLUE}}
                >
                  <MessageSquare size={16} className="mr-2" />
                  Donner mon avis
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Training Needs Dialog */}
      <Dialog open={showNeedsDialog} onOpenChange={setShowNeedsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mes besoins en formation</DialogTitle>
            <DialogDescription>
              Partagez vos attentes pour personnaliser votre parcours
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Qu'attendez-vous de cette formation ?</Label>
              <Textarea
                value={trainingNeeds.expectations}
                onChange={(e) => setTrainingNeeds({ ...trainingNeeds, expectations: e.target.value })}
                rows={3}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Quelles sont vos forces actuelles ?</Label>
              <Textarea
                value={trainingNeeds.strengths}
                onChange={(e) => setTrainingNeeds({ ...trainingNeeds, strengths: e.target.value })}
                rows={3}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Qu'aimeriez-vous améliorer ?</Label>
              <Textarea
                value={trainingNeeds.improvements}
                onChange={(e) => setTrainingNeeds({ ...trainingNeeds, improvements: e.target.value })}
                rows={3}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Quelles sont vos disponibilités ?</Label>
              <Textarea
                value={trainingNeeds.availability}
                onChange={(e) => setTrainingNeeds({ ...trainingNeeds, availability: e.target.value })}
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNeedsDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveTrainingNeeds} style={{backgroundColor: TERCIFORM_BLUE}}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mon avis sur la formation</DialogTitle>
            <DialogDescription>
              Votre retour nous aide à améliorer nos formations
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Annuler
            </Button>
            <Button onClick={submitFeedback} style={{backgroundColor: TERCIFORM_BLUE}}>
              Soumettre mon avis
            </Button>
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
                <span>
                  {currentSessionToSign.subject} - {formatDateTime(currentSessionToSign.date, currentSessionToSign.start_time)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full cursor-crosshair"
                style={{ touchAction: 'none' }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Signez dans la zone ci-dessus (utilisez votre souris ou votre doigt)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={clearSignature}>
              Effacer
            </Button>
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveSignature} style={{backgroundColor: TERCIFORM_BLUE}}>
              Valider la signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
