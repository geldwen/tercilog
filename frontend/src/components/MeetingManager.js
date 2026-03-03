import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Video, Calendar, Clock, Plus, Edit, Trash2, 
  Users, CheckCircle, XCircle, RefreshCw, Send, ExternalLink
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function MeetingManager({ clients = [] }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    client_ids: []
  });

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/meetings`);
      setMeetings(response.data || []);
    } catch (error) {
      console.error('Erreur chargement réunions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      start_time: '',
      end_time: '',
      client_ids: []
    });
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.date || !formData.start_time || !formData.end_time) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (formData.client_ids.length === 0) {
      toast.error('Veuillez sélectionner au moins un client');
      return;
    }

    try {
      await axios.post(`${API}/meetings`, formData);
      toast.success('Réunion créée ! Invitations envoyées par email.');
      setShowCreateModal(false);
      resetForm();
      loadMeetings();
    } catch (error) {
      console.error('Erreur création:', error);
      toast.error('Erreur lors de la création de la réunion');
    }
  };

  const handleUpdate = async () => {
    if (!selectedMeeting) return;

    try {
      await axios.put(`${API}/meetings/${selectedMeeting.id}`, formData);
      toast.success('Réunion mise à jour');
      setShowEditModal(false);
      setSelectedMeeting(null);
      resetForm();
      loadMeetings();
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (meetingId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette réunion ?')) return;

    try {
      await axios.delete(`${API}/meetings/${meetingId}`);
      toast.success('Réunion supprimée');
      loadMeetings();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const openEditModal = (meeting) => {
    setSelectedMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      date: meeting.date,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      client_ids: meeting.clients?.map(c => c.client_id) || []
    });
    setShowEditModal(true);
  };

  const toggleClientSelection = (clientId) => {
    setFormData(prev => ({
      ...prev,
      client_ids: prev.client_ids.includes(clientId)
        ? prev.client_ids.filter(id => id !== clientId)
        : [...prev.client_ids, clientId]
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const getStatusBadge = (meeting) => {
    const responses = meeting.clients || [];
    const acceptedCount = responses.filter(c => c.response === 'accepted').length;
    const refusedCount = responses.filter(c => c.response === 'refused').length;
    const pendingCount = responses.filter(c => c.response === null).length;

    if (meeting.status === 'cancelled') {
      return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">Annulée</span>;
    }
    if (acceptedCount > 0) {
      return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">{acceptedCount} confirmé(s)</span>;
    }
    if (pendingCount > 0) {
      return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">{pendingCount} en attente</span>;
    }
    return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">Aucune réponse</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Video className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Gestion des Réunions</h2>
            <p className="text-sm text-gray-500">Créez et gérez vos réunions vidéo avec Jitsi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadMeetings} 
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
          <Button 
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouvelle réunion
          </Button>
        </div>
      </div>

      {/* Liste des réunions */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
          <Video className="w-16 h-16 mx-auto text-purple-200 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucune réunion</h3>
          <p className="text-gray-500 mb-6">Créez votre première réunion pour inviter vos clients</p>
          <Button 
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Créer une réunion
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map(meeting => (
            <div 
              key={meeting.id} 
              className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg">{meeting.title}</h3>
                    {getStatusBadge(meeting)}
                  </div>
                  {meeting.description && (
                    <p className="text-gray-600 text-sm mb-3">{meeting.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      {formatDate(meeting.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-purple-500" />
                      {meeting.start_time} - {meeting.end_time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-purple-500" />
                      {meeting.clients?.length || 0} invité(s)
                    </span>
                  </div>
                  
                  {/* Réponses des clients */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {meeting.clients?.map(client => (
                      <span 
                        key={client.client_id}
                        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                          client.response === 'accepted' 
                            ? 'bg-green-100 text-green-700' 
                            : client.response === 'refused'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {client.response === 'accepted' && <CheckCircle className="w-3 h-3" />}
                        {client.response === 'refused' && <XCircle className="w-3 h-3" />}
                        {client.client_name}
                        {client.response === null && ' (en attente)'}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 ml-4">
                  <a
                    href={`https://meet.jit.si/${meeting.jitsi_room}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all text-sm"
                  >
                    <Video className="w-4 h-4" />
                    Rejoindre
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <Button
                    onClick={() => openEditModal(meeting)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Modifier
                  </Button>
                  <Button
                    onClick={() => handleDelete(meeting.id)}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Création */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Video className="w-5 h-5 text-purple-600" />
              </div>
              Nouvelle Réunion
            </DialogTitle>
            <DialogDescription>
              Créez une réunion et invitez vos clients. Ils recevront un email d'invitation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Titre de la réunion *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Point mensuel, Formation Excel..."
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez l'objectif de la réunion..."
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Heure début *</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Heure fin *</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label>Clients à inviter *</Label>
              <p className="text-sm text-gray-500 mb-2">Sélectionnez les clients qui recevront l'invitation</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {clients.map(client => (
                  <div
                    key={client.id}
                    onClick={() => toggleClientSelection(client.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all flex items-center gap-2 ${
                      formData.client_ids.includes(client.id)
                        ? 'bg-purple-100 border-2 border-purple-500'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    {formData.client_ids.includes(client.id) ? (
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                    <span className="font-medium text-sm">{client.nom_centre}</span>
                  </div>
                ))}
              </div>
              {formData.client_ids.length > 0 && (
                <p className="text-sm text-purple-600 mt-2">
                  {formData.client_ids.length} client(s) sélectionné(s)
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-700 gap-2">
              <Send className="w-4 h-4" />
              Créer et envoyer les invitations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Modification */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Edit className="w-5 h-5 text-purple-600" />
              </div>
              Modifier la réunion
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Titre de la réunion *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Heure début *</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Heure fin *</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label>Clients invités</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {clients.map(client => (
                  <div
                    key={client.id}
                    onClick={() => toggleClientSelection(client.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all flex items-center gap-2 ${
                      formData.client_ids.includes(client.id)
                        ? 'bg-purple-100 border-2 border-purple-500'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    {formData.client_ids.includes(client.id) ? (
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                    <span className="font-medium text-sm">{client.nom_centre}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} className="bg-purple-600 hover:bg-purple-700 gap-2">
              <CheckCircle className="w-4 h-4" />
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
