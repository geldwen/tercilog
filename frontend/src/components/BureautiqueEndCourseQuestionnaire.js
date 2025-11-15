import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import axios from "axios";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";

const API = process.env.REACT_APP_BACKEND_URL || "";

const BureautiqueEndCourseQuestionnaire = ({ open, onClose, studentId }) => {
  const sigCanvas = useRef(null);
  const [formData, setFormData] = useState({
    date_fin: new Date().toISOString().split('T')[0],
    nom_prenom: "",
    
    // Progression globale
    progression_globale: "",
    progression_word: "",
    progression_excel: "",
    progression_powerpoint: "",
    progression_messagerie: "",
    progression_fichiers: "",
    exemple_tache_maitrisee: "",
    
    // Objectifs
    objectifs_atteints: "",
    objectif_1: "",
    resultat_objectif_1: "",
    objectif_2: "",
    resultat_objectif_2: "",
    
    // Satisfaction
    evaluation_formation: "",
    contenu_adapte: "",
    rythme_formation: "",
    pedagogie_formateur: "",
    recommandation: "",
    
    // Utilité
    utilite_poste: false,
    utilite_recherche: false,
    utilite_reconversion: false,
    utilite_projet_perso: false,
    utilite_autre: "",
    utilisation_competences: "",
    
    // Amélioration
    point_approfondir: "",
    suggestions_amelioration: "",
    formation_suivante: "",
    theme_suivant: "",
    
    signature: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!sigCanvas.current.isEmpty()) {
      formData.signature = sigCanvas.current.toDataURL();
    }
    
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/api/students/${studentId}/bureautique-end-course-questionnaire`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Questionnaire Bureautique de fin de formation soumis !");
      onClose();
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      toast.error("Erreur lors de la soumission");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            ✅ Q3 – Bureautique<br/>
            <span className="text-lg font-normal">Questionnaire de fin de formation – Bilan & satisfaction</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identification */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">1) Identification</h3>
            <div>
              <Label>Nom et prénom</Label>
              <Input value={formData.nom_prenom} onChange={(e) => setFormData({...formData, nom_prenom: e.target.value})} required />
            </div>
            <div>
              <Label>Date de fin de formation</Label>
              <Input type="date" value={formData.date_fin} onChange={(e) => setFormData({...formData, date_fin: e.target.value})} required />
            </div>
          </div>

          {/* Progression */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">2) Progression perçue</h3>
            <div>
              <Label>Globalement, pensez-vous avoir progressé en bureautique ?</Label>
              <select value={formData.progression_globale} onChange={(e) => setFormData({...formData, progression_globale: e.target.value})} className="w-full p-2 border rounded mt-2" required>
                <option value="">Sélectionner</option>
                <option value="Pas du tout">Pas du tout</option>
                <option value="Un peu">Un peu</option>
                <option value="Moyennement">Moyennement</option>
                <option value="Beaucoup">Beaucoup</option>
                <option value="Énormément">Énormément</option>
              </select>
            </div>

            <div>
              <Label>Pour chaque outil, indiquez votre progression ressentie :</Label>
              <div className="space-y-3 mt-2">
                {[
                  {key: 'word', label: 'Word (ou équivalent)'},
                  {key: 'excel', label: 'Excel (ou équivalent)'},
                  {key: 'powerpoint', label: 'PowerPoint (ou équivalent)'},
                  {key: 'messagerie', label: 'Messagerie / agenda'},
                  {key: 'fichiers', label: 'Organisation de fichiers'}
                ].map(({key, label}) => (
                  <div key={key}>
                    <Label className="text-sm">{label}</Label>
                    <div className="flex gap-4 mt-1">
                      {['Aucune', 'Faible', 'Moyenne', 'Forte'].map(niveau => (
                        <label key={niveau} className="flex items-center gap-1">
                          <input 
                            type="radio" 
                            name={`progression_${key}`} 
                            value={niveau} 
                            checked={formData[`progression_${key}`] === niveau} 
                            onChange={(e) => setFormData({...formData, [`progression_${key}`]: e.target.value})} 
                          />
                          <span className="text-sm">{niveau}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Donnez un exemple concret d'une tâche que vous ne faisiez pas ou mal avant, et que vous maîtrisez mieux maintenant :</Label>
              <Textarea rows={3} value={formData.exemple_tache_maitrisee} onChange={(e) => setFormData({...formData, exemple_tache_maitrisee: e.target.value})} />
            </div>
          </div>

          {/* Objectifs */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">3) Atteinte des objectifs</h3>
            <div>
              <Label>Les objectifs que vous aviez au départ vous semblent-ils atteints ?</Label>
              <select value={formData.objectifs_atteints} onChange={(e) => setFormData({...formData, objectifs_atteints: e.target.value})} className="w-full p-2 border rounded mt-2">
                <option value="">Sélectionner</option>
                <option value="Non, pas du tout">Non, pas du tout</option>
                <option value="Partiellement">Partiellement</option>
                <option value="En grande partie">En grande partie</option>
                <option value="Totalement">Totalement</option>
              </select>
            </div>

            <div>
              <Label>Objectif 1 (principal au départ) :</Label>
              <Input value={formData.objectif_1} onChange={(e) => setFormData({...formData, objectif_1: e.target.value})} />
              <div className="flex gap-2 mt-2">
                {['Non atteint', 'Partiellement', 'Atteint', 'Dépassé'].map(r => (
                  <label key={r} className="flex items-center gap-1">
                    <input type="radio" name="res_obj1" value={r} checked={formData.resultat_objectif_1 === r} onChange={(e) => setFormData({...formData, resultat_objectif_1: e.target.value})} />
                    <span className="text-sm">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Objectif 2 :</Label>
              <Input value={formData.objectif_2} onChange={(e) => setFormData({...formData, objectif_2: e.target.value})} />
              <div className="flex gap-2 mt-2">
                {['Non atteint', 'Partiellement', 'Atteint', 'Dépassé'].map(r => (
                  <label key={r} className="flex items-center gap-1">
                    <input type="radio" name="res_obj2" value={r} checked={formData.resultat_objectif_2 === r} onChange={(e) => setFormData({...formData, resultat_objectif_2: e.target.value})} />
                    <span className="text-sm">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Satisfaction */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">4) Satisfaction globale</h3>
            
            <div>
              <Label>Comment évaluez-vous la formation dans son ensemble ?</Label>
              <select value={formData.evaluation_formation} onChange={(e) => setFormData({...formData, evaluation_formation: e.target.value})} className="w-full p-2 border rounded mt-2">
                <option value="">Sélectionner</option>
                <option value="Insatisfaisante">Insatisfaisante</option>
                <option value="Moyennement satisfaisante">Moyennement satisfaisante</option>
                <option value="Satisfaisante">Satisfaisante</option>
                <option value="Très satisfaisante">Très satisfaisante</option>
              </select>
            </div>

            <div>
              <Label>Le contenu vous a-t-il semblé :</Label>
              <select value={formData.contenu_adapte} onChange={(e) => setFormData({...formData, contenu_adapte: e.target.value})} className="w-full p-2 border rounded mt-2">
                <option value="">Sélectionner</option>
                <option value="Pas adapté">Pas adapté</option>
                <option value="Peu adapté">Peu adapté</option>
                <option value="Adapté">Adapté</option>
                <option value="Très adapté à vos besoins">Très adapté à vos besoins</option>
              </select>
            </div>

            <div>
              <Label>Le rythme de la formation vous a-t-il convenu ?</Label>
              <select value={formData.rythme_formation} onChange={(e) => setFormData({...formData, rythme_formation: e.target.value})} className="w-full p-2 border rounded mt-2">
                <option value="">Sélectionner</option>
                <option value="Trop lent">Trop lent</option>
                <option value="Adapté">Adapté</option>
                <option value="Trop rapide">Trop rapide</option>
              </select>
            </div>

            <div>
              <Label>La pédagogie et l'accompagnement du formateur :</Label>
              <select value={formData.pedagogie_formateur} onChange={(e) => setFormData({...formData, pedagogie_formateur: e.target.value})} className="w-full p-2 border rounded mt-2">
                <option value="">Sélectionner</option>
                <option value="Pas satisfaisants">Pas satisfaisants</option>
                <option value="Peu satisfaisants">Peu satisfaisants</option>
                <option value="Satisfaisants">Satisfaisants</option>
                <option value="Très satisfaisants">Très satisfaisants</option>
              </select>
            </div>

            <div>
              <Label>Recommanderiez-vous cette formation à quelqu'un dans une situation similaire ?</Label>
              <select value={formData.recommandation} onChange={(e) => setFormData({...formData, recommandation: e.target.value})} className="w-full p-2 border rounded mt-2">
                <option value="">Sélectionner</option>
                <option value="Non">Non</option>
                <option value="Plutôt non">Plutôt non</option>
                <option value="Plutôt oui">Plutôt oui</option>
                <option value="Oui, tout à fait">Oui, tout à fait</option>
              </select>
            </div>
          </div>

          {/* Utilité */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">5) Utilité pour votre activité / projet</h3>
            
            <div>
              <Label>Pensez-vous que cette formation va vous aider dans :</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.utilite_poste} onCheckedChange={(c) => setFormData({...formData, utilite_poste: c})} />
                  <span>Votre poste actuel</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.utilite_recherche} onCheckedChange={(c) => setFormData({...formData, utilite_recherche: c})} />
                  <span>Votre recherche d'emploi</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.utilite_reconversion} onCheckedChange={(c) => setFormData({...formData, utilite_reconversion: c})} />
                  <span>Votre projet de reconversion</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.utilite_projet_perso} onCheckedChange={(c) => setFormData({...formData, utilite_projet_perso: c})} />
                  <span>Un projet personnel</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Autre :</span>
                  <Input value={formData.utilite_autre} onChange={(e) => setFormData({...formData, utilite_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Comment pensez-vous utiliser vos nouvelles compétences bureautiques ?</Label>
              <Textarea rows={3} value={formData.utilisation_competences} onChange={(e) => setFormData({...formData, utilisation_competences: e.target.value})} />
            </div>
          </div>

          {/* Amélioration */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">6) Pistes d'amélioration & suite de parcours</h3>
            
            <div>
              <Label>Y a-t-il un point que vous auriez aimé approfondir davantage ?</Label>
              <Textarea rows={2} value={formData.point_approfondir} onChange={(e) => setFormData({...formData, point_approfondir: e.target.value})} />
            </div>

            <div>
              <Label>Auriez-vous des suggestions pour améliorer cette formation ?</Label>
              <Textarea rows={2} value={formData.suggestions_amelioration} onChange={(e) => setFormData({...formData, suggestions_amelioration: e.target.value})} />
            </div>

            <div>
              <Label>Souhaitez-vous poursuivre par une autre formation ?</Label>
              <select value={formData.formation_suivante} onChange={(e) => setFormData({...formData, formation_suivante: e.target.value})} className="w-full p-2 border rounded mt-2">
                <option value="">Sélectionner</option>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>

            {formData.formation_suivante === "Oui" && (
              <div>
                <Label>Si oui, sur quel thème ?</Label>
                <Input value={formData.theme_suivant} onChange={(e) => setFormData({...formData, theme_suivant: e.target.value})} />
              </div>
            )}
          </div>

          {/* Signature */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">Signature stagiaire</h3>
            <div className="border-2 border-gray-300 rounded">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: "w-full h-40 touch-none",
                  style: { touchAction: "none" }
                }}
                onTouchStart={(e) => e.preventDefault()}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => sigCanvas.current.clear()}>
              Effacer la signature
            </Button>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" className="flex-1 bg-[#8B5A2B] hover:bg-[#6d4522] text-white">Soumettre le questionnaire</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BureautiqueEndCourseQuestionnaire;
