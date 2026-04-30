import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Lock, KeyRound } from "lucide-react";

type Step = "password" | "totp";

export default function Login() {
  const [, navigate]  = useLocation();
  const [step, setStep] = useState<Step>("password");
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [totpCode, setTotpCode]   = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Anmeldung fehlgeschlagen");
        return;
      }
      if (data.step === "totp") {
        setStep("totp");
      } else {
        navigate("/");
      }
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/totp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Ungültiger Code");
        setTotpCode("");
        return;
      }
      navigate("/");
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <svg aria-label="FinanzFlow Logo" viewBox="0 0 32 32" width="36" height="36" fill="none">
            <rect width="32" height="32" rx="6" fill="hsl(163 80% 28%)" />
            <rect x="5" y="9" width="8" height="4" rx="1.5" fill="white" opacity="0.9" />
            <rect x="5" y="16" width="12" height="4" rx="1.5" fill="white" opacity="0.7" />
            <rect x="19" y="9" width="8" height="11" rx="1.5" fill="white" opacity="0.5" />
          </svg>
          <span className="text-xl font-semibold tracking-tight text-foreground">FinanzFlow</span>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {step === "password"
                ? <><Lock size={15} /> Anmelden</>
                : <><KeyRound size={15} /> Zwei-Faktor-Authentifizierung</>
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === "password" ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Benutzername</Label>
                  <Input
                    id="username"
                    data-testid="input-username"
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    data-testid="input-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400" role="alert">{error}</p>
                )}
                <Button
                  data-testid="button-login"
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Wird geprüft…" : "Anmelden"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleTotpSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Gib den 6-stelligen Code aus deiner Authenticator-App ein,
                  oder einen Recovery-Code.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="totp-code">Code</Label>
                  <Input
                    id="totp-code"
                    data-testid="input-totp-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value)}
                    required
                    autoFocus
                    maxLength={64}
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-400" role="alert">{error}</p>
                )}
                <Button
                  data-testid="button-verify-totp"
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Wird geprüft…" : "Bestätigen"}
                </Button>
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                  onClick={() => { setStep("password"); setError(""); setTotpCode(""); }}
                >
                  Zurück zur Passwort-Eingabe
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
