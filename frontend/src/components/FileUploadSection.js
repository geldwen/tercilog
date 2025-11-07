import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download, Trash2, FileText, Loader2 } from "lucide-react";
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

export default function FileUploadSection({ studentId, category, categoryLabel }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
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

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    // Vérifier que ce sont des PDF
    const nonPdfFiles = files.filter(f => f.type !== 'application/pdf');
    if (nonPdfFiles.length > 0) {
      toast.error("Seuls les fichiers PDF sont autorisés");
      return;
    }

    // Vérifier la taille (10 Mo max par fichier)
    const maxSize = 10 * 1024 * 1024; // 10 Mo
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error("La taille maximale par fichier est de 10 Mo");
      return;
    }

    try {
      setUploading(true);
      
      // Upload chaque fichier
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        
        await axios.post(`${API}/students/${studentId}/documents`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      
      toast.success(`${files.length} fichier(s) téléversé(s) avec succès`);
      loadDocuments(); // Recharger la liste
      
      // Réinitialiser l'input
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
        { responseType: 'blob' }
      );
      
      // Créer un lien de téléchargement
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
      await axios.delete(`${API}/students/${studentId}/documents/${documentId}`);
      toast.success("Document supprimé");
      loadDocuments(); // Recharger la liste
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* En-tête avec compteur */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-br from-[#8B5A2B] via-[#7A4F26] to-[#6B4522] text-white">
        <h4 className="font-semibold text-lg">{categoryLabel}</h4>
        <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
          {documents.length} fichier{documents.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Zone d'upload */}
      <Card className="border-2 border-dashed border-[#8B5A2B]/30 bg-[#F8F1EC]">
        <CardContent className="pt-6">
          <div className="text-center">
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                {uploading ? (
                  <Loader2 className="w-12 h-12 text-[#8B5A2B] animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 text-[#8B5A2B]" />
                )}
                <div>
                  <p className="text-sm font-medium text-[#8B5A2B]">
                    {uploading ? "Téléversement en cours..." : "Cliquez pour téléverser des PDF"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Plusieurs fichiers possibles • 10 Mo max par fichier
                  </p>
                </div>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Liste des documents */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          Chargement...
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun document téléversé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-[#8B5A2B]/20 hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-[#8B5A2B] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(doc.uploaded_at)}
                      </p>
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
