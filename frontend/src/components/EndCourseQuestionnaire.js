import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function EndCourseQuestionnaire({ open, onClose, studentId }) {
  const [formData, setFormData] = useState({
    // 1. Informations générales
    nom_prenom: '',
    date: '',
    formateur_referent: '',
    duree_totale: '',
    mode_formation: [],
    
    // 2. Évaluation des acquis
    progression: '',
    domaines_amelioration: [],
    domaines_autre: '',
    aise_professionnel: '',
    points_renforcer: '',
    objectifs_atteints: ''
  });

  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCheckbox = (field, value) => {
    setFormData(prev => {
      const current = prev[field] || [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!signature) {
      toast.error("Veuillez signer le questionnaire");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/students/${studentId}/end-course-questionnaire`,
        {
          ...formData,
          signature,
          submitted_at: new Date().toISOString()
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      toast.success("Questionnaire de fin de formation soumis avec succès !");
      onClose();
    } catch (error) {
      console.error("Error submitting end-course questionnaire:", error);
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  // Horodatage actuel
  const currentTimestamp = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1E3A5F]">
            Q3 – Questionnaire de fin de formation
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. INFORMATIONS GÉNÉRALES */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">📋 1. Informations générales</h3>
            
            <div className="space-y-2">
              <Label>Nom et prénom</Label>
              <Input
                value={formData.nom_prenom}
                onChange={(e) => updateField('nom_prenom', e.target.value)}
                placeholder="Votre nom et prénom"
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Formateur référent</Label>
              <Input
                value={formData.formateur_referent}
                onChange={(e) => updateField('formateur_referent', e.target.value)}
                placeholder="Nom du formateur"
              />
            </div>

            <div className="space-y-2">
              <Label>Durée totale suivie</Label>
              <Input
                value={formData.duree_totale}
                onChange={(e) => updateField('duree_totale', e.target.value)}
                placeholder="Ex: 30 heures"
              />
            </div>

            <div className="space-y-2">
              <Label>Mode de formation</Label>
              <div className="space-y-2">
                {['Présentiel', 'Distanciel', 'Hybride'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.mode_formation.includes(option)}
                      onChange={() => toggleCheckbox('mode_formation', option)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 2. ÉVALUATION DES ACQUIS */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">🎯 2. Évaluation de vos acquis</h3>
            
            <div className="space-y-2">
              <Label>Pensez-vous avoir progressé depuis le début de la formation ? *</Label>
              <div className="space-y-2">
                {['Oui, beaucoup', 'Oui, un peu', 'Peu', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="progression"
                      value={option}
                      checked={formData.progression === option}
                      onChange={(e) => updateField('progression', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dans quels domaines avez-vous constaté le plus d'amélioration ? *</Label>
              <div className="space-y-2">
                {['Compréhension orale', 'Expression orale', 'Compréhension écrite', 'Expression écrite'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.domaines_amelioration.includes(option)}
                      onChange={() => toggleCheckbox('domaines_amelioration', option)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vous sentez-vous plus à l'aise pour utiliser l'anglais dans votre environnement professionnel ? *</Label>
              <div className="space-y-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="aise_professionnel"
                      value={option}
                      checked={formData.aise_professionnel === option}
                      onChange={(e) => updateField('aise_professionnel', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quels points souhaitez-vous encore renforcer ?</Label>
              <textarea
                value={formData.points_renforcer}
                onChange={(e) => updateField('points_renforcer', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>

            <div className="space-y-2">
              <Label>Avez-vous atteint les objectifs fixés en début de formation ? *</Label>
              <div className="space-y-2">
                {['Oui totalement', 'Partiellement', 'Non encore', 'Non du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="objectifs_atteints"
                      value={option}
                      checked={formData.objectifs_atteints === option}
                      onChange={(e) => updateField('objectifs_atteints', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* SIGNATURE ET SOUMISSION */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <h3 className="text-lg font-bold text-gray-900">✍️ Validation</h3>
            
            <div className="text-sm text-gray-600 bg-white p-3 rounded border">
              <strong>Horodatage :</strong> {currentTimestamp}
            </div>
            
            <div className="space-y-2">
              <Label>Signature du stagiaire * (horodatée)</Label>
              <SignaturePad onSave={setSignature} />
            </div>

            <Button
              type="submit"
              disabled={submitting || !signature}
              className="w-full py-6 text-lg font-bold bg-[#1E3A5F] hover:bg-[#152d4a] text-white"
            >
              {submitting ? 'Soumission en cours...' : 'Soumettre le questionnaire de fin de formation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
