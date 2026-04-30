import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ShieldAlert, ShieldCheck, Copy, Check, RefreshCw } from "lucide-react";

interface TwoFaStatus {
  authEnabled: boolean;
  configured: boolean;
  recoveryCodesRemaining: number;
}

type SetupStep = "qr" | "codes";
type RegenStep = "confirm" | "codes";

export default function TwoFactorSetup() {
  const queryClient = useQueryClient();

  const { data: status } = useQuery<TwoFaStatus>({
    queryKey: ["/api/auth/2fa/status"],
    queryFn: () => fetch("/api/auth/2fa/status").then(r => r.json()),
  });

  // ─── Setup-Dialog ─────────────────────────────────────────────────────────
  const [setupOpen,   setSetupOpen]   = useState(false);
  const [setupStep,   setSetupStep]   = useState<SetupStep>("qr");
  const [secret,      setSecret]      = useState("");
  const [qrDataUrl,   setQrDataUrl]   = useState("");
  const [code,        setCode]        = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // ─── Regenerierung-Dialog ──────────────────────────────────────────────────
  const [regenOpen,   setRegenOpen]   = useState(false);
  const [regenStep,   setRegenStep]   = useState<RegenStep>("confirm");
  const [regenCodes,  setRegenCodes]  = useState<string[]>([]);
  const [regenLoading, setRegenLoading] = useState(false);

  // ─── Clipboard ────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  function copyToClipboard(codes: string[]) {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Setup starten ────────────────────────────────────────────────────────
  async function openSetup() {
    setLoading(true);
    setError("");
    setCode("");
    setSetupStep("qr");
    try {
      const data = await apiRequest("POST", "/api/auth/2fa/setup").then(r => r.json());
      setSecret(data.secret);
      const dataUrl = await QRCode.toDataURL(data.otpAuthUrl, {
        width: 200, margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      setSetupOpen(true);
    } catch {
      setError("Fehler beim Laden – bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length < 6) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("POST", "/api/auth/2fa/verify-setup", { code }).then(r => r.json());
      setRecoveryCodes(data.recoveryCodes);
      setSetupStep("codes");
    } catch (e: any) {
      setError(e.message ?? "Ungültiger Code – bitte erneut versuchen.");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  function closeSetup() {
    if (setupStep === "codes") {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/status"] });
    }
    setSetupOpen(false);
    setCode("");
    setError("");
  }

  // ─── Recovery-Codes neu generieren ────────────────────────────────────────
  async function handleRegen() {
    setRegenLoading(true);
    try {
      const data = await apiRequest("POST", "/api/auth/2fa/regenerate-recovery").then(r => r.json());
      setRegenCodes(data.recoveryCodes);
      setRegenStep("codes");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/status"] });
    } catch {
      setRegenOpen(false);
    } finally {
      setRegenLoading(false);
    }
  }

  function closeRegen() {
    setRegenOpen(false);
    setRegenStep("confirm");
    setRegenCodes([]);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!status?.authEnabled) return null;

  return (
    <>
      {/* Banner: 2FA nicht konfiguriert */}
      {!status.configured && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <ShieldAlert size={15} className="text-amber-500 mt-0.5" />
          <AlertTitle className="text-amber-500 font-semibold text-sm">
            2FA noch nicht eingerichtet
          </AlertTitle>
          <AlertDescription className="text-muted-foreground text-xs mt-1 flex items-center justify-between gap-4">
            <span>Schütze deinen Account mit einem zweiten Faktor (Authenticator-App).</span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 text-xs"
              onClick={openSetup}
              disabled={loading}
              data-testid="button-setup-2fa"
            >
              {loading ? "Wird geladen…" : "Jetzt einrichten"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Status-Zeile: 2FA ist aktiv */}
      {status.configured && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-2.5 text-sm">
            <ShieldCheck size={14} className="text-primary" />
            <span className="text-foreground font-medium">2FA aktiv</span>
            <span className="text-muted-foreground text-xs">
              · {status.recoveryCodesRemaining} Recovery-Code{status.recoveryCodesRemaining !== 1 ? "s" : ""} verbleibend
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => { setRegenStep("confirm"); setRegenCodes([]); setRegenOpen(true); }}
            data-testid="button-regen-recovery"
          >
            <RefreshCw size={12} />
            Neu generieren
          </Button>
        </div>
      )}

      {/* ── Setup-Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={setupOpen} onOpenChange={(open) => { if (!open) closeSetup(); }}>
        <DialogContent className="sm:max-w-md">
          {setupStep === "qr" && (
            <>
              <DialogHeader>
                <DialogTitle>2FA einrichten</DialogTitle>
                <DialogDescription>
                  Scanne den QR-Code mit deiner Authenticator-App (z.B. Google Authenticator, Authy oder 1Password).
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center gap-4 py-2">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR-Code für TOTP-Setup"
                    width={200} height={200}
                    className="rounded-lg border border-border"
                  />
                )}

                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1.5">Oder manuell eingeben:</p>
                  <code className="block w-full bg-muted px-3 py-2 rounded text-xs font-mono tracking-widest text-center break-all select-all">
                    {secret}
                  </code>
                </div>

                <div className="w-full space-y-2">
                  <p className="text-sm font-medium text-foreground">Code aus der App eingeben:</p>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={setCode}
                      onComplete={handleVerify}
                      data-testid="input-totp-setup-code"
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && <p className="text-xs text-red-400 text-center" role="alert">{error}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeSetup}>Abbrechen</Button>
                <Button
                  onClick={handleVerify}
                  disabled={code.length < 6 || loading}
                  data-testid="button-verify-2fa-setup"
                >
                  {loading ? "Wird geprüft…" : "Bestätigen"}
                </Button>
              </div>
            </>
          )}

          {setupStep === "codes" && (
            <>
              <DialogHeader>
                <DialogTitle>Recovery-Codes</DialogTitle>
                <DialogDescription>
                  Diese Codes werden <strong>nur einmal</strong> angezeigt. Bewahre sie sicher auf —
                  jeder Code kann einmalig statt des TOTP-Codes beim Login verwendet werden.
                </DialogDescription>
              </DialogHeader>

              <RecoveryCodeGrid codes={recoveryCodes} />

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => copyToClipboard(recoveryCodes)}
                >
                  {copied ? <><Check size={13} />Kopiert</> : <><Copy size={13} />Codes kopieren</>}
                </Button>
                <Button onClick={closeSetup} data-testid="button-finish-2fa-setup">
                  Fertig
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Regenerierungs-Dialog ─────────────────────────────────────────── */}
      <Dialog open={regenOpen} onOpenChange={(open) => { if (!open) closeRegen(); }}>
        <DialogContent className="sm:max-w-md">
          {regenStep === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Recovery-Codes neu generieren?</DialogTitle>
                <DialogDescription>
                  Alle bisherigen Recovery-Codes werden dauerhaft ungültig. Es werden 8 neue Codes erstellt.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={closeRegen}>Abbrechen</Button>
                <Button
                  variant="destructive"
                  onClick={handleRegen}
                  disabled={regenLoading}
                  data-testid="button-confirm-regen"
                >
                  {regenLoading ? "Wird generiert…" : "Neu generieren"}
                </Button>
              </div>
            </>
          )}

          {regenStep === "codes" && (
            <>
              <DialogHeader>
                <DialogTitle>Neue Recovery-Codes</DialogTitle>
                <DialogDescription>
                  Diese Codes werden <strong>nur einmal</strong> angezeigt. Alle alten Codes sind jetzt ungültig.
                </DialogDescription>
              </DialogHeader>

              <RecoveryCodeGrid codes={regenCodes} />

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => copyToClipboard(regenCodes)}
                >
                  {copied ? <><Check size={13} />Kopiert</> : <><Copy size={13} />Codes kopieren</>}
                </Button>
                <Button onClick={closeRegen} data-testid="button-finish-regen">
                  Fertig
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecoveryCodeGrid({ codes }: { codes: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1">
      {codes.map((c, i) => (
        <code
          key={i}
          className="bg-muted px-3 py-1.5 rounded text-xs font-mono tracking-widest text-center select-all"
        >
          {c}
        </code>
      ))}
    </div>
  );
}
