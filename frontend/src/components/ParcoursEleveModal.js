import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Download, Trash2, FileText, Image as ImageIcon, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fonction utilitaire pour obtenir les headers avec token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`
  };
};

// Composant pour une section d'upload avec note GLOBALE par catégorie
function UploadSectionWithNote({ studentId, category, title, buttonText, showNote = false }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryNote, setCategoryNote] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadDocuments();
    if (showNote) {
      loadCategoryNote();
    }
  }, [studentId, category]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/students/${studentId}/documents/${category}`, {
        headers: getAuthHeaders()
      });
      setDocuments(response.data);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryNote = async () => {
    try {
      const response = await axios.get(`${API}/students/${studentId}/category-notes/${category}`, {
        headers: getAuthHeaders()
      });
      if (response.data.note) {
        setCategoryNote(response.data.note);
        setNoteInput(response.data.note);
      }
    } catch (error) {
      console.error("Error loading category note:", error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    // Vérifier les types (PDF/PNG/JPG/DOCX)
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const invalidFiles = files.filter(f => !allowedTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error("Seuls les fichiers PDF, PNG, JPG et DOCX sont autorisés");
      return;
    }

    // Vérifier la taille (10 Mo max par fichier)
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error("La taille maximale par fichier est de 10 Mo");
      return;
    }

    try {
      setUploading(true);
      
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const token = localStorage.getItem('token');
        await axios.post(`${API}/students/${studentId}/documents/upload?category=${category}`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      
      toast.success(`${files.length} fichier(s) téléversé(s) avec succès`);
      loadDocuments();
      e.target.value = '';
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error(error.response?.data?.detail || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId, filename) => {
    try {
      const response = await axios.get(
        `${API}/students/${studentId}/documents/download/${documentId}`,
        { 
          responseType: 'blob',
          headers: getAuthHeaders()
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Document téléchargé");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleDelete = async (documentId, filename) => {
    if (!window.confirm(`Supprimer "${filename}" ?`)) return;
    
    try {
      await axios.delete(`${API}/students/${studentId}/documents/${documentId}`, {
        headers: getAuthHeaders()
      });
      toast.success("Document supprimé");
      loadDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSaveCategoryNote = async () => {
    if (!noteInput.trim()) {
      toast.error("Veuillez saisir une note");
      return;
    }
    
    try {
      setSavingNote(true);
      await axios.put(`${API}/students/${studentId}/category-notes/${category}`,
        { note: noteInput },
        { headers: getAuthHeaders() }
      );
      setCategoryNote(noteInput);
      toast.success("Note validée et enregistrée");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingNote(false);
    }
  };

  const getFileIcon = (mime) => {
    if (mime?.includes('image')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (mime?.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (mime?.includes('word')) return <FileSpreadsheet className="w-5 h-5 text-blue-600" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-br from-[#8B5A2B] via-[#7A4F26] to-[#6B4522] text-white">
        <h4 className="font-semibold text-lg">{title}</h4>
      </div>

      {/* Zone d'upload */}
      <Card className="border-2 border-dashed border-[#8B5A2B]/30 bg-[#F8F1EC]">
        <CardContent className="pt-6">
          <label className="cursor-pointer block">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {uploading ? (
                <Loader2 className="w-10 h-10 text-[#8B5A2B] animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-[#8B5A2B]" />
              )}
              <p className="text-sm font-medium text-[#8B5A2B] text-center">
                {uploading ? "Téléversement en cours..." : buttonText}
              </p>
              <p className="text-xs text-gray-600">
                PDF, PNG, JPG, DOCX • 10 Mo max/fichier
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Liste des documents */}
      {loading ? (
        <div className="text-center py-6 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Chargement...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Aucun document téléversé
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-[#8B5A2B]/20 hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {getFileIcon(doc.mime)}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate text-sm">{doc.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleDownload(doc.id, doc.filename)}
                      size="sm"
                      className="bg-[#8B5A2B] text-white hover:bg-[#7A4F26]"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      size="sm"
                      variant="outline"
                      className="text-[#8B5A2B] border-[#8B5A2B]/30 hover:bg-[#F8F1EC]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Composant principal de la modale
export default function ParcoursEleveModal({ open, onOpenChange, student }) {
  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#8B5A2B]">
            Parcours élève — {student.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="tests" className="w-full">
          <TabsList className="gap-2 bg-[#F4EAE3] p-2 rounded-xl w-full grid grid-cols-2">
            <TabsTrigger 
              value="tests" 
              className="data-[state=active]:bg-[#8B5A2B] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-[#8B5A2B] data-[state=inactive]:border data-[state=inactive]:border-[#8B5A2B]/30 font-medium rounded-lg transition-all"
            >
              Tests et évaluation
            </TabsTrigger>
            <TabsTrigger 
              value="supports" 
              className="data-[state=active]:bg-[#8B5A2B] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-[#8B5A2B] data-[state=inactive]:border data-[state=inactive]:border-[#8B5A2B]/30 font-medium rounded-lg transition-all"
            >
              Supports de formation
            </TabsTrigger>
          </TabsList>

          {/* Onglet Tests et évaluation */}
          <TabsContent value="tests" className="mt-6 space-y-8">
            {/* 1A - Test de positionnement */}
            <UploadSectionWithNote
              studentId={student.id}
              category="positionnement"
              title="Test de positionnement"
              buttonText="Cliquez ici pour télécharger le test de positionnement"
            />

            {/* 2A - Évaluations en cours de formation */}
            <UploadSectionWithNote
              studentId={student.id}
              category="evaluation_cours"
              title="Évaluations en cours de formation"
              buttonText="Cliquez ici pour télécharger les évaluations en cours de formation"
            />

            {/* 3A - Évaluations de fin de formation */}
            <UploadSectionWithNote
              studentId={student.id}
              category="evaluation_fin"
              title="Évaluations de fin de formation"
              buttonText="Cliquez ici pour télécharger les évaluations de fin de formation"
            />
          </TabsContent>

          {/* Onglet Supports de formation */}
          <TabsContent value="supports" className="mt-6">
            <UploadSectionWithNote
              studentId={student.id}
              category="support"
              title="Supports de formation"
              buttonText="Cliquez ici pour télécharger un support de formation"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
