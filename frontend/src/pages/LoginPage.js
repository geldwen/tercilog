import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password,
      });

      toast.success("Connexion réussie !");
      onLogin(response.data.user, response.data.access_token);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_f0bae013-d5d3-4906-a078-392b9e03aa37/artifacts/tiidl44l_Terciform%20%28propulsez%20vos%20compe%CC%81tences%29%20logo%20final.png"
            alt="Terciform"
            className="h-24 mx-auto mb-4"
          />
          <p className="text-lg text-gray-700 font-medium">Propulsez vos compétences</p>
        </div>

        <Card className="shadow-xl border-0 backdrop-blur-sm bg-white">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center" style={{ color: '#1e3a5f' }}>Connexion</CardTitle>
            <CardDescription className="text-center">
              Entrez vos identifiants pour accéder à votre espace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="email-label">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre.email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="email-input"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" data-testid="password-label">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="password-input"
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-white font-medium"
                style={{ backgroundColor: '#1e3a5f' }}
                disabled={loading}
                data-testid="login-submit-button"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Connexion...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Se connecter
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Contactez votre formateur pour obtenir vos identifiants</p>
        </div>
      </div>
    </div>
  );
}
