import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InformatiqueEndCourseQuestionnaire({ open, onClose, studentId, resourceId }) {
  const [formData, setFormData] = useState({
    nom_prenom: '',
    date: '',
    formateur_referent: '',
    duree_totale: '',
    mode_formation: '',
    progression: '',
    domaines_amelioration: [],
    aise_ordinateur: '',
    points_renforcer: '',
    objectifs_atteints: '',
    contenu_adapte: '',
    rythme_duree: '',
    formateur_attentes: '',
    evaluation_globale: '',
    recommandation: '',
    utilisation_competences: '',
    formation_complementaire: ''
  });
  
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

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
            Q3 – Questionnaire fin de formation – Informatique
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
              <Label>Date</Label>
              <Input type="date" value={formData.date} onChange={(e) => updateField('date', e.target.value)} />
            </div>

            <div>
              <Label>Formateur référent</Label>
              <Input value={formData.formateur_referent} onChange={(e) => updateField('formateur_referent', e.target.value)} />
            </div>

            <div>
              <Label>Durée totale suivie</Label>
              <Input value={formData.duree_totale} onChange={(e) => updateField('duree_totale', e.target.value)} />
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
              2. Évaluation de vos acquis
            </h3>
            
            <div>
              <Label>Pensez-vous avoir progressé depuis le début de la formation ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui, beaucoup', 'Oui, un peu', 'Peu', 'Pas du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`prog-${opt}`}
                      name="progression"
                      value={opt}
                      checked={formData.progression === opt}
                      onChange={(e) => updateField('progression', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`prog-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Dans quels domaines avez-vous constaté le plus d'amélioration ? *</Label>
              <div className="space-y-2 mt-2">
                {['Utilisation de Windows', 'Gestion fichiers/dossiers', 'Navigation Internet', 'Utilisation souris/clavier'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`dom-${opt}`}
                      checked={formData.domaines_amelioration.includes(opt)}
                      onChange={() => toggleCheckbox('domaines_amelioration', opt)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`dom-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Vous sentez-vous plus à l'aise pour utiliser l'ordinateur ? *</Label>
              <div className="space-y-2 mt-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`aise-${opt}`}
                      name="aise_ordinateur"
                      value={opt}
                      checked={formData.aise_ordinateur === opt}
                      onChange={(e) => updateField('aise_ordinateur', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`aise-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Quels points souhaitez-vous encore renforcer ?</Label>
              <Textarea value={formData.points_renforcer} onChange={(e) => updateField('points_renforcer', e.target.value)} rows={3} />
            </div>

            <div>
              <Label>Avez-vous atteint les objectifs fixés ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui totalement', 'Partiellement', 'Non encore', 'Non du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`obj-${opt}`}
                      name="objectifs_atteints"
                      value={opt}
                      checked={formData.objectifs_atteints === opt}
                      onChange={(e) => updateField('objectifs_atteints', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`obj-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              3. Appréciation de la formation
            </h3>
            
            <div>
              <Label>Le contenu et les supports ont-ils été adaptés à vos besoins ? *</Label>
              <div className="space-y-2 mt-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`cont-${opt}`}
                      name="contenu_adapte"
                      value={opt}
                      checked={formData.contenu_adapte === opt}
                      onChange={(e) => updateField('contenu_adapte', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`cont-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Le rythme et la durée de la formation vous ont-ils convenu ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(opt => (
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
              <Label>Le formateur a-t-il répondu à vos attentes ? *</Label>
              <div className="space-y-2 mt-2">
                {['Tout à fait', 'Plutôt oui', 'Plutôt non', 'Pas du tout'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`form-${opt}`}
                      name="formateur_attentes"
                      value={opt}
                      checked={formData.formateur_attentes === opt}
                      onChange={(e) => updateField('formateur_attentes', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`form-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Comment évalueriez-vous globalement la formation ? *</Label>
              <div className="space-y-2 mt-2">
                {['⭐ Excellent', '⭐ Bon', '⭐ Moyen', '⭐ Insatisfaisant'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`eval-${opt}`}
                      name="evaluation_globale"
                      value={opt}
                      checked={formData.evaluation_globale === opt}
                      onChange={(e) => updateField('evaluation_globale', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`eval-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Recommanderiez-vous cette formation ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui', 'Non', 'Peut-être'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`rec-${opt}`}
                      name="recommandation"
                      value={opt}
                      checked={formData.recommandation === opt}
                      onChange={(e) => updateField('recommandation', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`rec-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              4. Perspectives et suite du parcours
            </h3>
            
            <div>
              <Label>Comment comptez-vous utiliser vos compétences informatiques ? *</Label>
              <Textarea value={formData.utilisation_competences} onChange={(e) => updateField('utilisation_competences', e.target.value)} required rows={4} />
            </div>

            <div>
              <Label>Souhaitez-vous poursuivre avec une formation complémentaire ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui', 'Non'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`comp-${opt}`}
                      name="formation_complementaire"
                      value={opt}
                      checked={formData.formation_complementaire === opt}
                      onChange={(e) => updateField('formation_complementaire', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`comp-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 5 - Signature */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              5. Validation
            </h3>
            
            <div>
              <Label>Signature du stagiaire (horodatée) *</Label>
              {!signature ? (
                <div>
                  <Button type="button" onClick={() => setShowSignaturePad(true)} className="mb-2">
                    Signer
                  </Button>
                  {showSignaturePad && (
                    <SignaturePad
                      onSave={(sig) => {
                        setSignature(sig);
                        setShowSignaturePad(false);
                      }}
                      onCancel={() => setShowSignaturePad(false)}
                    />
                  )}
                </div>
              ) : (
                <div>
                  <img src={signature} alt="Signature" className="border rounded p-2 max-w-md" />
                  <Button type="button" onClick={() => setSignature('')} variant="outline" className="mt-2">
                    Effacer la signature
                  </Button>
                </div>
              )}
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
