import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, Calendar, Clock, CheckCircle, XCircle, AlertCircle, PenTool } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TERCIFORM_BLUE = '#1e3a5f';
const TERCIFORM_BLUE_HOVER = '#152a47';
const TERCIFORM_BLUE_LIGHT = '#e8f0f7';

export default function StudentDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [currentSessionToSign, setCurrentSessionToSign] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [signatureData, setSignatureData] = useState(null);

  useEffect(() => {
    loadSessions();
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

  const handleValidation = async (sessionId, status) => {
    setValidating(sessionId);
    try {
      await axios.patch(`${API}/sessions/${sessionId}/validate`, { status });
      toast.success(status === "confirmed" ? "Séance confirmée !" : "Séance refusée");
      loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de la validation");
    } finally {
      setValidating(null);
    }
  };


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

  // Fonction utilitaire pour obtenir les coordonnées (souris ou tactile)
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Support tactile (touch events)
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    
    // Support souris (mouse events)
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Début du dessin (souris ou tactile)
  const startDrawing = (e) => {
    e.preventDefault(); // Empêche le scroll sur mobile
    const coords = getCoordinates(e);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  // Dessin en cours (souris ou tactile)
  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Empêche le scroll sur mobile
    
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  // Fin du dessin
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
    const signatureImage = canvas.toDataURL('image/png');
    
    try {
      await axios.post(`${API}/sessions/${currentSessionToSign.id}/sign`, {
        signature: signatureImage
      });
      
      toast.success("Merci pour votre émargement, votre signature a été validée !");
      setShowSignatureDialog(false);
      setCurrentSessionToSign(null);
      loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de l'enregistrement de la signature");
    }
  };

  const sessionsToSign = sessions.filter(s => s.signature_status === "pending" && !s.signature);


  const pendingSessions = sessions.filter((s) => s.status === "pending");
  const confirmedSessions = sessions.filter((s) => s.status === "confirmed");
  const rejectedSessions = sessions.filter((s) => s.status === "rejected");

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: TERCIFORM_BLUE }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_f0bae013-d5d3-4906-a078-392b9e03aa37/artifacts/tiidl44l_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png"
                alt="Terciform"
                className="h-10"
              />
              <div className="border-l border-gray-300 pl-3">
                <h1 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>Espace Élève</h1>
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hours Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Total Hours Card */}
          <Card className="border-0 shadow-lg" data-testid="total-hours-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total heures parcours</p>
                  <p className="text-4xl font-bold mt-1 text-gray-900" data-testid="total-hours-value">{user.total_hours || user.credit_hours}h</p>
                </div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: TERCIFORM_BLUE_LIGHT }}>
                  <Clock className="w-8 h-8" style={{ color: TERCIFORM_BLUE }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remaining Hours Card */}
          <Card className="border-0 shadow-lg text-white" style={{ background: `linear-gradient(135deg, ${TERCIFORM_BLUE} 0%, ${TERCIFORM_BLUE_HOVER} 100%)` }} data-testid="credit-hours-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Crédit heures disponibles</p>
                  <p className="text-4xl font-bold mt-1" data-testid="credit-hours-value">{user.credit_hours}h</p>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Clock className="w-8 h-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions to Sign Section */}
        {sessionsToSign.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4" style={{ color: TERCIFORM_BLUE }}>Séances à émarger</h2>
            <div className="space-y-4">
              {sessionsToSign.map((session) => (
                <Card key={session.id} className="border-0 shadow-md card-hover border-2 border-orange-300">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{session.subject}</h3>
                          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                            <PenTool className="w-3 h-3 inline mr-1" />
                            À émarger
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(session.date).toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {session.start_time} - {session.end_time}
                          </span>
                        </div>
                      </div>

                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-sm text-orange-800 font-medium">
                          ⚠️ Attention : Vous avez 2 heures après la fin de la séance pour émarger.
                        </p>
                      </div>

                      <Button
                        onClick={() => openSignatureDialog(session)}
                        className="w-full text-white h-12 font-medium"
                        style={{ backgroundColor: TERCIFORM_BLUE }}
                      >
                        <PenTool className="w-5 h-5 mr-2" />
                        Émarger maintenant
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pending Sessions Section */}
        {pendingSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4" style={{ color: TERCIFORM_BLUE }}>Séances à valider</h2>
            <div className="space-y-4">
              {pendingSessions.map((session) => (
                <Card key={session.id} className="border-0 shadow-md card-hover" data-testid={`pending-session-card-${session.id}`}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900" data-testid={`session-subject-${session.id}`}>{session.subject}</h3>
                          {getStatusBadge(session.status)}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1" data-testid={`session-date-${session.id}`}>
                            <Calendar className="w-4 h-4" />
                            {new Date(session.date).toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="flex items-center gap-1" data-testid={`session-time-${session.id}`}>
                            <Clock className="w-4 h-4" />
                            {session.start_time} - {session.end_time}
                          </span>
                        </div>
                      </div>

                      {session.meeting_link && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <Button
                            onClick={() => window.open(session.meeting_link, '_blank')}
                            className="w-full text-white h-12 font-medium"
                            style={{ backgroundColor: TERCIFORM_BLUE }}
                          >
                            🎥 Rejoindre la séance (Visioconférence)
                          </Button>
                        </div>
                      )}

                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-800 font-medium">
                          ⚠️ Important : En cas d'absence d'une séance validée, les heures de formation seront perdues.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleValidation(session.id, "confirmed")}
                          disabled={validating === session.id}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 font-medium"
                          data-testid={`accept-session-button-${session.id}`}
                        >
                          {validating === session.id ? (
                            <span className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Validation...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5" />
                              Oui, je m'engage
                            </span>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleValidation(session.id, "rejected")}
                          disabled={validating === session.id}
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 h-12 font-medium"
                          data-testid={`reject-session-button-${session.id}`}
                        >
                          <span className="flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            Non, je ne serai pas présent
                          </span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="confirmed" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 shadow-sm" data-testid="sessions-tabs">
            <TabsTrigger value="confirmed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white" data-testid="confirmed-sessions-tab">
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmées
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white" data-testid="rejected-sessions-tab">
              <XCircle className="w-4 h-4 mr-2" />
              Refusées
            </TabsTrigger>
          </TabsList>

          {/* Confirmed Sessions */}
          <TabsContent value="confirmed" className="space-y-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>Séances confirmées</h2>
            </div>

            {confirmedSessions.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="pt-6 text-center text-gray-500">
                  Aucune séance confirmée
                </CardContent>
              </Card>
            ) : (
              confirmedSessions.map((session) => (
                <Card key={session.id} className="border-0 shadow-md card-hover" data-testid={`confirmed-session-card-${session.id}`}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900" data-testid={`confirmed-session-subject-${session.id}`}>{session.subject}</h3>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1" data-testid={`confirmed-session-date-${session.id}`}>
                          <Calendar className="w-4 h-4" />
                          {new Date(session.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`confirmed-session-time-${session.id}`}>
                          <Clock className="w-4 h-4" />
                          {session.start_time} - {session.end_time}
                        </span>
                      </div>
                      {session.validated_at && (
                        <p className="text-xs text-gray-500" data-testid={`confirmed-session-validated-at-${session.id}`}>
                          Confirmé le {new Date(session.validated_at).toLocaleString('fr-FR')}
                        </p>
                      )}
                      {session.meeting_link && (
                        <div className="mt-3">
                          <Button
                            onClick={() => window.open(session.meeting_link, '_blank')}
                            className="w-full text-white h-10 font-medium"
                            size="sm"
                            style={{ backgroundColor: TERCIFORM_BLUE }}
                          >
                            🎥 Rejoindre la séance
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Rejected Sessions */}
          <TabsContent value="rejected" className="space-y-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>Séances refusées</h2>
            </div>

            {rejectedSessions.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="pt-6 text-center text-gray-500">
                  Aucune séance refusée
                </CardContent>
              </Card>
            ) : (
              rejectedSessions.map((session) => (
                <Card key={session.id} className="border-0 shadow-md card-hover" data-testid={`rejected-session-card-${session.id}`}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900" data-testid={`rejected-session-subject-${session.id}`}>{session.subject}</h3>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1" data-testid={`rejected-session-date-${session.id}`}>
                          <Calendar className="w-4 h-4" />
                          {new Date(session.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`rejected-session-time-${session.id}`}>
                          <Clock className="w-4 h-4" />
                          {session.start_time} - {session.end_time}
                        </span>
                      </div>
                      {session.validated_at && (
                        <p className="text-xs text-gray-500" data-testid={`rejected-session-validated-at-${session.id}`}>
                          Refusé le {new Date(session.validated_at).toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Émargement de séance</DialogTitle>
            <DialogDescription>
              Veuillez signer avec votre souris ou votre doigt dans le cadre ci-dessous pour valider votre présence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={300}
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
                onClick={clearSignature}
                variant="outline"
                className="flex-1"
              >
                Effacer
              </Button>
              <Button
                onClick={saveSignature}
                className="flex-1 text-white"
                style={{ backgroundColor: TERCIFORM_BLUE }}
              >
                Valider la signature
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
