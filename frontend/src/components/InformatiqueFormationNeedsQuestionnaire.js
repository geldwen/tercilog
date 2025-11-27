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

export default function InformatiqueFormationNeedsQuestionnaire({ open, onClose, studentId, resourceId }) {
  const sigCanvas = useRef(null);
  const [formData, setFormData] = useState({
    type_situation: '',
    poste_occupe: '',
    anciennete: '',
    formation_anterieure: '',
    raison_formation: '',
    cadre_utilisation: '',
    objectifs_principaux: [],
    attentes_fin_formation: '',
    windows: '',
    fichiers_dossiers: '',
    navigation_internet: '',
    clavier_souris: '',
    situations_informatique: '',
    difficultes_actuelles: [],
    contenu_particulier: '',
    certification: '',
    rythme_souhaite: '',
    format_prefere: '',
    contraintes_particulieres: '',
    handicap: ''
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
            Q1 – Questionnaire d'entrée informatique
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              1. Identification / Situation professionnelle
            </h3>
            
            <div>
              <Label>Type de situation *</Label>
              <div className="space-y-2 mt-2">
                {['En fonction', 'En recherche d\'emploi', 'En reconversion'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`type-${opt}`}
                      name="type_situation"
                      value={opt}
                      checked={formData.type_situation === opt}
                      onChange={(e) => updateField('type_situation', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`type-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Poste occupé :</Label>
              <Input value={formData.poste_occupe} onChange={(e) => updateField('poste_occupe', e.target.value)} />
            </div>

            <div>
              <Label>Ancienneté dans le poste :</Label>
              <Input value={formData.anciennete} onChange={(e) => updateField('anciennete', e.target.value)} />
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              2. Motivation et objectifs
            </h3>
            
            <div>
              <Label>Avez-vous déjà suivi une formation en informatique ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui', 'Non'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`formation-${opt}`}
                      name="formation_anterieure"
                      value={opt}
                      checked={formData.formation_anterieure === opt}
                      onChange={(e) => updateField('formation_anterieure', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`formation-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Pourquoi souhaitez-vous suivre cette formation ? *</Label>
              <Textarea value={formData.raison_formation} onChange={(e) => updateField('raison_formation', e.target.value)} required rows={4} />
            </div>

            <div>
              <Label>Dans quel cadre utiliserez-vous vos compétences informatiques ? *</Label>
              <div className="space-y-2 mt-2">
                {['Travail quotidien', 'Communication interne', 'Gestion administrative', 'Usage personnel', 'Autre (à préciser)'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`cadre-${opt}`}
                      name="cadre_utilisation"
                      value={opt}
                      checked={formData.cadre_utilisation === opt}
                      onChange={(e) => updateField('cadre_utilisation', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`cadre-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Quels sont vos objectifs principaux ? *</Label>
              <div className="space-y-2 mt-2">
                {['Être plus à l\'aise avec Windows', 'Gérer fichiers/dossiers', 'Utiliser Internet', 'Utiliser les outils bureautiques de base', 'Assurer son autonomie numérique'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`obj-${opt}`}
                      checked={formData.objectifs_principaux.includes(opt)}
                      onChange={() => toggleCheckbox('objectifs_principaux', opt)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`obj-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Qu'attendez-vous concrètement à la fin de la formation ? *</Label>
              <Textarea value={formData.attentes_fin_formation} onChange={(e) => updateField('attentes_fin_formation', e.target.value)} required rows={4} />
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              3. Niveau et compétences informatiques (auto-évaluation)
            </h3>
            
            {[
              ['windows', 'Utilisation de Windows'],
              ['fichiers_dossiers', 'Gestion des fichiers et dossiers'],
              ['navigation_internet', 'Navigation Internet'],
              ['clavier_souris', 'Utilisation clavier/souris']
            ].map(([field, label]) => (
              <div key={field}>
                <Label>{label} *</Label>
                <div className="flex gap-4 mt-2">
                  {['Faible', 'Moyen', 'Bon'].map(opt => (
                    <div key={opt} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`${field}-${opt}`}
                        name={field}
                        value={opt}
                        checked={formData[field] === opt}
                        onChange={(e) => updateField(field, e.target.value)}
                        required
                        className="w-4 h-4"
                      />
                      <label htmlFor={`${field}-${opt}`}>{opt}</label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Section 4 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              4. Besoins professionnels et attentes spécifiques
            </h3>
            
            <div>
              <Label>Dans votre fonction actuelle, quelles sont les situations où l'informatique est nécessaire ? *</Label>
              <Textarea value={formData.situations_informatique} onChange={(e) => updateField('situations_informatique', e.target.value)} required rows={4} />
            </div>

            <div>
              <Label>Quelles difficultés rencontrez-vous actuellement ?</Label>
              <div className="space-y-2 mt-2">
                {['Organisation des fichiers', 'Navigation Internet', 'Utilisation de Windows', 'Manipulation souris/clavier', 'Compréhension des messages Windows', 'Autre'].map(opt => (
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
              <Label>Souhaitez-vous insister sur un type de contenu particulier ?</Label>
              <Textarea value={formData.contenu_particulier} onChange={(e) => updateField('contenu_particulier', e.target.value)} rows={3} />
            </div>

            <div>
              <Label>Souhaitez-vous passer une certification informatique ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui', 'Non'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`cert-${opt}`}
                      name="certification"
                      value={opt}
                      checked={formData.certification === opt}
                      onChange={(e) => updateField('certification', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`cert-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 5 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              5. Contraintes et conditions de suivi
            </h3>
            
            <div>
              <Label>Disponibilités et rythme souhaité :</Label>
              <div className="space-y-2 mt-2">
                {['Intensif', 'Étendu', 'Flexible'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`rythme-${opt}`}
                      name="rythme_souhaite"
                      value={opt}
                      checked={formData.rythme_souhaite === opt}
                      onChange={(e) => updateField('rythme_souhaite', e.target.value)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`rythme-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Format préféré :</Label>
              <div className="space-y-2 mt-2">
                {['Présentiel', 'Distanciel', 'Hybride'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`format-${opt}`}
                      name="format_prefere"
                      value={opt}
                      checked={formData.format_prefere === opt}
                      onChange={(e) => updateField('format_prefere', e.target.value)}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`format-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Avez-vous des contraintes particulières ? (horaires, déplacements, matériel…) *</Label>
              <Textarea value={formData.contraintes_particulieres} onChange={(e) => updateField('contraintes_particulieres', e.target.value)} required rows={3} />
            </div>
          </div>

          {/* Section 6 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              6. Situation de handicap et besoins d'adaptation
            </h3>
            
            <div>
              <Label>Êtes-vous en situation de handicap ou rencontrez-vous une difficulté pouvant impacter votre apprentissage ? *</Label>
              <div className="space-y-2 mt-2">
                {['Oui', 'Non'].map(opt => (
                  <div key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`handicap-${opt}`}
                      name="handicap"
                      value={opt}
                      checked={formData.handicap === opt}
                      onChange={(e) => updateField('handicap', e.target.value)}
                      required
                      className="w-4 h-4"
                    />
                    <label htmlFor={`handicap-${opt}`}>{opt}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 7 - Signature */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
              7. Validation
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
