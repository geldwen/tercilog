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
  MessageSquare, Send, Building, Wrench, FileText, Calendar, Coffee, HelpCircle,
  Clock, Plus, Trash2, Upload, Download, Mail, Users, MapPin, X
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORIES = [
  { id: 'SALLES', label: 'Salles', icon: Building, color: 'bg-blue-500' },
  { id: 'MATERIEL', label: 'Matériel', icon: Wrench, color: 'bg-orange-500' },
  { id: 'SUPPORTS', label: 'Supports', icon: FileText, color: 'bg-purple-500' },
  { id: 'ORGANISATION', label: 'Organisation', icon: Calendar, color: 'bg-green-500' },
  { id: 'ACCUEIL', label: 'Accueil', icon: Coffee, color: 'bg-pink-500' },
  { id: 'AUTRE', label: 'Autre', icon: HelpCircle, color: 'bg-gray-500' }
];

export default function TicketingModal({ open, onClose, userRole, userId, clientId }) {
  const [activeCategory, setActiveCategory] = useState('SALLES');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  
  // Formulaire Salles
  const [salleForm, setSalleForm] = useState({
    lieu: '',
    centre: '',
    nombre_personnes: '',
    type_reservation: 'journee', // journee ou demi_journee
    date_souhaitee: '',
    email_destinataire: '',
    commentaire: ''
  });
  
  // Formulaire Matériel
  const [materiels, setMateriels] = useState([{ nom: '', quantite: 1 }]);
  const [materielCommentaire, setMaterielCommentaire] = useState('');
  
  // Formulaire Supports - documents
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  // Formulaire Autre - mail
  const [mailForm, setMailForm] = useState({
    sujet: '',
    message: ''
  });

  useEffect(() => {
    if (open) {
      loadRequests();
      loadDocuments();
    }
  }, [open, activeCategory]);

  const loadRequests = async () => {
    try {
      const response = await axios.get(`${API}/ticketing/requests?category=${activeCategory}`);
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
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ========== SALLES ==========
  const handleSubmitSalle = async (e) => {
    e.preventDefault();
    if (!salleForm.lieu || !salleForm.date_souhaitee || !salleForm.nombre_personnes) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/ticketing/salles`, salleForm);
      toast.success('Demande de salle envoyée avec succès !');
      setSalleForm({
        lieu: '',
        centre: '',
        nombre_personnes: '',
        type_reservation: 'journee',
        date_souhaitee: '',
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

  // ========== MATERIEL ==========
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

  // ========== AUTRE (MAIL) ==========
  const handleSendMail = async (e) => {
    e.preventDefault();
    if (!mailForm.sujet || !mailForm.message) {
      toast.error('Veuillez remplir le sujet et le message');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/ticketing/mail`, mailForm);
      toast.success('Mail envoyé avec succès !');
      setMailForm({ sujet: '', message: '' });
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  // Historique des demandes pour la catégorie active
  const categoryRequests = requests.filter(r => r.category === activeCategory);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-white/20 rounded-lg">
              <MessageSquare className="w-6 h-6" />
            </div>
            {userRole === 'teacher' ? 'Mes échanges centre' : 'Mes échanges formateur'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col min-h-0">
            {/* Onglets des catégories */}
            <div className="border-b px-4 bg-gray-50 flex-shrink-0">
              <TabsList className="bg-transparent h-auto gap-2 flex-wrap justify-start py-4">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className={`px-5 py-3 text-base font-semibold data-[state=active]:text-white rounded-xl border-2 border-transparent transition-all ${
                        activeCategory === cat.id 
                          ? `${cat.color} text-white shadow-lg` 
                          : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
                      }`}
                      data-testid={`tab-${cat.id.toLowerCase()}`}
                    >
                      <Icon className="w-5 h-5 mr-2" />
                      {cat.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* ========== ONGLET SALLES ========== */}
            <TabsContent value="SALLES" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                <div className="bg-blue-50 rounded-2xl p-6 mb-6">
                  <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Building className="w-6 h-6" />
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
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-blue-900 font-semibold">Centre</Label>
                        <Input
                          value={salleForm.centre}
                          onChange={(e) => setSalleForm({...salleForm, centre: e.target.value})}
                          placeholder="Nom du centre"
                          className="mt-1"
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
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-blue-900 font-semibold">Type de réservation *</Label>
                        <select
                          value={salleForm.type_reservation}
                          onChange={(e) => setSalleForm({...salleForm, type_reservation: e.target.value})}
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-base"
                        >
                          <option value="journee">Journée complète</option>
                          <option value="demi_journee_matin">Demi-journée (Matin)</option>
                          <option value="demi_journee_apres_midi">Demi-journée (Après-midi)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-blue-900 font-semibold">Date souhaitée *</Label>
                        <Input
                          type="date"
                          value={salleForm.date_souhaitee}
                          onChange={(e) => setSalleForm({...salleForm, date_souhaitee: e.target.value})}
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-blue-900 font-semibold">Email destinataire</Label>
                        <Input
                          type="email"
                          value={salleForm.email_destinataire}
                          onChange={(e) => setSalleForm({...salleForm, email_destinataire: e.target.value})}
                          placeholder="email@exemple.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-blue-900 font-semibold">Commentaire</Label>
                      <Textarea
                        value={salleForm.commentaire}
                        onChange={(e) => setSalleForm({...salleForm, commentaire: e.target.value})}
                        placeholder="Précisions supplémentaires..."
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-3 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                      data-testid="submit-salle-btn"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      Soumettre la demande
                    </Button>
                  </form>
                </div>

                {/* Historique des demandes de salles */}
                {categoryRequests.length > 0 && (
                  <div className="bg-white rounded-2xl border p-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Historique des demandes
                    </h4>
                    <div className="space-y-3">
                      {categoryRequests.map((req, idx) => (
                        <div key={req.id || idx} className="p-4 bg-gray-50 rounded-xl border">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-gray-900">{req.lieu} - {req.centre || 'Non spécifié'}</p>
                              <p className="text-sm text-gray-600">{req.nombre_personnes} personnes • {req.type_reservation === 'journee' ? 'Journée' : 'Demi-journée'}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              req.status === 'ACCEPTEE' ? 'bg-green-100 text-green-800' :
                              req.status === 'REFUSEE' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {req.status || 'En attente'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(req.created_at)}
                          </p>
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
                <div className="bg-orange-50 rounded-2xl p-6 mb-6">
                  <h3 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
                    <Wrench className="w-6 h-6" />
                    Demande de matériel
                  </h3>
                  
                  <form onSubmit={handleSubmitMateriel} className="space-y-4">
                    <div className="space-y-3">
                      {materiels.map((mat, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-xl border">
                          <div className="flex-1">
                            <Input
                              value={mat.nom}
                              onChange={(e) => updateMateriel(index, 'nom', e.target.value)}
                              placeholder="Nom du matériel"
                              className="border-orange-200 focus:border-orange-400"
                            />
                          </div>
                          <div className="w-24">
                            <Input
                              type="number"
                              min="1"
                              value={mat.quantite}
                              onChange={(e) => updateMateriel(index, 'quantite', parseInt(e.target.value) || 1)}
                              className="border-orange-200 focus:border-orange-400 text-center"
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
                      data-testid="add-materiel-btn"
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
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-3 text-lg font-bold bg-orange-600 hover:bg-orange-700"
                      data-testid="submit-materiel-btn"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      Soumettre la demande
                    </Button>
                  </form>
                </div>

                {/* Historique des demandes de matériel */}
                {categoryRequests.length > 0 && (
                  <div className="bg-white rounded-2xl border p-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Historique des demandes
                    </h4>
                    <div className="space-y-3">
                      {categoryRequests.map((req, idx) => (
                        <div key={req.id || idx} className="p-4 bg-gray-50 rounded-xl border">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {req.items?.map(i => `${i.nom} (x${i.quantite})`).join(', ')}
                              </p>
                              {req.commentaire && <p className="text-sm text-gray-600">{req.commentaire}</p>}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              req.status === 'ACCEPTEE' ? 'bg-green-100 text-green-800' :
                              req.status === 'REFUSEE' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {req.status || 'En attente'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(req.created_at)}
                          </p>
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
                <div className="bg-purple-50 rounded-2xl p-6 mb-6">
                  <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    Documents & Supports
                  </h3>
                  
                  {/* Zone de téléversement */}
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
                  
                  {/* Liste des documents */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-purple-900">Documents disponibles</h4>
                    {documents.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Aucun document pour le moment</p>
                    ) : (
                      documents.map((doc, idx) => (
                        <div key={doc.id || idx} className="flex items-center justify-between p-4 bg-white rounded-xl border hover:shadow-md transition-shadow">
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
                <div className="bg-green-50 rounded-2xl p-12 text-center">
                  <Calendar className="w-20 h-20 mx-auto text-green-300 mb-6" />
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
                <div className="bg-pink-50 rounded-2xl p-12 text-center">
                  <Coffee className="w-20 h-20 mx-auto text-pink-300 mb-6" />
                  <h3 className="text-2xl font-bold text-pink-900 mb-4">Accueil / Logistique</h3>
                  <p className="text-pink-700 text-lg mb-2">Section bientôt disponible</p>
                  <p className="text-pink-600 text-sm">
                    Cette fonctionnalité est en cours de développement.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ========== ONGLET AUTRE ========== */}
            <TabsContent value="AUTRE" className="flex-1 overflow-y-auto p-6 mt-0">
              <div className="max-w-3xl mx-auto">
                <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Mail className="w-6 h-6" />
                    {userRole === 'teacher' ? 'Envoyer un mail au centre' : 'Envoyer un mail au formateur'}
                  </h3>
                  
                  <form onSubmit={handleSendMail} className="space-y-4">
                    <div>
                      <Label className="text-gray-900 font-semibold">Sujet *</Label>
                      <Input
                        value={mailForm.sujet}
                        onChange={(e) => setMailForm({...mailForm, sujet: e.target.value})}
                        placeholder="Objet de votre message"
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-900 font-semibold">Message *</Label>
                      <Textarea
                        value={mailForm.message}
                        onChange={(e) => setMailForm({...mailForm, message: e.target.value})}
                        placeholder="Écrivez votre message ici..."
                        className="mt-1 min-h-[200px]"
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-3 text-lg font-bold bg-gray-700 hover:bg-gray-800"
                      data-testid="submit-mail-btn"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      Envoyer le mail
                    </Button>
                  </form>
                </div>

                {/* Historique des mails */}
                {categoryRequests.length > 0 && (
                  <div className="bg-white rounded-2xl border p-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Historique des messages
                    </h4>
                    <div className="space-y-3">
                      {categoryRequests.map((req, idx) => (
                        <div key={req.id || idx} className="p-4 bg-gray-50 rounded-xl border">
                          <p className="font-semibold text-gray-900">{req.sujet}</p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{req.message}</p>
                          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(req.created_at)}
                          </p>
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
