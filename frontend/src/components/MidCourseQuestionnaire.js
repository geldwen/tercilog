import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MidCourseQuestionnaire({ open, onClose, studentId }) {
  const [formData, setFormData] = useState({
    // 1. Informations générales
    nom_prenom: '',
    date_suivi: '',
    formateur_referent: '',
    mode_formation: [],
    
    // 2. Ressenti sur le déroulement
    formation_attentes: '',
    rythme_duree: '',
    supports_methodes: '',
    
    // 3. Progression et besoins
    apprentissages: '',
    difficultes: '',
    approfondir: '',
    approfondir_details: '',
    suggestions: '',
    
    // 4. Suivi formateur (rempli par le formateur)
    observation_formateur: '',
    ajustements: '',
    decision: []
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
        `${API}/students/${studentId}/mid-course-questionnaire`,
        {
          ...formData,
          signature,
          submitted_at: new Date().toISOString()
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      toast.success("Questionnaire à mi-parcours soumis avec succès !");
      onClose();
    } catch (error) {
      console.error("Error submitting mid-course questionnaire:", error);
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#8B5A2B]">
            2) Questionnaire à mi-parcours
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. INFORMATIONS GÉNÉRALES */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">1. Informations générales</h3>
            
            <div className="space-y-2">
              <Label>Nom et prénom</Label>
              <Input
                value={formData.nom_prenom}
                onChange={(e) => updateField('nom_prenom', e.target.value)}
                placeholder="Votre nom et prénom"
              />
            </div>

            <div className="space-y-2">
              <Label>Date du suivi</Label>
              <Input
                type="date"
                value={formData.date_suivi}
                onChange={(e) => updateField('date_suivi', e.target.value)}
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

          {/* 2. RESSENTI SUR LE DÉROULEMENT */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">💬 2. Ressenti sur le déroulement de la formation</h3>
            
            <div className="space-y-2">
              <Label>La formation répond-elle à vos attentes jusqu'à présent ? *</Label>
              <div className="space-y-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formation_attentes"
                      value={option}
                      checked={formData.formation_attentes === option}
                      onChange={(e) => updateField('formation_attentes', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Le rythme et la durée des séances vous conviennent-ils ? *</Label>
              <div className="space-y-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rythme_duree"
                      value={option}
                      checked={formData.rythme_duree === option}
                      onChange={(e) => updateField('rythme_duree', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Les supports et méthodes utilisés facilitent-ils votre apprentissage ? *</Label>
              <div className="space-y-2">
                {['Oui tout à fait', 'Assez', 'Peu', 'Pas du tout'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="supports_methodes"
                      value={option}
                      checked={formData.supports_methodes === option}
                      onChange={(e) => updateField('supports_methodes', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 3. PROGRESSION ET BESOINS */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">🎯 3. Progression et besoins complémentaires</h3>
            
            <div className="space-y-2">
              <Label>Qu'avez-vous le plus appris ou amélioré depuis le début de la formation ?</Label>
              <textarea
                value={formData.apprentissages}
                onChange={(e) => updateField('apprentissages', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>

            <div className="space-y-2">
              <Label>Rencontrez-vous actuellement des difficultés particulières (compréhension, vocabulaire, rythme, autre) ?</Label>
              <textarea
                value={formData.difficultes}
                onChange={(e) => updateField('difficultes', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>

            <div className="space-y-2">
              <Label>Souhaitez-vous approfondir certains points d'ici la fin de la formation ?</Label>
              <div className="flex gap-4">
                {['Oui', 'Non'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="approfondir"
                      value={option}
                      checked={formData.approfondir === option}
                      onChange={(e) => updateField('approfondir', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {formData.approfondir === 'Oui' && (
                <Input
                  value={formData.approfondir_details}
                  onChange={(e) => updateField('approfondir_details', e.target.value)}
                  placeholder="Si oui, précisez..."
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Avez-vous des suggestions pour améliorer le déroulement de la formation ?</Label>
              <textarea
                value={formData.suggestions}
                onChange={(e) => updateField('suggestions', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Votre réponse..."
              />
            </div>
          </div>

          {/* 4. SUIVI FORMATEUR (optionnel côté élève) */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900">🔄 4. Suivi et adaptation (à compléter par le formateur)</h3>
            <p className="text-sm text-gray-600 italic">Cette section sera complétée par votre formateur</p>
          </div>

          {/* SIGNATURE ET SOUMISSION */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <h3 className="text-lg font-bold text-gray-900">✍️ 5. Validation</h3>
            
            <div className="space-y-2">
              <Label>Signature du stagiaire * (horodatée)</Label>
              <SignaturePad onSave={setSignature} />
            </div>

            <Button
              type="submit"
              disabled={submitting || !signature}
              className="w-full py-6 text-lg font-bold bg-[#8B5A2B] hover:bg-[#7A4F26] text-white"
            >
              {submitting ? 'Soumission en cours...' : 'Soumettre le questionnaire à mi-parcours'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
