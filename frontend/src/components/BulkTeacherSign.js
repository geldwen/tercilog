import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, PenTool } from "lucide-react";
import SignatureCanvas from 'react-signature-canvas';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TERCIFORM_BLUE = '#0D2040';

export default function BulkTeacherSign({ onComplete }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [step, setStep] = useState('list'); // 'list' | 'sign'
  const [submitting, setSubmitting] = useState(false);
  const [unsignedCount, setUnsignedCount] = useState(0);

  // Load count on mount
  useEffect(() => {
    loadCount();
  }, []);

  const loadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/sessions/unsigned-teacher`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnsignedCount(res.data.count || 0);
    } catch (e) {
      console.error('Error loading unsigned count', e);
      // En cas d'erreur API, on force l'affichage du bouton pour diagnostic
      setUnsignedCount(-1);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/sessions/unsigned-teacher`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(res.data.sessions || []);
      setUnsignedCount(res.data.count || 0);
      // Select all by default
      setSelectedIds(new Set((res.data.sessions || []).map(s => s.id)));
    } catch (e) {
      toast.error("Erreur lors du chargement des séances");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setStep('list');
    loadSessions();
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === sessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sessions.map(s => s.id)));
    }
  };

  const clearSigCanvas = () => {
    if (window.bulkSigCanvas) window.bulkSigCanvas.clear();
  };

  const handleSubmitBulkSign = async () => {
    if (!window.bulkSigCanvas || window.bulkSigCanvas.isEmpty()) {
      toast.error('Veuillez dessiner votre signature');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Aucune séance sélectionnée');
      return;
    }

    const signature = window.bulkSigCanvas.toDataURL();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/sessions/bulk-teacher-sign`, {
        session_ids: Array.from(selectedIds),
        signature,
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success(res.data.message);
      setOpen(false);
      setStep('list');
      setSessions([]);
      setSelectedIds(new Set());
      setUnsignedCount(0);
      if (onComplete) onComplete();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur lors de la signature');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  if (unsignedCount === 0) return null;

  return (
    <>
      <Button
        onClick={handleOpen}
        className={unsignedCount === -1 ? "bg-red-500 hover:bg-red-600 text-white shadow-lg" : "bg-orange-500 hover:bg-orange-600 text-white shadow-lg"}
        data-testid="bulk-sign-btn"
      >
        <AlertTriangle size={16} className="mr-2" />
        {unsignedCount === -1 ? "Vérifier les signatures manquantes (erreur de chargement)" : `Corriger ${unsignedCount} signature(s) manquante(s)`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="bulk-sign-dialog">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3" style={{ color: TERCIFORM_BLUE }}>
              <PenTool size={28} />
              {step === 'list' ? 'Séances sans signature formateur' : 'Appliquer votre signature'}
            </DialogTitle>
            <DialogDescription>
              {step === 'list'
                ? `${sessions.length} séance(s) passée(s) n'ont pas de signature formateur. Sélectionnez celles à signer.`
                : `Dessinez votre signature une seule fois. Elle sera appliquée aux ${selectedIds.size} séance(s) sélectionnée(s).`
              }
            </DialogDescription>
          </DialogHeader>

          {step === 'list' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
                  <p className="mt-2 text-gray-500">Chargement...</p>
                </div>
              ) : sessions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
                    <p className="text-green-700 font-semibold">Toutes les séances sont signées !</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === sessions.length}
                        onChange={toggleAll}
                        className="w-4 h-4"
                        data-testid="bulk-select-all"
                      />
                      <span className="font-semibold text-sm">
                        Tout sélectionner ({selectedIds.size}/{sessions.length})
                      </span>
                    </label>
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100">
                        <tr>
                          <th className="p-2 w-10"></th>
                          <th className="text-left p-2 font-semibold" style={{ color: TERCIFORM_BLUE }}>Date</th>
                          <th className="text-left p-2 font-semibold" style={{ color: TERCIFORM_BLUE }}>Horaire</th>
                          <th className="text-left p-2 font-semibold" style={{ color: TERCIFORM_BLUE }}>Élève</th>
                          <th className="text-left p-2 font-semibold" style={{ color: TERCIFORM_BLUE }}>Matière</th>
                          <th className="text-left p-2 font-semibold" style={{ color: TERCIFORM_BLUE }}>Durée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(s => (
                          <tr
                            key={s.id}
                            className={`border-t cursor-pointer hover:bg-blue-50 ${selectedIds.has(s.id) ? 'bg-blue-50' : ''}`}
                            onClick={() => toggleSelect(s.id)}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(s.id)}
                                onChange={() => toggleSelect(s.id)}
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="p-2">{formatDate(s.date)}</td>
                            <td className="p-2">{s.start_time} - {s.end_time}</td>
                            <td className="p-2 font-medium">{s.student_name}</td>
                            <td className="p-2">{s.subject}</td>
                            <td className="p-2">{s.duration_hours}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
                {sessions.length > 0 && (
                  <Button
                    onClick={() => setStep('sign')}
                    disabled={selectedIds.size === 0}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="bulk-sign-next-btn"
                  >
                    Signer {selectedIds.size} séance(s)
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}

          {step === 'sign' && (
            <div className="space-y-6">
              <Card className="border-2 border-orange-200 bg-orange-50">
                <CardContent className="py-4">
                  <p className="text-orange-800 font-semibold text-center text-lg">
                    {selectedIds.size} séance(s) seront signées
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <p className="text-lg font-semibold" style={{ color: TERCIFORM_BLUE }}>
                  Dessinez votre signature ci-dessous
                </p>
                <p className="text-sm text-gray-600">
                  Utilisez votre souris ou votre doigt pour dessiner votre signature
                </p>
                <div className="border-2 border-gray-300 rounded-lg bg-white">
                  <SignatureCanvas
                    ref={(ref) => { window.bulkSigCanvas = ref; }}
                    canvasProps={{
                      className: "w-full h-48 touch-none",
                      style: { touchAction: "none" }
                    }}
                  />
                </div>
                <Button type="button" variant="outline" onClick={clearSigCanvas} className="text-gray-700">
                  Effacer
                </Button>
              </div>

              <DialogFooter className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('list')} disabled={submitting}>
                  Retour
                </Button>
                <Button
                  onClick={handleSubmitBulkSign}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="bulk-sign-submit-btn"
                >
                  {submitting ? 'Signature en cours...' : `Valider la signature pour ${selectedIds.size} séance(s)`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
