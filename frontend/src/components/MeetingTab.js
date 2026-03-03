import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { 
  Video, Calendar, Clock, CheckCircle, XCircle, 
  Users, RefreshCw, ExternalLink 
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function MeetingTab({ clientId, userName }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/meetings`);
      setMeetings(response.data || []);
    } catch (error) {
      console.error('Erreur chargement réunions:', error);
      toast.error('Erreur lors du chargement des réunions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleRespond = async (meetingId, accepted) => {
    try {
      await axios.post(`${API}/meetings/${meetingId}/respond`, { accepted });
      toast.success(accepted ? 'Invitation acceptée !' : 'Invitation refusée');
      loadMeetings();
    } catch (error) {
      console.error('Erreur réponse:', error);
      toast.error('Erreur lors de la réponse');
    }
  };

  const getMyResponse = (meeting) => {
    const clientInfo = meeting.clients?.find(c => c.client_id === clientId);
    return clientInfo?.response;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const isUpcoming = (meeting) => {
    const meetingDate = new Date(`${meeting.date}T${meeting.start_time}`);
    return meetingDate > new Date();
  };

  const canJoin = (meeting) => {
    const myResponse = getMyResponse(meeting);
    if (myResponse !== 'accepted') return false;
    
    const now = new Date();
    const meetingStart = new Date(`${meeting.date}T${meeting.start_time}`);
    const meetingEnd = new Date(`${meeting.date}T${meeting.end_time}`);
    
    // Peut rejoindre 10 min avant jusqu'à la fin
    const joinStart = new Date(meetingStart.getTime() - 10 * 60 * 1000);
    return now >= joinStart && now <= meetingEnd;
  };

  const pendingMeetings = meetings.filter(m => getMyResponse(m) === null && isUpcoming(m));
  const acceptedMeetings = meetings.filter(m => getMyResponse(m) === 'accepted');
  const refusedMeetings = meetings.filter(m => getMyResponse(m) === 'refused');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Video className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Mes Réunions</h2>
            <p className="text-sm text-gray-500">Gérez vos invitations et rejoignez vos réunions</p>
          </div>
        </div>
        <Button 
          onClick={loadMeetings} 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      {/* Invitations en attente */}
      {pendingMeetings.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
          <h3 className="text-lg font-semibold text-amber-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Invitations en attente ({pendingMeetings.length})
          </h3>
          <div className="space-y-4">
            {pendingMeetings.map(meeting => (
              <div 
                key={meeting.id} 
                className="bg-white rounded-xl p-5 shadow-sm border border-amber-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-lg">{meeting.title}</h4>
                    {meeting.description && (
                      <p className="text-gray-600 text-sm mt-1">{meeting.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
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
                        Proposé par {meeting.created_by_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => handleRespond(meeting.id, true)}
                      className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Accepter
                    </Button>
                    <Button
                      onClick={() => handleRespond(meeting.id, false)}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Refuser
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Réunions acceptées */}
      {acceptedMeetings.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Réunions confirmées ({acceptedMeetings.length})
          </h3>
          <div className="space-y-4">
            {acceptedMeetings.map(meeting => (
              <div 
                key={meeting.id} 
                className="bg-white rounded-xl p-5 shadow-sm border border-green-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-lg">{meeting.title}</h4>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-green-500" />
                        {formatDate(meeting.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-green-500" />
                        {meeting.start_time} - {meeting.end_time}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {canJoin(meeting) ? (
                      <a
                        href={`https://meet.jit.si/${meeting.jitsi_room}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg"
                      >
                        <Video className="w-5 h-5" />
                        Rejoindre la réunion
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">
                        <Clock className="w-4 h-4" />
                        {isUpcoming(meeting) ? 'Disponible bientôt' : 'Terminée'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Réunions refusées */}
      {refusedMeetings.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-600 mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Invitations refusées ({refusedMeetings.length})
          </h3>
          <div className="space-y-3">
            {refusedMeetings.map(meeting => (
              <div 
                key={meeting.id} 
                className="bg-white rounded-xl p-4 border border-gray-100 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-700">{meeting.title}</h4>
                    <p className="text-sm text-gray-500">
                      {formatDate(meeting.date)} • {meeting.start_time}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm">
                    Refusée
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aucune réunion */}
      {meetings.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
          <Video className="w-16 h-16 mx-auto text-purple-200 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucune réunion</h3>
          <p className="text-gray-500">
            Vous n'avez pas encore d'invitation à une réunion.
          </p>
        </div>
      )}
    </div>
  );
}
