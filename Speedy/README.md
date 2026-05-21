# Speedy – Jira Projekt-Assistent

Speedy ist eine [Atlassian Forge](https://developer.atlassian.com/platform/forge/) App, die als Projektseite in Jira eingebunden wird. Sie unterstützt Teams bei der täglichen Arbeit mit Jira: Benutzer-Dashboard, Projektaktivitäten, Releaseplanung und Anforderungsstrukturierung.

---

## Funktionsübersicht

### Tab 1 – Benutzer
- Anzeige des eigenen Jira-Profils (Name, E-Mail, Zeitzone, Sprache, Status)
- **Check Issues**: Alle offenen Issues, die dem eingeloggten User zugewiesen sind oder von ihm erstellt wurden – sortiert nach Priorität und letzter Änderung
- Filterung der Ergebnisliste nach Projekt
- Pagination (20 Issues pro Seite)

### Tab 2 – Projekt
- Anzeige der Metadaten des aktuellen Jira-Projekts
- **Check Activities**: Alle heute geänderten oder neu angelegten Issues des Projekts mit Änderungsdetails (Kommentar, Statuswechsel, Priorität etc.) und Autor
- Zweispaltige Ansicht: links die Aktivitätsliste, rechts dieselbe Liste als Markdown-Tabelle zum Kopieren

### Tab 3 – Release
- Meilensteinplaner für Softwarereleases relativ zu einem frei wählbaren Go-Live-Datum
- Berücksichtigt NRW-Feiertage und Wochentag-Anpassungen automatisch
- Editierbares Regelwerk (Offsets, Wochentag-Fixierungen, Abhängigkeiten zwischen Meilensteinen)
- Darstellung als Timeline-Chart (LineChart) und chronologische Tabelle
- Markdown-Export der Meilensteinliste (25%-Spalte neben der Tabelle)
- Hinweis auf Urlaubssperren (Beta-Woche, Finalisierungswoche) inkl. iCal-Export (.ics) für Outlook / Google Calendar
- **Als Jira-Roadmap anlegen**: Erzeugt ein Epic mit allen Meilensteinen als Kind-Tasks, Urlaubssperren als Kalendereinträge, Board-Schnellfilter
- **Planung abschließen**: Setzt alle Issues des Release-Plans auf Done (ohne Admin-Rechte)
- Labels: `{Epic-Name}`, `release-plan`, `Milestone`, `Urlaubssperre`

### Tab 5 – AI
- Direkter KI-Chat über [OpenRouter](https://openrouter.ai) ohne Jira-Kontext
- Modellauswahl: Claude Sonnet/Opus, GPT-4o/mini, Gemini 2.0 Flash, Llama 3.3 70B
- Optionaler System-Prompt (ein-/ausklappbar)
- Anzeige von genutztem Modell und Token-Verbrauch pro Anfrage
- Erfordert einen OpenRouter API-Key (siehe [Konfiguration: OpenRouter API-Key](#konfiguration-openrouter-api-key))

### Rovo Agent – Story Strukturierer
- Strukturiert unformatierte Story-Beschreibungen zu sauberen Jira-Stories
- Ausgabeformat: Ziel, Hintergrund, Anforderungen, Technische Hinweise, Akzeptanzkriterien, Offene Punkte, Zusatzinformationen

---

## Technischer Stack

| Komponente | Technologie |
|---|---|
| Plattform | Atlassian Forge (native UI Kit) |
| Frontend | React 18, `@forge/react` 11, `@forge/bridge` 5 |
| Backend | Node.js 24, `@forge/api` 7, `@forge/resolver` 1 |
| Rendering | `render: native` (kein Custom UI iframe) |
| Architektur | `arm64`, 256 MB RAM |

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 18
- Forge CLI installiert: `npm install -g @forge/cli`
- Atlassian Developer Account: [developer.atlassian.com](https://developer.atlassian.com)
- Atlassian API-Token: [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

---

## Forge CLI – Installation

### 1. Node.js installieren

Forge benötigt Node.js ≥ 18. Version prüfen:

```bash
node --version
```

Download: [nodejs.org](https://nodejs.org/) (LTS-Version empfohlen)

### 2. Forge CLI global installieren

```bash
npm install -g @forge/cli
```

Installation prüfen:

```bash
forge --version
```

### 3. Atlassian API-Token erstellen

Forge CLI authentifiziert sich per API-Token, nicht per Passwort.

1. [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) aufrufen
2. **Create API token** klicken, Label vergeben (z. B. `forge-cli`)
3. Token kopieren und sicher aufbewahren – er wird nur einmal angezeigt

### 4. Forge CLI einrichten

```bash
forge login
# → E-Mail-Adresse eingeben (Atlassian-Account)
# → API-Token einfügen (nicht das Passwort!)
```

Eingeloggten Account prüfen:

```bash
forge whoami
```

---

## Forge CLI – Cheat Sheet

### Account & Authentifizierung

```bash
forge login                        # Im Browser einloggen (E-Mail + API-Token)
forge logout                       # Aktuellen Account abmelden
forge whoami                       # Zeigt den eingeloggten Account
```

### Neue App erstellen

```bash
forge create                       # Interaktiver Assistent: Template wählen, App benennen
                                   # → legt neues Verzeichnis mit manifest.yml an
```

> Für dieses Projekt wurde `Jira project page` + `UI Kit` als Template gewählt.

### App-ID registrieren (für neuen Account / neue Instanz)

```bash
forge register                     # Neue App-ID anlegen und in manifest.yml eintragen
                                   # (notwendig wenn app.id fehlt oder Account wechselt)
```

### Entwicklung

```bash
npm install                        # Node-Abhängigkeiten installieren

npx forge build                    # Frontend + Resolver bauen und hochladen
                                   # (kein vollständiges Deploy – Scopes werden nicht registriert)

npx forge tunnel                   # Lokaler Entwicklungs-Proxy:
                                   # Resolver laufen lokal, Frontend live neu laden
                                   # Änderungen an index.js/index.jsx sofort aktiv
```

### Deploy & Install

```bash
npx forge deploy                           # Code deployen + Scopes bei Atlassian registrieren
npx forge deploy --environment staging     # Auf ein bestimmtes Environment deployen

npx forge install                          # App auf einer Jira-Site installieren (einmalig)
                                           # → fragt nach Site-URL, z. B. mein-team.atlassian.net
npx forge install --upgrade                # Bestehende Installation upgraden
                                           # (notwendig nach Scope-Änderungen in manifest.yml)
npx forge install --environment production # Install auf Production-Environment
```

> **Wichtig:** `forge build` allein reicht nicht für Scope-Änderungen. Reihenfolge bei neuen Scopes:
> ```
> forge deploy → forge install --upgrade → im Browser Berechtigungen bestätigen
> ```

### Installationen verwalten

```bash
forge install list                 # Alle Installationen der App anzeigen (Site, Environment)
forge uninstall                    # App von einer Site deinstallieren
```

### Logs & Debugging

```bash
forge logs                         # Letzte Resolver-Logs aus der Cloud abrufen
forge logs --environment staging   # Logs eines bestimmten Environments
forge logs --tail                  # Live-Logs streamen (wie tail -f)
```

### Umgebungsvariablen

```bash
forge variables list                              # Alle gesetzten Variablen anzeigen
forge variables set MY_VAR --encrypt              # Variable verschlüsselt setzen
forge variables set MY_VAR --encrypt --environment production  # Für bestimmtes Environment
forge variables delete MY_VAR                     # Variable löschen
```

> Variablen sind im Resolver über `process.env.MY_VAR` verfügbar. Nie sensible Werte in Code oder `manifest.yml` schreiben.

### Weitere nützliche Befehle

```bash
forge lint                         # Manifest und Code auf Fehler prüfen
forge settings set                 # CLI-Einstellungen anpassen (z. B. Environment-Default)
forge --help                       # Alle verfügbaren Befehle anzeigen
forge <command> --help             # Hilfe zu einem bestimmten Befehl
```

---

## Typischer Workflow

```
1. forge login
2. forge create              ← nur bei neuer App
3. npm install
4. npx forge tunnel          ← Entwicklung (lokale Ausführung)
5. npx forge deploy          ← nach Fertigstellung oder Scope-Änderung
6. npx forge install         ← einmalig pro Site
   (oder: npx forge install --upgrade bei Scope-Änderung)
```

---

## Deployment auf eine andere Jira-Instanz

Jede Forge-App ist an eine **App-ID** und einen **Atlassian-Account** gebunden. Welcher Weg nötig ist, hängt davon ab, ob der Forge-CLI-Account auf der Ziel-Site bereits Zugriff hat.

### Voraussetzungen prüfen

**Wer bin ich im Forge CLI?**
```bash
forge whoami
# → Zeigt den eingeloggten Account (E-Mail + Account-ID)
```

**Habe ich Admin-Rechte auf der Ziel-Site?**  
Im Browser aufrufen:
```
https://<ziel-instanz>.atlassian.net/secure/admin/ViewApplicationProperties.jspa
```
Erscheint die Jira-Systemadministration → Admin-Rechte vorhanden.  
Erscheint ein 403 oder eine Weiterleitung → kein Admin-Zugriff.

---

### Szenario A – gleicher Forge-Account, neue Site

Der im Forge CLI eingeloggte Account ist bereits auf der Ziel-Site als Admin vorhanden.  
→ Kein `forge register` nötig, einfach auf der neuen Site installieren:

```bash
npx forge deploy
npx forge install
# → Site-URL eingeben: https://ziel-instanz.atlassian.net
```

Eine App kann auf beliebig vielen Sites installiert werden, solange sie unter demselben Atlassian-Account deployed ist.

---

### Szenario B – anderer Atlassian-Account (z. B. Corporate vs. privat)

Forge CLI ist mit einem anderen Account eingeloggt als dem, der auf der Ziel-Site Admin-Rechte hat (typisch: privater Gmail-Account vs. Unternehmens-Account).

In diesem Fall muss die App unter dem richtigen Account neu registriert werden:

```bash
# 1. Mit dem richtigen Account einloggen
forge logout
forge login
# → Browser öffnet sich: mit dem Account einloggen, der auf der Ziel-Site Admin ist

# 2. Neue App-ID für diesen Account registrieren
#    (app.id in manifest.yml wird automatisch aktualisiert)
forge register

# 3. Deployen und auf der Ziel-Site installieren
npx forge deploy
npx forge install
# → Site-URL eingeben: https://ziel-instanz.atlassian.net
```

> **Hinweis:** Nach `forge register` existieren zwei unabhängige Apps – eine pro Account. Änderungen müssen in beiden gepflegt werden, wenn beide Sites aktuell bleiben sollen.

---

### Parallelbetrieb (mehrere Sites, gleicher Account)

Forge unterstützt mehrere Environments (`development`, `staging`, `production`):

```bash
npx forge deploy --environment production
npx forge install --environment production
# → weitere Site-URL eingeben
```

---

### Confluence-Scopes aktivieren

Die App benötigt Confluence-Zugriff für den Aktivitätsexport. Nach der Installation auf einer neuen Instanz:

```bash
npx forge deploy
npx forge install --upgrade
```

Der User muss die neuen Berechtigungen im Browser-Dialog bestätigen.

---

## Konfiguration: OpenRouter API-Key

Der AI-Tab sendet Anfragen über [OpenRouter](https://openrouter.ai) an verschiedene KI-Modelle. Dafür wird ein API-Key benötigt.

### 1. API-Key erstellen

1. Account anlegen: [openrouter.ai](https://openrouter.ai)
2. → **Keys** → **Create Key**
3. Key kopieren (wird nur einmal angezeigt)

### 2. Key in Forge speichern

```bash
forge variables set OPENROUTER_API_KEY --encrypt
# → Eingabeaufforderung erscheint: Key einfügen und Enter
```

Der Key wird **verschlüsselt** in Atlassians Cloud gespeichert und ist im Resolver als `process.env.OPENROUTER_API_KEY` verfügbar.

> **Wichtig:** Den Key **nicht** in `.env`, `manifest.yml` oder eine andere Datei schreiben — er würde sonst im Git-Repository landen.

### 3. Key prüfen / verwalten

```bash
forge variables list                          # Zeigt alle gesetzten Variablen
forge variables set OPENROUTER_API_KEY --encrypt   # Key aktualisieren
forge variables delete OPENROUTER_API_KEY     # Key löschen
```

### 4. Pro Environment setzen

Forge-Variablen sind environment-spezifisch. Für Production separat setzen:

```bash
forge variables set OPENROUTER_API_KEY --encrypt --environment production
```

---

## Projektstruktur

```
Speedy/
├── manifest.yml              # Forge-App-Konfiguration (Module, Scopes, Runtime)
├── package.json
├── src/
│   ├── frontend/
│   │   └── index.jsx         # Gesamtes UI (alle 4 Tabs + Rovo Agent)
│   └── resolvers/
│       └── index.js          # Backend-Resolver (Jira API, Releaseplanung)
└── docs/
    └── releaseplanung/
        └── index.html        # Statische Dokumentation Releaseplanung
```

---

## Bekannte Einschränkungen

- **`startDate`-Feld**: In manchen Jira-Projekten ist das Standard-Feld `startDate` nicht auf dem Create-Screen konfiguriert. Speedy verwendet daher `customfield_10015` als Fallback für das Startdatum der Urlaubssperren.
- **Clipboard-API**: Im Forge-Iframe ist die Clipboard-API eingeschränkt. Das Markdown-Textfeld in Tab 2 und Tab 3 muss manuell markiert und kopiert werden.
- **Confluence-Scopes**: `requestConfluence` aus `@forge/bridge` benötigt eine aktive Installation mit den Confluence-Scopes. Bei HTTP 401 bitte `forge deploy && forge install --upgrade` ausführen.
- **Löschen von Issues**: Erfordert Jira-Adminrechte. Speedy verwendet daher stattdessen Transitions auf den Status "Done".
