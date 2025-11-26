import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const QuizRunner = () => {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [resource, setResource] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, [resourceId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // D'abord récupérer l'utilisateur actuel
      const userResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const currentUser = userResponse.data;
      
      // Récupérer les ressources de l'élève
      const resourcesResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/students/${currentUser.id}/resources`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Trouver la ressource spécifique
      const foundResource = resourcesResponse.data.resources.find(r => r.id === resourceId);
      
      if (!foundResource) {
        setError("Ressource introuvable");
        setLoading(false);
        return;
      }

      setResource(foundResource);

      // Si déjà soumis, afficher le résultat
      if (foundResource.status === 'SOUMIS') {
        setResult({
          score: foundResource.score,
          status: 'SOUMIS'
        });
        setLoading(false);
        return;
      }

      // Charger le template du quiz en utilisant le template_id de la ressource
      const templateId = foundResource.template_id || 'test-bureautique-positionnement-v1';
      const templatesResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/test-templates/${templateId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setQuiz(templatesResponse.data);
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement du quiz:', err);
      setError('Impossible de charger le quiz');
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, choiceKey, isMultiple) => {
    setAnswers(prev => {
      if (isMultiple) {
        const currentAnswers = prev[questionId] || [];
        if (currentAnswers.includes(choiceKey)) {
          // Retirer la réponse
          return {
            ...prev,
            [questionId]: currentAnswers.filter(k => k !== choiceKey)
          };
        } else {
          // Ajouter la réponse
          return {
            ...prev,
            [questionId]: [...currentAnswers, choiceKey]
          };
        }
      } else {
        // Une seule réponse
        return {
          ...prev,
          [questionId]: [choiceKey]
        };
      }
    });
  };

  const handleSubmit = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir soumettre ce test ? Vous ne pourrez plus modifier vos réponses.')) {
      try {
        setSubmitting(true);
        const token = localStorage.getItem('token');
        
        const response = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/student-resources/${resourceId}/submit`,
          { answers },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        setResult(response.data);
        setSubmitting(false);
      } catch (err) {
        console.error('Erreur lors de la soumission:', err);
        alert('Erreur lors de la soumission du test');
        setSubmitting(false);
      }
    }
  };

  const getScoreLevel = (score) => {
    if (score <= 12 * 100 / 30) return { label: 'Niveau débutant', color: 'bg-orange-100 text-orange-800' };
    if (score <= 21 * 100 / 30) return { label: 'Niveau intermédiaire', color: 'bg-blue-100 text-blue-800' };
    return { label: 'Niveau confirmé', color: 'bg-green-100 text-green-800' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du test...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Erreur</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const level = getScoreLevel(result.score);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Test terminé !</h2>
          
          <div className="bg-indigo-50 rounded-lg p-6 mb-6">
            <p className="text-sm text-gray-600 mb-2">Votre score</p>
            <p className="text-5xl font-bold text-indigo-600 mb-4">{result.score}%</p>
            {result.points && (
              <p className="text-gray-600 mb-2">{result.points} points</p>
            )}
            <div className={`inline-block px-4 py-2 rounded-full ${level.color} font-medium mt-2`}>
              {level.label}
            </div>
          </div>

          <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">Interprétation :</h3>
            {result.score <= 40 && (
              <p className="text-gray-700">
                Les bases sont à consolider. La formation vous aidera à prendre confiance sur Word, Excel et PowerPoint.
              </p>
            )}
            {result.score > 40 && result.score <= 70 && (
              <p className="text-gray-700">
                Vous avez déjà des acquis. La formation pourra approfondir les fonctionnalités et sécuriser vos pratiques.
              </p>
            )}
            {result.score > 70 && (
              <p className="text-gray-700">
                Vous êtes déjà à l'aise en bureautique. La formation pourra se concentrer sur des cas pratiques avancés.
              </p>
            )}
          </div>

          <button
            onClick={() => navigate('/student')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return null;
  }

  // Compter les questions répondues
  const totalQuestions = quiz.sections.reduce((sum, section) => sum + section.questions.length, 0);
  const answeredQuestions = Object.keys(answers).length;
  const progress = (answeredQuestions / totalQuestions * 100).toFixed(0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
          <p className="text-gray-600 mb-4">{quiz.description}</p>
          
          {/* Barre de progression */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progression</span>
              <span>{answeredQuestions} / {totalQuestions} questions</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Sections et questions */}
        {quiz.sections.map((section, sectionIndex) => (
          <div key={section.id} className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-indigo-600 mb-2">{section.title}</h2>
            <p className="text-gray-600 mb-6">{section.description}</p>

            {section.questions.map((question, questionIndex) => {
              const questionNumber = quiz.sections
                .slice(0, sectionIndex)
                .reduce((sum, s) => sum + s.questions.length, 0) + questionIndex + 1;
              
              const isMultiple = question.multipleAllowed;
              const selectedAnswers = answers[question.id] || [];

              return (
                <div key={question.id} className="mb-8 last:mb-0 pb-8 border-b last:border-b-0">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    <span className="text-indigo-600">Question {questionNumber}.</span> {question.text}
                    {isMultiple && (
                      <span className="ml-2 text-sm text-gray-500 italic">(plusieurs réponses possibles)</span>
                    )}
                  </h3>

                  <div className="space-y-2">
                    {question.choices.map((choice) => {
                      const isSelected = selectedAnswers.includes(choice.key);
                      
                      return (
                        <label
                          key={choice.key}
                          className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50'
                              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type={isMultiple ? 'checkbox' : 'radio'}
                            name={question.id}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(question.id, choice.key, isMultiple)}
                            className="mt-1 mr-3"
                          />
                          <span className="text-gray-700">
                            <strong>{choice.key}.</strong> {choice.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Bouton de soumission */}
        <div className="bg-white rounded-lg shadow-md p-6 sticky bottom-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                {answeredQuestions} / {totalQuestions} questions répondues
              </p>
              {answeredQuestions < totalQuestions && (
                <p className="text-sm text-orange-600 mt-1">
                  ⚠️ Certaines questions n'ont pas encore de réponse
                </p>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`px-6 py-3 rounded-lg font-medium ${
                submitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {submitting ? 'Soumission...' : 'Soumettre le test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizRunner;
