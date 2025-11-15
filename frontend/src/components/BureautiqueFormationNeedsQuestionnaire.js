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

const BureautiqueFormationNeedsQuestionnaire = ({ open, onClose, studentId }) => {
  const sigCanvas = useRef(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    nom_prenom: "",
    parcours_niveau: "",
    situation_professionnelle: "",
    poste_actuel: "",
    contexte_travail: "",
    contexte_travail_autre: "",
    
    // Besoins bureautique
    besoin_rediger: false,
    besoin_tableaux: false,
    besoin_presentations: false,
    besoin_messagerie: false,
    besoin_collaborer: false,
    besoin_autre: "",
    
    // Raisons formation
    raison_autonomie: false,
    raison_temps: false,
    raison_employeur: false,
    raison_evolution: false,
    raison_certification: false,
    raison_autre: "",
    
    // Objectifs principaux
    objectif_word: false,
    objectif_excel: false,
    objectif_powerpoint: false,
    objectif_mail: false,
    objectif_fichiers: false,
    objectif_autre: "",
    
    attentes_fin_formation: "",
    
    // Outils utilisés
    outils_word: false,
    outils_excel: false,
    outils_powerpoint: false,
    outils_outlook: false,
    outils_visio: false,
    outils_autre: "",
    
    // Niveaux (1-5)
    niveau_word: "",
    niveau_excel: "",
    niveau_powerpoint: "",
    niveau_messagerie: "",
    niveau_fichiers: "",
    
    // Difficultés
    difficulte_temps: false,
    difficulte_mise_en_page: false,
    difficulte_formules: false,
    difficulte_graphiques: false,
    difficulte_presentation: false,
    difficulte_mail: false,
    difficulte_fichiers: false,
    difficulte_autre: "",
    
    taches_precises: "",
    
    // Contraintes
    disponibilites: "",
    format_prefere: "",
    materiel_ordi_perso: false,
    materiel_ordi_pro: false,
    materiel_internet: false,
    materiel_casque: false,
    materiel_autre: "",
    
    // Handicap
    handicap: "",
    handicap_details: "",
    amenagement_temps: false,
    amenagement_pauses: false,
    amenagement_support: false,
    amenagement_visuelles: false,
    amenagement_autre: "",
    materiel_specifique_ordi: false,
    materiel_specifique_clavier: false,
    materiel_specifique_logiciel: false,
    materiel_specifique_autre: "",
    
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
        `${API}/api/students/${studentId}/bureautique-formation-needs`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Questionnaire Bureautique soumis avec succès !");
      onClose();
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      toast.error("Erreur lors de la soumission");
    }
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            📝 Q1 – Bureautique<br/>
            <span className="text-lg font-normal">Questionnaire d'analyse des besoins avant formation</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1) Identification */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">1) Identification</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
              </div>
              <div>
                <Label>Nom et prénom</Label>
                <Input value={formData.nom_prenom} onChange={(e) => setFormData({...formData, nom_prenom: e.target.value})} required />
              </div>
            </div>

            <div>
              <Label>Parcours - Niveau</Label>
              <select 
                value={formData.parcours_niveau} 
                onChange={(e) => setFormData({...formData, parcours_niveau: e.target.value})}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Sélectionner</option>
                <option value="débutant">Bureautique – niveau débutant</option>
                <option value="intermédiaire">Bureautique – niveau intermédiaire</option>
                <option value="avancé">Bureautique – niveau avancé</option>
              </select>
            </div>

            <div>
              <Label>Situation professionnelle</Label>
              <select 
                value={formData.situation_professionnelle} 
                onChange={(e) => setFormData({...formData, situation_professionnelle: e.target.value})}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Sélectionner</option>
                <option value="En poste">En poste</option>
                <option value="En recherche d'emploi">En recherche d'emploi</option>
                <option value="En reconversion">En reconversion</option>
              </select>
            </div>

            {formData.situation_professionnelle === "En poste" && (
              <div>
                <Label>Intitulé du poste</Label>
                <Input value={formData.poste_actuel} onChange={(e) => setFormData({...formData, poste_actuel: e.target.value})} />
              </div>
            )}

            <div>
              <Label>Contexte de travail principal</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="contexte" value="Bureau / administratif" checked={formData.contexte_travail === "Bureau / administratif"} onChange={(e) => setFormData({...formData, contexte_travail: e.target.value})} />
                  <span>Bureau / administratif</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="contexte" value="Commerce / vente" checked={formData.contexte_travail === "Commerce / vente"} onChange={(e) => setFormData({...formData, contexte_travail: e.target.value})} />
                  <span>Commerce / vente</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="contexte" value="Gestion / comptabilité" checked={formData.contexte_travail === "Gestion / comptabilité"} onChange={(e) => setFormData({...formData, contexte_travail: e.target.value})} />
                  <span>Gestion / comptabilité</span>
                </label>
                <div className="flex items-center gap-2">
                  <input type="radio" name="contexte" value="Autre" checked={formData.contexte_travail === "Autre"} onChange={(e) => setFormData({...formData, contexte_travail: e.target.value})} />
                  <span>Autre :</span>
                  <Input 
                    className="flex-1" 
                    value={formData.contexte_travail_autre} 
                    onChange={(e) => setFormData({...formData, contexte_travail_autre: e.target.value})}
                    disabled={formData.contexte_travail !== "Autre"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2) Contexte et objectifs */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">2) Contexte et objectifs de la formation</h3>
            
            <div>
              <Label>Dans quel cadre avez-vous besoin de la bureautique ? (plusieurs réponses possibles)</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.besoin_rediger} onCheckedChange={(checked) => setFormData({...formData, besoin_rediger: checked})} />
                  <span>Rédiger des documents (courriers, comptes-rendus, rapports)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.besoin_tableaux} onCheckedChange={(checked) => setFormData({...formData, besoin_tableaux: checked})} />
                  <span>Faire des tableaux et calculs (Excel ou équivalent)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.besoin_presentations} onCheckedChange={(checked) => setFormData({...formData, besoin_presentations: checked})} />
                  <span>Faire des présentations (diaporamas)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.besoin_messagerie} onCheckedChange={(checked) => setFormData({...formData, besoin_messagerie: checked})} />
                  <span>Gérer votre messagerie et agenda (Outlook ou équivalent)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.besoin_collaborer} onCheckedChange={(checked) => setFormData({...formData, besoin_collaborer: checked})} />
                  <span>Collaborer à distance (Teams / visioconférence / partage de fichiers)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Autre :</span>
                  <Input value={formData.besoin_autre} onChange={(e) => setFormData({...formData, besoin_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Pourquoi souhaitez-vous suivre cette formation ?</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.raison_autonomie} onCheckedChange={(checked) => setFormData({...formData, raison_autonomie: checked})} />
                  <span>Gagner en autonomie sur l'ordinateur</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.raison_temps} onCheckedChange={(checked) => setFormData({...formData, raison_temps: checked})} />
                  <span>Gagner du temps dans mon travail</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.raison_employeur} onCheckedChange={(checked) => setFormData({...formData, raison_employeur: checked})} />
                  <span>Répondre à une demande de mon employeur</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.raison_evolution} onCheckedChange={(checked) => setFormData({...formData, raison_evolution: checked})} />
                  <span>Préparer une prise de poste / évolution</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.raison_certification} onCheckedChange={(checked) => setFormData({...formData, raison_certification: checked})} />
                  <span>Obtenir une certification (PCIE, TOSA, etc.)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Autre :</span>
                  <Input value={formData.raison_autre} onChange={(e) => setFormData({...formData, raison_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Quels sont vos objectifs principaux ? (cochez ce qui vous parle le plus)</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.objectif_word} onCheckedChange={(checked) => setFormData({...formData, objectif_word: checked})} />
                  <span>Mieux maîtriser Word (mise en page, modèles, fusion, etc.)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.objectif_excel} onCheckedChange={(checked) => setFormData({...formData, objectif_excel: checked})} />
                  <span>Mieux maîtriser Excel (formules, filtres, graphiques)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.objectif_powerpoint} onCheckedChange={(checked) => setFormData({...formData, objectif_powerpoint: checked})} />
                  <span>Mieux maîtriser PowerPoint (présentations claires et pro)</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.objectif_mail} onCheckedChange={(checked) => setFormData({...formData, objectif_mail: checked})} />
                  <span>Organiser ma boîte mail et mon agenda</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.objectif_fichiers} onCheckedChange={(checked) => setFormData({...formData, objectif_fichiers: checked})} />
                  <span>Mieux gérer les fichiers (sauvegarde, classement, partage)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Autre :</span>
                  <Input value={formData.objectif_autre} onChange={(e) => setFormData({...formData, objectif_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Qu'attendez-vous concrètement à la fin de la formation ?</Label>
              <Textarea 
                rows={3}
                value={formData.attentes_fin_formation} 
                onChange={(e) => setFormData({...formData, attentes_fin_formation: e.target.value})}
                placeholder="Réponse libre..."
              />
            </div>
          </div>

          {/* 3) Auto-évaluation */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">3) Auto-évaluation de vos compétences bureautiques</h3>
            
            <div>
              <Label>Quels outils utilisez-vous déjà ?</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.outils_word} onCheckedChange={(checked) => setFormData({...formData, outils_word: checked})} />
                  <span>Word ou équivalent</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.outils_excel} onCheckedChange={(checked) => setFormData({...formData, outils_excel: checked})} />
                  <span>Excel ou équivalent</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.outils_powerpoint} onCheckedChange={(checked) => setFormData({...formData, outils_powerpoint: checked})} />
                  <span>PowerPoint ou équivalent</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.outils_outlook} onCheckedChange={(checked) => setFormData({...formData, outils_outlook: checked})} />
                  <span>Outlook ou autre messagerie pro</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.outils_visio} onCheckedChange={(checked) => setFormData({...formData, outils_visio: checked})} />
                  <span>Outils de visioconférence (Teams, Zoom, Meet…)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Autre :</span>
                  <Input value={formData.outils_autre} onChange={(e) => setFormData({...formData, outils_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label className="block mb-2">Niveau perçu (1 = Je ne sais pas du tout faire / 5 = Très à l'aise)</Label>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Word (ou équivalent)</Label>
                  <div className="flex gap-4 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <label key={n} className="flex items-center gap-1">
                        <input type="radio" name="niveau_word" value={n} checked={formData.niveau_word == n} onChange={(e) => setFormData({...formData, niveau_word: e.target.value})} />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Excel (ou équivalent)</Label>
                  <div className="flex gap-4 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <label key={n} className="flex items-center gap-1">
                        <input type="radio" name="niveau_excel" value={n} checked={formData.niveau_excel == n} onChange={(e) => setFormData({...formData, niveau_excel: e.target.value})} />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm">PowerPoint (ou équivalent)</Label>
                  <div className="flex gap-4 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <label key={n} className="flex items-center gap-1">
                        <input type="radio" name="niveau_powerpoint" value={n} checked={formData.niveau_powerpoint == n} onChange={(e) => setFormData({...formData, niveau_powerpoint: e.target.value})} />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Messagerie / agenda (Outlook ou autre)</Label>
                  <div className="flex gap-4 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <label key={n} className="flex items-center gap-1">
                        <input type="radio" name="niveau_messagerie" value={n} checked={formData.niveau_messagerie == n} onChange={(e) => setFormData({...formData, niveau_messagerie: e.target.value})} />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Gestion et organisation de fichiers (dossiers, partages, cloud)</Label>
                  <div className="flex gap-4 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <label key={n} className="flex items-center gap-1">
                        <input type="radio" name="niveau_fichiers" value={n} checked={formData.niveau_fichiers == n} onChange={(e) => setFormData({...formData, niveau_fichiers: e.target.value})} />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4) Difficultés */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">4) Difficultés rencontrées aujourd'hui</h3>
            
            <div>
              <Label>Quelles sont vos principales difficultés ?</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.difficulte_temps} onCheckedChange={(checked) => setFormData({...formData, difficulte_temps: checked})} />
                  <span>Je perds du temps à chercher des fonctions</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.difficulte_mise_en_page} onCheckedChange={(checked) => setFormData({...formData, difficulte_mise_en_page: checked})} />
                  <span>Je n'arrive pas à bien mettre en page mes documents</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.difficulte_formules} onCheckedChange={(checked) => setFormData({...formData, difficulte_formules: checked})} />
                  <span>Je ne maîtrise pas les formules dans les tableaux</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.difficulte_graphiques} onCheckedChange={(checked) => setFormData({...formData, difficulte_graphiques: checked})} />
                  <span>J'ai du mal avec les graphiques</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.difficulte_presentation} onCheckedChange={(checked) => setFormData({...formData, difficulte_presentation: checked})} />
                  <span>J'ai du mal à préparer une présentation claire</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.difficulte_mail} onCheckedChange={(checked) => setFormData({...formData, difficulte_mail: checked})} />
                  <span>Ma boîte mail est mal organisée</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.difficulte_fichiers} onCheckedChange={(checked) => setFormData({...formData, difficulte_fichiers: checked})} />
                  <span>J'ai du mal à gérer / retrouver mes fichiers</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Autre(s) difficulté(s) :</span>
                  <Input value={formData.difficulte_autre} onChange={(e) => setFormData({...formData, difficulte_autre: e.target.value})} />
                </div>
              </div>
            </div>

            <div>
              <Label>Y a-t-il des tâches précises que vous aimeriez savoir faire ?</Label>
              <Textarea 
                rows={3}
                value={formData.taches_precises} 
                onChange={(e) => setFormData({...formData, taches_precises: e.target.value})}
                placeholder="Réponse libre..."
              />
            </div>
          </div>

          {/* 5) Contraintes */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">5) Contraintes et modalités de formation</h3>
            
            <div>
              <Label>Disponibilités et rythme souhaité</Label>
              <select 
                value={formData.disponibilites} 
                onChange={(e) => setFormData({...formData, disponibilites: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value="">Sélectionner</option>
                <option value="Intensif">Intensif</option>
                <option value="Étendu dans le temps">Étendu dans le temps</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>

            <div>
              <Label>Format préféré</Label>
              <select 
                value={formData.format_prefere} 
                onChange={(e) => setFormData({...formData, format_prefere: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value="">Sélectionner</option>
                <option value="Présentiel">Présentiel</option>
                <option value="Distanciel">Distanciel</option>
                <option value="Hybride">Hybride</option>
              </select>
            </div>

            <div>
              <Label>Matériel à disposition</Label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.materiel_ordi_perso} onCheckedChange={(checked) => setFormData({...formData, materiel_ordi_perso: checked})} />
                  <span>Ordinateur personnel</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.materiel_ordi_pro} onCheckedChange={(checked) => setFormData({...formData, materiel_ordi_pro: checked})} />
                  <span>Ordinateur professionnel</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.materiel_internet} onCheckedChange={(checked) => setFormData({...formData, materiel_internet: checked})} />
                  <span>Connexion internet stable</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.materiel_casque} onCheckedChange={(checked) => setFormData({...formData, materiel_casque: checked})} />
                  <span>Casque / micro</span>
                </label>
                <div className="flex items-center gap-2">
                  <span>Autre :</span>
                  <Input value={formData.materiel_autre} onChange={(e) => setFormData({...formData, materiel_autre: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          {/* 6) Handicap */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-lg">6) Situation de handicap et besoins spécifiques</h3>
            
            <div>
              <Label>Êtes-vous en situation de handicap ou avez-vous des besoins spécifiques à prendre en compte ?</Label>
              <select 
                value={formData.handicap} 
                onChange={(e) => setFormData({...formData, handicap: e.target.value})}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">Sélectionner</option>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>

            {formData.handicap === "Oui" && (
              <>
                <div>
                  <Label>Précisez éventuellement</Label>
                  <Textarea 
                    rows={2}
                    value={formData.handicap_details} 
                    onChange={(e) => setFormData({...formData, handicap_details: e.target.value})}
                  />
                </div>

                <div>
                  <Label>Avez-vous besoin d'un aménagement particulier pour la formation ?</Label>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.amenagement_temps} onCheckedChange={(checked) => setFormData({...formData, amenagement_temps: checked})} />
                      <span>Temps supplémentaire</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.amenagement_pauses} onCheckedChange={(checked) => setFormData({...formData, amenagement_pauses: checked})} />
                      <span>Pauses plus fréquentes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.amenagement_support} onCheckedChange={(checked) => setFormData({...formData, amenagement_support: checked})} />
                      <span>Support écrit adapté (police, contraste, taille…)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.amenagement_visuelles} onCheckedChange={(checked) => setFormData({...formData, amenagement_visuelles: checked})} />
                      <span>Explications plus visuelles (captures, schémas, tutoriels vidéo)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span>Autre :</span>
                      <Input value={formData.amenagement_autre} onChange={(e) => setFormData({...formData, amenagement_autre: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Avez-vous besoin d'un matériel ou outil particulier ?</Label>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.materiel_specifique_ordi} onCheckedChange={(checked) => setFormData({...formData, materiel_specifique_ordi: checked})} />
                      <span>Ordinateur adapté</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.materiel_specifique_clavier} onCheckedChange={(checked) => setFormData({...formData, materiel_specifique_clavier: checked})} />
                      <span>Clavier ou souris spécifique</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={formData.materiel_specifique_logiciel} onCheckedChange={(checked) => setFormData({...formData, materiel_specifique_logiciel: checked})} />
                      <span>Logiciel spécifique (ex : lecteur d'écran, loupe…)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span>Autre :</span>
                      <Input value={formData.materiel_specifique_autre} onChange={(e) => setFormData({...formData, materiel_specifique_autre: e.target.value})} />
                    </div>
                  </div>
                </div>
              </>
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
            <Button type="button" variant="outline" onClick={clearSignature}>
              Effacer la signature
            </Button>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1 bg-[#8B5A2B] hover:bg-[#6d4522] text-white">
              Soumettre le questionnaire
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BureautiqueFormationNeedsQuestionnaire;
