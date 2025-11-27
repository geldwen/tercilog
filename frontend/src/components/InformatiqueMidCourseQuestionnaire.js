import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InformatiqueMidCourseQuestionnaire({ open, onClose, studentId, resourceId }) {
  const sigCanvas = useRef(null);
  const [formData, setFormData] = useState({
    nom_prenom: '',
    date_suivi: '',
    formateur_referent: '',
    mode_formation: '',
    attentes_repondues: '',
    rythme_duree: '',
    supports_methodes: '',
    plus_appris: '',
    difficultes_actuelles: [],
    approfondir: '',
    points_approfondir: '',
    suggestions: '',
    zone_formateur: ''
  });
  
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

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      toast.error("Veuillez signer le questionnaire");
      return;
    }

    const signature = sigCanvas.current.toDataURL();

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/student-resources/${resourceId}/submit-questionnaire`,
        {
          answers: formData,
          signature,
          submitted_at: new Date().toISOString()
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      toast.success("Questionnaire soumis avec succès !");
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-indigo-600">
            Q2 – Questionnaire mi-parcours – Informatique
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              1. Informations générales
            </h3>
            
            <div>
              <Label>Nom et prénom</Label>
              <Input value={formData.nom_prenom} onChange={(e) => updateField('nom_prenom', e.target.value)} />
            </div>

            <div>
              <Label>Date du suivi</Label>
              <Input type="date" value={formData.date_suivi} onChange={(e) => updateField('date_suivi', e.target.value)} />
            </div>

            <div>
              <Label>Formateur référent</Label>
              <Input value={formData.formateur_referent} onChange={(e) => updateField('formateur_referent', e.target.value)} />
            </div>

            <div>
              <Label>Mode de formation :</Label>
              <div className="space-y-2 mt-2">
                {['Présentiel', 'Distanciel', 'Hybride'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`mode-${opt}`}
                      name="mode_formation"
                      value={opt}
                      checked={formData.mode_formation === opt}
                      onChange={(e) => updateField('mode_formation', e.target.value)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`mode-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              2. Ressenti sur le déroulement de la formation
            </h3>
            
            <div>
              <Label>La formation répond-elle à vos attentes jusqu'à présent ? *</Label>
              <div className="space-y-2 mt-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`attentes-${opt}`}
                      name="attentes_repondues"
                      value={opt}
                      checked={formData.attentes_repondues === opt}
                      onChange={(e) => updateField('attentes_repondues', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`attentes-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Le rythme et la durée des séances vous conviennent-ils ? *</Label>
              <div className="space-y-2 mt-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`rythme-${opt}`}
                      name="rythme_duree"
                      value={opt}
                      checked={formData.rythme_duree === opt}
                      onChange={(e) => updateField('rythme_duree', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`rythme-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Les supports et méthodes utilisés facilitent-ils votre apprentissage ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui tout à fait', 'Assez', 'Peu', 'Pas du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`supports-${opt}`}
                      name="supports_methodes"
                      value={opt}
                      checked={formData.supports_methodes === opt}
                      onChange={(e) => updateField('supports_methodes', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`supports-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              3. Progression et besoins complémentaires
            </h3>
            
            <div>
              <Label>Qu'avez-vous le plus appris depuis le début ? *</Label>
              <Textarea value={formData.plus_appris} onChange={(e) => updateField('plus_appris', e.target.value)} required rows={4} />
            </div>

            <div>
              <Label>Rencontrez-vous actuellement des difficultés particulières ?</Label>
              <div className="space-y-2 mt-2">
                {['Organisation des fichiers', 'Navigation Internet', 'Manipulation Windows', 'Compréhension des messages', 'Utilisation souris/clavier', 'Autre'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`diff-${opt}`}
                      checked={formData.difficultes_actuelles.includes(opt)}
                      onChange={() => toggleCheckbox('difficultes_actuelles', opt)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`diff-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Souhaitez-vous approfondir certains points d'ici la fin de la formation ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui', 'Non'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`approfondir-${opt}`}
                      name="approfondir"
                      value={opt}
                      checked={formData.approfondir === opt}
                      onChange={(e) => updateField('approfondir', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`approfondir-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Si oui, lesquels ?</Label>
              <Textarea value={formData.points_approfondir} onChange={(e) => updateField('points_approfondir', e.target.value)} rows={3} />
            </div>

            <div>
              <Label>Avez-vous des suggestions pour améliorer la formation ? *</Label>
              <Textarea value={formData.suggestions} onChange={(e) => updateField('suggestions', e.target.value)} required rows={4} />
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              4. Suivi et adaptation (à compléter par le formateur)
            </h3>
            
            <div>
              <Label>Zone réservée formateur :</Label>
              <Textarea value={formData.zone_formateur} onChange={(e) => updateField('zone_formateur', e.target.value)} rows={4} />
            </div>
          </div>

          {/* Section 5 - Signature */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              5. Validation
            </h3>
            
            <div>
              <Label>Signature du stagiaire (horodatée) *</Label>
              <div className="border-2 border-gray-300 rounded mt-2">
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{
                    className: "w-full h-40 touch-none",
                    style: { touchAction: "none" }
                  }}
                  onTouchStart={(e) => e.preventDefault()}
                />
              </div>
              <Button type="button" variant="outline" onClick={clearSignature} className="mt-2">
                Effacer la signature
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? 'Envoi en cours...' : 'Valider le questionnaire'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
