import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, Send, Building, Wrench, FileText, Calendar, Coffee, Mail,
  Clock, Plus, Trash2, Upload, Download, CheckCircle, XCircle, AlertCircle, Inbox
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORIES = [
  { id: 'SALLES', label: 'Salles', icon: Building, color: 'bg-blue-500', textColor: 'text-blue-600', bgLight: 'bg-blue-50', borderColor: 'border-blue-500' },
  { id: 'MATERIEL', label: 'Matériel', icon: Wrench, color: 'bg-orange-500', textColor: 'text-orange-600', bgLight: 'bg-orange-50', borderColor: 'border-orange-500' },
  { id: 'SUPPORTS', label: 'Supports', icon: FileText, color: 'bg-purple-500', textColor: 'text-purple-600', bgLight: 'bg-purple-50', borderColor: 'border-purple-500' },
  { id: 'ORGANISATION', label: 'Organisation', icon: Calendar, color: 'bg-green-500', textColor: 'text-green-600', bgLight: 'bg-green-50', borderColor: 'border-green-500' },
  { id: 'ACCUEIL', label: 'Accueil', icon: Coffee, color: 'bg-pink-500', textColor: 'text-pink-600', bgLight: 'bg-pink-50', borderColor: 'border-pink-500' },
  { id: 'EMAIL', label: 'Email', icon: Mail, color: 'bg-gray-500', textColor: 'text-gray-600', bgLight: 'bg-gray-50', borderColor: 'border-gray-500' }
];

const STATUS_CONFIG = {
  EN_ATTENTE: { label: 'En cours', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertCircle, iconColor: 'text-orange-500' },
  ACCEPTEE: { label: 'Validée', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle, iconColor: 'text-green-500' },
  REFUSEE: { label: 'Refusée', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, iconColor: 'text-red-500' },
  ENVOYE: { label: 'Envoyé', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Send, iconColor: 'text-blue-500' }
};

export default function TicketingModal({ open, onClose, userRole, userId, clientId, clientName }) {
  const [activeCategory, setActiveCategory] = useState('SALLES');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [unreadByCategory, setUnreadByCategory] = useState({});
  
  // Formulaire Salles (Admin seulement) - supporte plusieurs dates
  const [salleForm, setSalleForm] = useState({
    lieu: '',
    centre: '',
    nombre_personnes: '',
    type_reservation: 'journee',
    dates: [], // Liste de dates au lieu d'une seule
    email_destinataire: '',
    commentaire: ''
  });
  
  // Formulaire Matériel (Admin seulement)
  const [materiels, setMateriels] = useState([{ nom: '', quantite: 1 }]);
  const [materielCommentaire, setMaterielCommentaire] = useState('');
  
  // Documents
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  // Formulaire Email
  const [mailForm, setMailForm] = useState({
    sujet: '',
    message: ''
  });

  const isAdmin = userRole === 'teacher';
  const isGestionnaire = userRole === 'gestionnaire';

  useEffect(() => {
    if (open) {
      loadRequests();
      loadDocuments();
      loadUnreadByCategory();
    }
  }, [open, activeCategory]);

  // Charger les compteurs de tickets non lus par catégorie
  const loadUnreadByCategory = async () => {
    if (!clientId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/tickets/unread-count-by-category/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadByCategory(response.data || {});
    } catch (error) {
      console.error('Erreur chargement compteurs par catégorie:', error);
    }
  };

  const loadRequests = async () => {
    try {
      const backendCategory = activeCategory === 'EMAIL' ? 'AUTRE' : activeCategory;
      const response = await axios.get(`${API}/ticketing/requests?category=${backendCategory}`);
      setRequests(response.data || []);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await axios.get(`${API}/ticketing/documents`);
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTimeShort = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ========== VALIDATION / REFUS (Gestionnaire seulement) ==========
  const handleValidateRequest = async (requestId) => {
    setLoading(true);
    try {
      await axios.patch(`${API}/ticketing/requests/${requestId}/status`, {
        status: 'ACCEPTEE'
      });
      toast.success('Demande validée avec succès !');
      loadRequests();
    } catch (error) {
      toast.error('Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  const handleRefuseRequest = async (requestId) => {
    setLoading(true);
    try {
      await axios.patch(`${API}/ticketing/requests/${requestId}/status`, {
        status: 'REFUSEE'
      });
      toast.success('Demande refusée');
      loadRequests();
    } catch (error) {
      toast.error('Erreur lors du refus');
    } finally {
      setLoading(false);
    }
  };

  // ========== SALLES (Admin seulement) ==========
  const handleSubmitSalle = async (e) => {
    e.preventDefault();
    if (!salleForm.lieu || salleForm.dates.length === 0 || !salleForm.nombre_personnes) {
      toast.error('Veuillez remplir tous les champs obligatoires (lieu, au moins une date, nombre de personnes)');
      return;
    }
    
    setLoading(true);
    try {
      // Envoyer avec la liste des dates
      const formData = {
        ...salleForm,
        date_souhaitee: salleForm.dates.join(', '), // Pour compatibilité
        dates_list: salleForm.dates
      };
      await axios.post(`${API}/ticketing/salles`, formData);
      toast.success(`Demande de salle envoyée pour ${salleForm.dates.length} date(s) !`);
      setSalleForm({
        lieu: '',
        centre: '',
        nombre_personnes: '',
        type_reservation: 'journee',
        dates: [],
        email_destinataire: '',
        commentaire: ''
      });
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  // Ajouter une date à la liste
  const addDateToSalle = (date) => {
    if (date && !salleForm.dates.includes(date)) {
      setSalleForm(prev => ({ ...prev, dates: [...prev.dates, date].sort() }));
    }
  };

  // Supprimer une date de la liste
  const removeDateFromSalle = (dateToRemove) => {
    setSalleForm(prev => ({ ...prev, dates: prev.dates.filter(d => d !== dateToRemove) }));
  };

  // ========== MATERIEL (Admin seulement) ==========
  const addMateriel = () => {
    setMateriels([...materiels, { nom: '', quantite: 1 }]);
  };

  const removeMateriel = (index) => {
    if (materiels.length > 1) {
      setMateriels(materiels.filter((_, i) => i !== index));
    }
  };

  const updateMateriel = (index, field, value) => {
    const newMateriels = [...materiels];
    newMateriels[index][field] = value;
    setMateriels(newMateriels);
  };

  const handleSubmitMateriel = async (e) => {
    e.preventDefault();
    const validMateriels = materiels.filter(m => m.nom.trim());
    if (validMateriels.length === 0) {
      toast.error('Veuillez ajouter au moins un matériel');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/ticketing/materiel`, {
        items: validMateriels,
        commentaire: materielCommentaire
      });
      toast.success('Demande de matériel envoyée avec succès !');
      setMateriels([{ nom: '', quantite: 1 }]);
      setMaterielCommentaire('');
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  // ========== SUPPORTS ==========
  const handleUploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await axios.post(`${API}/ticketing/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document téléversé avec succès !');
      loadDocuments();
    } catch (error) {
      toast.error('Erreur lors du téléversement');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDownloadDocument = async (docId, filename) => {
    try {
      const token = localStorage.getItem('token');
      window.open(`${API}/ticketing/documents/${docId}/download?token=${token}`, '_blank');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  // ========== EMAIL ==========
  const handleSendMail = async (e) => {
    e.preventDefault();
    if (!mailForm.sujet || !mailForm.message) {
      toast.error('Veuillez remplir le sujet et le message');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/ticketing/mail`, mailForm);
      toast.success('Email envoyé avec succès !');
      setMailForm({ sujet: '', message: '' });
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  // Composant pour afficher le statut
  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.EN_ATTENTE;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
        <Icon className={`w-3 h-3 ${config.iconColor}`} />
        {config.label}
      </span>
    );
  };

  // Composant pour les boutons de validation (Gestionnaire seulement)
  const ValidationButtons = ({ request }) => {
    if (!isGestionnaire || request.status !== 'EN_ATTENTE') return null;
    
    return (
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={() => handleValidateRequest(request.id)}
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={loading}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Valider
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleRefuseRequest(request.id)}
          disabled={loading}
        >
          <XCircle className="w-4 h-4 mr-1" />
          Refuser
        </Button>
      </div>
    );
  };

  // Filtrer les demandes par catégorie
  const getCategoryRequests = (categoryFilter) => {
    const backendCategory = categoryFilter === 'EMAIL' ? 'AUTRE' : categoryFilter;
    return requests.filter(r => r.category === backendCategory);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-white/20 rounded-lg">
              <MessageSquare className="w-6 h-6" />
            </div>
            {isAdmin 
              ? (clientName ? `Échanger avec ${clientName}` : 'Mes échanges centre')
              : 'Demandes des formateurs'
            }
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col min-h-0">
            {/* Onglets des catégories */}
            <div className="border-b px-4 bg-gray-50 flex-shrink-0">
              <TabsList className="bg-transparent h-auto gap-2 flex-wrap justify-start py-4">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  const unreadCount = unreadByCategory[cat.id] || 0;
                  return (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className={`px-5 py-3 text-base font-semibold rounded-xl border-2 transition-all flex items-center gap-2 relative ${
                        isActive 
                          ? `${cat.color} text-white shadow-lg border-transparent` 
                          : `bg-white ${cat.textColor} hover:${cat.bgLight} ${cat.borderColor}`
                      }`}
                      data-testid={`tab-${cat.id.toLowerCase()}`}
                    >
                      {/* Puce de notification rouge par catégorie */}
                      {unreadCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg animate-pulse z-10">
                          {unreadCount}
                        </div>
                      )}
                      <div className={`p-1 rounded-md ${isActive ? 'bg-white/20' : cat.bgLight}`}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : cat.textColor}`} />
                      </div>
                      {cat.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* ========== ONGLET SALLES ========== */}
            <TabsContent value="SALLES" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                {isAdmin ? (
                  /* ADMIN: Formulaire de demande */
                  <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200 mb-6">
                    <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <Building className="w-6 h-6 text-white" />
                      </div>
                      Demande de réservation de salle
                    </h3>
                    
                    <form onSubmit={handleSubmitSalle} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-blue-900 font-semibold">Lieu *</Label>
                          <Input
                            value={salleForm.lieu}
                            onChange={(e) => setSalleForm({...salleForm, lieu: e.target.value})}
                            placeholder="Ex: Paris, Lyon..."
                            className="mt-1 border-blue-200 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-blue-900 font-semibold">Centre</Label>
                          <Input
                            value={salleForm.centre}
                            onChange={(e) => setSalleForm({...salleForm, centre: e.target.value})}
                            placeholder="Nom du centre"
                            className="mt-1 border-blue-200 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-blue-900 font-semibold">Nombre de personnes *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={salleForm.nombre_personnes}
                            onChange={(e) => setSalleForm({...salleForm, nombre_personnes: e.target.value})}
                            placeholder="Ex: 10"
                            className="mt-1 border-blue-200 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-blue-900 font-semibold">Type de réservation *</Label>
                          <select
                            value={salleForm.type_reservation}
                            onChange={(e) => setSalleForm({...salleForm, type_reservation: e.target.value})}
                            className="w-full mt-1 px-3 py-2 border border-blue-200 rounded-md text-base focus:border-blue-500"
                          >
                            <option value="journee">Journée complète</option>
                            <option value="demi_journee_matin">Demi-journée (Matin)</option>
                            <option value="demi_journee_apres_midi">Demi-journée (Après-midi)</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-blue-900 font-semibold">Dates souhaitées * (cliquez pour ajouter)</Label>
                          <Input
                            type="date"
                            onChange={(e) => {
                              addDateToSalle(e.target.value);
                              e.target.value = ''; // Reset pour permettre une nouvelle sélection
                            }}
                            className="mt-1 border-blue-200 focus:border-blue-500"
                          />
                          {/* Affichage des dates sélectionnées */}
                          {salleForm.dates.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {salleForm.dates.map(date => (
                                <span key={date} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                  {new Date(date).toLocaleDateString('fr-FR')}
                                  <button 
                                    type="button"
                                    onClick={() => removeDateFromSalle(date)}
                                    className="text-blue-500 hover:text-red-500"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {salleForm.dates.length === 0 && (
                            <p className="text-xs text-gray-400 mt-1">Aucune date sélectionnée</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-blue-900 font-semibold">Email destinataire</Label>
                          <Input
                            type="email"
                            value={salleForm.email_destinataire}
                            onChange={(e) => setSalleForm({...salleForm, email_destinataire: e.target.value})}
                            placeholder="email@exemple.com"
                            className="mt-1 border-blue-200 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            {salleForm.dates.length > 0 
                              ? `UN seul email sera envoyé avec les ${salleForm.dates.length} date(s)` 
                              : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-blue-900 font-semibold">Commentaire</Label>
                        <Textarea
                          value={salleForm.commentaire}
                          onChange={(e) => setSalleForm({...salleForm, commentaire: e.target.value})}
                          placeholder="Précisions supplémentaires..."
                          className="mt-1 min-h-[80px] border-blue-200 focus:border-blue-500"
                        />
                      </div>
                      
                      <Button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="w-5 h-5 mr-2" />
                        Soumettre la demande
                      </Button>
                    </form>
                  </div>
                ) : (
                  /* GESTIONNAIRE: Message si pas de demandes */
                  getCategoryRequests('SALLES').length === 0 && (
                    <div className="bg-blue-50 rounded-2xl p-12 text-center border-2 border-blue-200 mb-6">
                      <div className="p-4 bg-blue-100 rounded-2xl w-fit mx-auto mb-4">
                        <Inbox className="w-16 h-16 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold text-blue-900 mb-2">Aucune demande de salle</h3>
                      <p className="text-blue-700">Votre formateur n'a pas encore effectué de demande de salle</p>
                    </div>
                  )
                )}

                {/* Historique des demandes */}
                {getCategoryRequests('SALLES').length > 0 && (
                  <div className="bg-white rounded-2xl border-2 border-blue-200 p-6">
                    <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Historique des demandes de salle
                    </h4>
                    <div className="space-y-4">
                      {getCategoryRequests('SALLES').map((req, idx) => (
                        <div key={req.id || idx} className="p-4 bg-gray-50 rounded-xl border hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{req.lieu} {req.centre && `- ${req.centre}`}</p>
                              <p className="text-sm text-gray-600">{req.nombre_personnes} personnes • {req.type_reservation === 'journee' ? 'Journée' : 'Demi-journée'}</p>
                              <p className="text-sm text-gray-500">Date souhaitée: {req.date_souhaitee}</p>
                              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Créé le {formatDateTime(req.created_at)}
                              </p>
                              {req.updated_at !== req.created_at && (
                                <p className="text-xs text-gray-400">Mis à jour le {formatDateTime(req.updated_at)}</p>
                              )}
                              <p className="text-xs text-gray-400">Par: {req.created_by_name}</p>
                            </div>
                            <StatusBadge status={req.status} />
                          </div>
                          <ValidationButtons request={req} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ========== ONGLET MATERIEL ========== */}
            <TabsContent value="MATERIEL" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                {isAdmin ? (
                  /* ADMIN: Formulaire de demande */
                  <div className="bg-orange-50 rounded-2xl p-6 border-2 border-orange-200 mb-6">
                    <h3 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
                      <div className="p-2 bg-orange-500 rounded-lg">
                        <Wrench className="w-6 h-6 text-white" />
                      </div>
                      Demande de matériel
                    </h3>
                    
                    <form onSubmit={handleSubmitMateriel} className="space-y-4">
                      <div className="space-y-3">
                        {materiels.map((mat, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-orange-200">
                            <div className="flex-1">
                              <Input
                                value={mat.nom}
                                onChange={(e) => updateMateriel(index, 'nom', e.target.value)}
                                placeholder="Nom du matériel"
                                className="border-orange-200 focus:border-orange-500"
                              />
                            </div>
                            <div className="w-24">
                              <Input
                                type="number"
                                min="1"
                                value={mat.quantite}
                                onChange={(e) => updateMateriel(index, 'quantite', parseInt(e.target.value) || 1)}
                                className="border-orange-200 focus:border-orange-500 text-center"
                              />
                            </div>
                            <span className="text-sm text-gray-500 w-12">unité(s)</span>
                            {materiels.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMateriel(index)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addMateriel}
                        className="w-full border-dashed border-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Ajouter un matériel
                      </Button>
                      
                      <div>
                        <Label className="text-orange-900 font-semibold">Commentaire</Label>
                        <Textarea
                          value={materielCommentaire}
                          onChange={(e) => setMaterielCommentaire(e.target.value)}
                          placeholder="Précisions sur votre demande..."
                          className="mt-1 min-h-[80px] border-orange-200 focus:border-orange-500"
                        />
                      </div>
                      
                      <Button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 text-lg font-bold bg-orange-600 hover:bg-orange-700"
                      >
                        <Send className="w-5 h-5 mr-2" />
                        Soumettre la demande
                      </Button>
                    </form>
                  </div>
                ) : (
                  /* GESTIONNAIRE: Message si pas de demandes */
                  getCategoryRequests('MATERIEL').length === 0 && (
                    <div className="bg-orange-50 rounded-2xl p-12 text-center border-2 border-orange-200 mb-6">
                      <div className="p-4 bg-orange-100 rounded-2xl w-fit mx-auto mb-4">
                        <Inbox className="w-16 h-16 text-orange-400" />
                      </div>
                      <h3 className="text-xl font-bold text-orange-900 mb-2">Aucune demande de matériel</h3>
                      <p className="text-orange-700">Votre formateur n'a pas encore effectué de demande de matériel</p>
                    </div>
                  )
                )}

                {/* Historique des demandes */}
                {getCategoryRequests('MATERIEL').length > 0 && (
                  <div className="bg-white rounded-2xl border-2 border-orange-200 p-6">
                    <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Historique des demandes de matériel
                    </h4>
                    <div className="space-y-4">
                      {getCategoryRequests('MATERIEL').map((req, idx) => (
                        <div key={req.id || idx} className="p-4 bg-gray-50 rounded-xl border hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {req.items?.map(i => `${i.nom} (x${i.quantite})`).join(', ')}
                              </p>
                              {req.commentaire && <p className="text-sm text-gray-600 mt-1">{req.commentaire}</p>}
                              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Créé le {formatDateTime(req.created_at)}
                              </p>
                              {req.updated_at !== req.created_at && (
                                <p className="text-xs text-gray-400">Mis à jour le {formatDateTime(req.updated_at)}</p>
                              )}
                              <p className="text-xs text-gray-400">Par: {req.created_by_name}</p>
                            </div>
                            <StatusBadge status={req.status} />
                          </div>
                          <ValidationButtons request={req} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ========== ONGLET SUPPORTS ========== */}
            <TabsContent value="SUPPORTS" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
                  <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    Documents & Supports
                  </h3>
                  
                  {/* Zone de téléversement (pour tous) */}
                  <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center bg-white mb-6">
                    <input
                      type="file"
                      id="doc-upload"
                      className="hidden"
                      onChange={handleUploadDocument}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                    />
                    <label 
                      htmlFor="doc-upload"
                      className="cursor-pointer"
                    >
                      <Upload className="w-12 h-12 mx-auto text-purple-400 mb-3" />
                      <p className="text-purple-700 font-semibold mb-1">
                        {uploadingDoc ? 'Téléversement en cours...' : 'Cliquez pour téléverser un document'}
                      </p>
                      <p className="text-sm text-purple-500">
                        PDF, Word, Excel, PowerPoint, ZIP (Max 10MB)
                      </p>
                    </label>
                  </div>
                  
                  {/* Liste des documents avec horodatage */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-purple-900">Documents disponibles</h4>
                    {documents.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Aucun document pour le moment</p>
                    ) : (
                      documents.map((doc, idx) => (
                        <div key={doc.id || idx} className="flex items-center justify-between p-4 bg-white rounded-xl border border-purple-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <FileText className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{doc.filename}</p>
                              <p className="text-xs text-gray-500">
                                Ajouté le {formatDateTime(doc.created_at)} par {doc.uploaded_by_name || 'Inconnu'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc.id, doc.filename)}
                            className="text-purple-600 border-purple-300 hover:bg-purple-50"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Télécharger
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ========== ONGLET ORGANISATION ========== */}
            <TabsContent value="ORGANISATION" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                <div className="bg-green-50 rounded-2xl p-12 text-center border-2 border-green-200">
                  <div className="p-4 bg-green-500 rounded-2xl w-fit mx-auto mb-6">
                    <Calendar className="w-16 h-16 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-900 mb-4">Organisation / Planning</h3>
                  <p className="text-green-700 text-lg mb-2">Section bientôt disponible</p>
                  <p className="text-green-600 text-sm">
                    Cette fonctionnalité est en cours de développement.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ========== ONGLET ACCUEIL ========== */}
            <TabsContent value="ACCUEIL" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                <div className="bg-pink-50 rounded-2xl p-12 text-center border-2 border-pink-200">
                  <div className="p-4 bg-pink-500 rounded-2xl w-fit mx-auto mb-6">
                    <Coffee className="w-16 h-16 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-pink-900 mb-4">Accueil / Logistique</h3>
                  <p className="text-pink-700 text-lg mb-2">Section bientôt disponible</p>
                  <p className="text-pink-600 text-sm">
                    Cette fonctionnalité est en cours de développement.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ========== ONGLET EMAIL ========== */}
            <TabsContent value="EMAIL" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200 mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="p-2 bg-gray-500 rounded-lg">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    {isAdmin ? 'Envoyer un email au centre' : 'Envoyer un email au formateur'}
                  </h3>
                  
                  <form onSubmit={handleSendMail} className="space-y-4">
                    <div>
                      <Label className="text-gray-900 font-semibold">Sujet *</Label>
                      <Input
                        value={mailForm.sujet}
                        onChange={(e) => setMailForm({...mailForm, sujet: e.target.value})}
                        placeholder="Objet de votre message"
                        className="mt-1 border-gray-300 focus:border-gray-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-900 font-semibold">Message *</Label>
                      <Textarea
                        value={mailForm.message}
                        onChange={(e) => setMailForm({...mailForm, message: e.target.value})}
                        placeholder="Écrivez votre message ici..."
                        className="mt-1 min-h-[150px] border-gray-300 focus:border-gray-500"
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-3 text-lg font-bold bg-gray-700 hover:bg-gray-800"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      Envoyer l'email
                    </Button>
                  </form>
                </div>

                {/* Historique des emails avec horodatage complet */}
                {getCategoryRequests('EMAIL').length > 0 && (
                  <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Historique des messages
                    </h4>
                    <div className="space-y-4">
                      {getCategoryRequests('EMAIL').map((req, idx) => (
                        <div key={req.id || idx} className="p-4 bg-gray-50 rounded-xl border hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-gray-200 rounded-full flex-shrink-0">
                              <Mail className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-600">
                                <span className="font-semibold text-gray-900">{req.created_by_name}</span>
                                {' '}vous a envoyé un email
                              </p>
                              <p className="font-semibold text-gray-900 mt-1">Objet : {req.sujet}</p>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{req.message}</p>
                              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(req.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
