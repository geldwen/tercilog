import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import SignaturePad from './SignaturePad';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DynamicQuestionnaire({ open, onClose, resourceId, templateId, studentId }) {
  const [template, setTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && templateId) {
      loadTemplate();
    }
  }, [open, templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(
        `${API}/questionnaire-templates/${templateId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      setTemplate(response.data);
      
      // Initialiser formData avec des valeurs vides
      const initialData = {};
      response.data.sections?.forEach(section => {
        section.fields?.forEach(field => {
          if (field.type === 'checkbox') {
            initialData[field.id] = [];
          } else {
            initialData[field.id] = '';
          }
        });
      });
      setFormData(initialData);
      
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error("Erreur lors du chargement du questionnaire");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const toggleCheckbox = (fieldId, value) => {
    setFormData(prev => {
      const current = prev[fieldId] || [];
      if (current.includes(value)) {
        return { ...prev, [fieldId]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [fieldId]: [...current, value] };
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
      toast.error(error.response?.data?.detail || "Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={formData[field.id] || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            required={field.required}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            value={formData[field.id] || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            required={field.required}
            rows={4}
          />
        );
      
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${field.id}-${option}`}
                  name={field.id}
                  value={option}
                  checked={formData[field.id] === option}
                  onChange={(e) => updateField(field.id, e.target.value)}
                  required={field.required}
                  className="w-4 h-4"
                />
                <label htmlFor={`${field.id}-${option}`} className="cursor-pointer">
                  {option}
                </label>
              </div>
            ))}
          </div>
        );
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`${field.id}-${option}`}
                  checked={(formData[field.id] || []).includes(option)}
                  onChange={() => toggleCheckbox(field.id, option)}
                  className="w-4 h-4"
                />
                <label htmlFor={`${field.id}-${option}`} className="cursor-pointer">
                  {option}
                </label>
              </div>
            ))}
          </div>
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={formData[field.id] || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
            required={field.required}
          />
        );
      
      case 'signature':
        return (
          <SignaturePad
            value={signature}
            onChange={setSignature}
          />
        );
      
      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-indigo-600">
            {loading ? 'Chargement...' : template?.title || 'Questionnaire'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <p className="text-gray-500">Chargement du questionnaire...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {template?.sections?.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
                  {sectionIndex + 1}. {section.title}
                </h3>
                
                {section.fields?.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="space-y-2">
                    <Label className="text-gray-900">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            ))}

            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting ? 'Envoi en cours...' : 'Valider le questionnaire'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
