import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TERCIFORM_BLUE = '#1e3a5f';
const TERCIFORM_BLUE_HOVER = '#152a47';
const TERCIFORM_BLUE_LIGHT = '#e8f0f7';

export default function StudentDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(null);

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
        {/* Credit Hours Card */}
        <Card className="mb-8 border-0 shadow-lg text-white" style={{ background: `linear-gradient(135deg, ${TERCIFORM_BLUE} 0%, ${TERCIFORM_BLUE_HOVER} 100%)` }} data-testid="credit-hours-card">
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

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 shadow-sm" data-testid="sessions-tabs">
            <TabsTrigger
              value="pending"
              className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white relative"
              data-testid="pending-sessions-tab"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              En attente
              {pendingSessions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full" data-testid="pending-count-badge">
                  {pendingSessions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white" data-testid="confirmed-sessions-tab">
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmées
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white" data-testid="rejected-sessions-tab">
              <XCircle className="w-4 h-4 mr-2" />
              Refusées
            </TabsTrigger>
          </TabsList>

          {/* Pending Sessions */}
          <TabsContent value="pending" className="space-y-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold" style={{ color: TERCIFORM_BLUE }}>Séances à valider</h2>
              <p className="text-sm text-gray-600 mt-1">
                Acceptez ou refusez les séances proposées
              </p>
            </div>

            {pendingSessions.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="pt-6 text-center text-gray-500">
                  Aucune séance en attente
                </CardContent>
              </Card>
            ) : (
              pendingSessions.map((session) => (
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
              ))
            )}
          </TabsContent>

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
    </div>
  );
}
