# REQ-014 — Mobile-Responsive UI

## Ziel

FinanzFlow soll auf Smartphones (iOS Safari, Android Chrome) vollständig nutzbar sein. Alle Seiten passen sich an Bildschirmbreiten ab 320 px an. Unter 768 px wird die Desktop-Sidebar durch ein Hamburger-Menü mit Slide-in Drawer ersetzt.

## Acceptance Criteria

### Navigation

```gherkin
Given der Nutzer öffnet die App auf einem Smartphone (<768 px)
Then sieht er eine fixierte Top-Bar mit Logo und Hamburger-Icon
And die Sidebar ist nicht sichtbar

When der Nutzer auf das Hamburger-Icon tippt
Then gleitet die Sidebar als Drawer von links ein
And ein dunkler Backdrop überdeckt den Inhalt dahinter

When der Nutzer einen Nav-Link im Drawer antippt
Then schließt sich der Drawer
And die gewünschte Seite wird angezeigt

When der Nutzer auf den Backdrop tippt
Then schließt sich der Drawer ohne Navigation
```

### Dashboard

```gherkin
Given der Nutzer ist auf dem Dashboard
When die Bildschirmbreite < 640 px
Then zeigen die KPI-Karten 2 Spalten

When die Bildschirmbreite >= 1024 px
Then zeigen die KPI-Karten 4 Spalten

When Konten vorhanden sind und Breite < 640 px
Then zeigt die Kontenübersicht 1 Spalte

When Konten vorhanden sind und Breite >= 640 px und < 1024 px
Then zeigt die Kontenübersicht 2 Spalten
```

### Buchungen

```gherkin
Given der Nutzer ist auf der Buchungsseite
When die Bildschirmbreite < 768 px
Then stapeln sich Titel und Filter-Controls untereinander (flex-col)

When die Transaktionstabelle breiter ist als der Viewport
Then ist sie horizontal scrollbar (kein Overflow-Abschneiden)
```

### Alle Seiten

```gherkin
Given die Bildschirmbreite < 768 px
Then beträgt das horizontale Padding aller Seiten-Header und -Content mindestens 16 px (p-4)
And kein Content-Element wird abgeschnitten oder überlappt die Top-Bar
```

## Technische Notizen

- Hamburger-Menü: `Menu`-Icon (lucide-react), Drawer via `transition-transform` (kein externes Paket)
- Sidebar: `fixed inset-y-0 left-0` auf Mobile, `md:static` auf Desktop
- Breakpoints: Tailwind-Standard (`sm` = 640 px, `md` = 768 px, `lg` = 1024 px)
- TDD-Ausnahme: Rein visuelle Änderungen ohne messbare Assertions — kein automatisierter Test-Layer
