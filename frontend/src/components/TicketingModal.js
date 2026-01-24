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
  Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Search, Filter, ArrowLeft, Paperclip
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CATEGORIES = [
  { id: 'SALLES', label: 'Salles', icon: Building, color: 'bg-blue-500' },
  { id: 'MATERIEL', label: 'Matériel', icon: Wrench, color: 'bg-orange-500' },
  { id: 'SUPPORTS', label: 'Supports / Documents', icon: FileText, color: 'bg-purple-500' },
  { id: 'PLANNING', label: 'Organisation / Planning', icon: Calendar, color: 'bg-green-500' },
  { id: 'ACCUEIL', label: 'Accueil / Logistique', icon: Coffee, color: 'bg-pink-500' },
  { id: 'AUTRE', label: 'Autre demande', icon: HelpCircle, color: 'bg-gray-500' }
];

const STATUS_LABELS = {
  EN_ATTENTE: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  REPONSE_ATTENDUE: { label: 'Réponse attendue', color: 'bg-blue-100 text-blue-800', icon: MessageSquare },
  ACCEPTEE: { label: 'Acceptée', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  REFUSEE: { label: 'Refusée', color: 'bg-red-100 text-red-800', icon: XCircle },
  MODIFICATION_DEMANDEE: { label: 'Modification demandée', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  CLOTUREE: { label: 'Clôturée', color: 'bg-gray-100 text-gray-800', icon: CheckCircle }
};

export default function TicketingModal({ open, onClose, userRole, userId, clientId }) {
  const [activeCategory, setActiveCategory] = useState('SALLES');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // Filtres
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Formulaire de création
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    desired_date: '',
    location: ''
  });
  
  // Réponse
  const [replyText, setReplyText] = useState('');
  
  // Destinataires
  const [centers, setCenters] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');

  useEffect(() => {
    if (open) {
      loadTickets();
      loadRecipients();
    }
  }, [open, activeCategory, statusFilter, directionFilter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (activeCategory !== 'all') params.append('category', activeCategory);
      if (directionFilter !== 'all') params.append('direction', directionFilter);
      
      const response = await axios.get(`${API}/tickets?${params.toString()}`);
      setTickets(response.data);
    } catch (error) {
      console.error('Erreur chargement tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async () => {
    try {
      if (userRole === 'teacher') {
        const res = await axios.get(`${API}/tickets/recipients/centers`);
        setCenters(res.data);
      } else {
        const res = await axios.get(`${API}/tickets/recipients/trainers`);
        setTrainers(res.data);
      }
    } catch (error) {
      console.error('Erreur chargement destinataires:', error);
    }
  };

  const loadTicketDetail = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`);
      setSelectedTicket(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error('Veuillez remplir le sujet et la description');
      return;
    }

    try {
      const payload = {
        category: activeCategory,
        subject: formData.subject,
        description: formData.description,
        desired_date: formData.desired_date || null,
        location: formData.location || null
      };
      
      if (userRole === 'teacher' && selectedRecipient) {
        payload.recipient_center_id = selectedRecipient;
      } else if (userRole === 'gestionnaire' && selectedRecipient) {
        payload.recipient_trainer_id = selectedRecipient;
      }

      await axios.post(`${API}/tickets`, payload);
      toast.success('Demande envoyée avec succès');
      setFormData({ subject: '', description: '', desired_date: '', location: '' });
      setSelectedRecipient('');
      setShowCreateForm(false);
      loadTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi');
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;

    try {
      await axios.post(`${API}/tickets/${selectedTicket.id}/messages`, {
        body: replyText
      });
      toast.success('Réponse envoyée');
      setReplyText('');
      loadTicketDetail(selectedTicket.id);
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedTicket) return;

    try {
      await axios.patch(`${API}/tickets/${selectedTicket.id}/status`, {
        status: newStatus
      });
      toast.success('Statut mis à jour');
      loadTicketDetail(selectedTicket.id);
      loadTickets();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        ticket.subject.toLowerCase().includes(query) ||
        (ticket.description || '').toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            Mes demandes centre
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Vue détail d'un ticket */}
          {selectedTicket ? (
            <div className="flex-1 flex flex-col">
              {/* Header du ticket */}
              <div className="p-4 border-b bg-gray-50">
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la liste
                </button>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedTicket.subject}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${CATEGORIES.find(c => c.id === selectedTicket.category)?.color} text-white`}>
                        {CATEGORIES.find(c => c.id === selectedTicket.category)?.label}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[selectedTicket.status]?.color}`}>
                        {STATUS_LABELS[selectedTicket.status]?.label}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions de statut */}
                  <div className="flex gap-2">
                    {userRole === 'gestionnaire' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('ACCEPTEE')} className="text-green-600 border-green-300">
                          Accepter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('REFUSEE')} className="text-red-600 border-red-300">
                          Refuser
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('CLOTUREE')} className="text-gray-600">
                      Clôturer
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedTicket.messages?.map((msg, idx) => (
                  <div 
                    key={msg.id || idx}
                    className={`p-4 rounded-lg max-w-[80%] ${
                      msg.sender_user_id === userId 
                        ? 'ml-auto bg-blue-100' 
                        : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm">{msg.sender_name}</span>
                      <span className="text-xs text-gray-500">{formatDate(msg.created_at)}</span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))}
              </div>

              {/* Zone de réponse */}
              {selectedTicket.status !== 'CLOTUREE' && (
                <div className="p-4 border-t bg-white">
                  <div className="flex gap-3">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Écrire une réponse..."
                      className="flex-1 min-h-[80px]"
                    />
                    <Button onClick={handleSendReply} disabled={!replyText.trim()} className="self-end">
                      <Send className="w-4 h-4 mr-2" />
                      Envoyer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Liste des tickets */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Onglets catégories */}
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col min-h-0">
                <div className="border-b px-4 flex-shrink-0">
                  <TabsList className="bg-transparent h-auto gap-1 flex-wrap justify-start py-3">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      return (
                        <TabsTrigger
                          key={cat.id}
                          value={cat.id}
                          className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 rounded-lg border border-transparent data-[state=active]:border-blue-200"
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {cat.label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>

                {CATEGORIES.map(cat => (
                  <TabsContent key={cat.id} value={cat.id} className="flex-1 flex flex-col mt-0 overflow-hidden min-h-0">
                    {/* Formulaire création ou bouton */}
                    <div className="p-4 border-b bg-blue-50 flex-shrink-0">
                      {showCreateForm ? (
                        <form onSubmit={handleCreateTicket} className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-800 text-lg">Créer une demande</h4>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                              Annuler
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Sujet *</Label>
                              <Input
                                value={formData.subject}
                                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                placeholder="Objet de la demande"
                                required
                              />
                            </div>
                            <div>
                              <Label>Destinataire</Label>
                              <select
                                value={selectedRecipient}
                                onChange={(e) => setSelectedRecipient(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              >
                                <option value="">-- Sélectionner --</option>
                                {userRole === 'teacher' 
                                  ? centers.map(c => (
                                      <option key={c.id} value={c.id}>{c.nom_centre}</option>
                                    ))
                                  : trainers.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))
                                }
                              </select>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Date souhaitée</Label>
                              <Input
                                type="date"
                                value={formData.desired_date}
                                onChange={(e) => setFormData({...formData, desired_date: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Lieu</Label>
                              <Input
                                value={formData.location}
                                onChange={(e) => setFormData({...formData, location: e.target.value})}
                                placeholder="Salle, adresse..."
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label>Description *</Label>
                            <Textarea
                              value={formData.description}
                              onChange={(e) => setFormData({...formData, description: e.target.value})}
                              placeholder="Détaillez votre demande..."
                              className="min-h-[100px]"
                              required
                            />
                          </div>
                          
                          <Button type="submit" className="w-full">
                            <Send className="w-4 h-4 mr-2" />
                            Envoyer la demande
                          </Button>
                        </form>
                      ) : (
                        <Button onClick={() => setShowCreateForm(true)} className="w-full">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Créer une demande ({cat.label})
                        </Button>
                      )}
                    </div>

                    {/* Filtres */}
                    <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="all">Tous les statuts</option>
                          <option value="EN_ATTENTE">En attente</option>
                          <option value="REPONSE_ATTENDUE">Réponse attendue</option>
                          <option value="ACCEPTEE">Acceptée</option>
                          <option value="REFUSEE">Refusée</option>
                          <option value="CLOTUREE">Clôturée</option>
                        </select>
                      </div>
                      <select
                        value={directionFilter}
                        onChange={(e) => setDirectionFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      >
                        <option value="all">Toutes</option>
                        <option value="sent">Envoyées</option>
                        <option value="received">Reçues</option>
                      </select>
                      <div className="flex-1 max-w-xs">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher..."
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">{filteredTickets.length} demande(s)</span>
                    </div>

                    {/* Liste */}
                    <div className="flex-1 overflow-y-auto">
                      {loading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : filteredTickets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>Aucune demande dans cette catégorie</p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredTickets.map(ticket => {
                            const StatusIcon = STATUS_LABELS[ticket.status]?.icon || Clock;
                            return (
                              <button
                                key={ticket.id}
                                onClick={() => loadTicketDetail(ticket.id)}
                                className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4"
                              >
                                <div className={`p-2 rounded-lg ${CATEGORIES.find(c => c.id === ticket.category)?.color}`}>
                                  {(() => {
                                    const CatIcon = CATEGORIES.find(c => c.id === ticket.category)?.icon || HelpCircle;
                                    return <CatIcon className="w-5 h-5 text-white" />;
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 truncate">{ticket.subject}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[ticket.status]?.color}`}>
                                      {STATUS_LABELS[ticket.status]?.label}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {ticket.message_count || 1} message(s)
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {formatDate(ticket.last_message_at)}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
