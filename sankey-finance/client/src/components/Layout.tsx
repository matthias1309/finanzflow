import { Link, useLocation } from "wouter";
import { BarChart3, List, Tag, TrendingUp, Sun, Moon, Upload, Landmark, LogOut } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { API_BASE } from "@/lib/config";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/transactions", label: "Buchungen", icon: List },
  { href: "/import", label: "PDF importieren", icon: Upload },
  { href: "/accounts", label: "Konten", icon: Landmark },
  { href: "/categories", label: "Kategorien", icon: Tag },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  const { data: authStatus } = useQuery<{ authEnabled: boolean }>({
    queryKey: ["/api/auth/2fa/status"],
    queryFn: () => fetch(`${API_BASE}/api/auth/2fa/status`).then(r => r.json()),
  });

  async function handleLogout() {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST" });
    queryClient.clear();
    window.location.hash = "/login";
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col bg-card">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <svg aria-label="FinanzFlow Logo" viewBox="0 0 32 32" width="32" height="32" fill="none" className="flex-shrink-0">
              <rect width="32" height="32" rx="6" fill="hsl(163 80% 28%)" />
              <rect x="5" y="9" width="8" height="4" rx="1.5" fill="white" opacity="0.9" />
              <rect x="5" y="16" width="12" height="4" rx="1.5" fill="white" opacity="0.7" />
              <rect x="19" y="9" width="8" height="11" rx="1.5" fill="white" opacity="0.5" />
              <path d="M13 11 Q16 11 19 11" stroke="white" strokeWidth="1.5" opacity="0.6" />
              <path d="M17 18 Q18 18 19 15" stroke="white" strokeWidth="1.5" opacity="0.4" />
            </svg>
            <span className="text-sm font-semibold tracking-tight text-foreground">FinanzFlow</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3" aria-label="Hauptnavigation">
          <ul className="space-y-0.5" role="list">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <li key={href}>
                  <Link href={href}>
                    <a
                      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon size={15} />
                      {label}
                    </a>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border space-y-2">
          <Button
            data-testid="button-toggle-theme"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs font-medium text-muted-foreground border-border hover:text-foreground"
            onClick={toggle}
          >
            {theme === "dark" ? <><Sun size={13} />Light-Modus</> : <><Moon size={13} />Dark-Modus</>}
          </Button>
          {authStatus?.authEnabled && (
            <Button
              data-testid="button-logout"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut size={13} />
              Abmelden
            </Button>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 pt-1">
            <TrendingUp size={12} />
            <span>Persönliche Finanzen</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
