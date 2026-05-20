# Forge Cheat Sheet — Windows / VS Code / Jira Cloud

## Ziel

Dieses Dokument beschreibt die wichtigsten Schritte für die Entwicklung von Atlassian Forge Apps unter Windows mit VS Code und Jira Cloud.

Testsystem:

- Jira Cloud: https://horometrics.atlassian.net
- Projektordner: `C:\Dev\Github\forgeJira\Speedy`

---

# 1. Voraussetzungen

## Node.js installieren

Download:

https://nodejs.org/

Prüfen:

```bash
node -v
npm -v
```

---

# 2. Forge CLI installieren

```bash
npm install -g @forge/cli@latest
```

Version prüfen:

```bash
forge --version
```

---

# 3. Login bei Atlassian

```bash
forge login
```

Danach Browser-Authentifizierung durchführen.

---

# 4. Neues Forge-Projekt

```bash
forge create
```

Projekt auswählen und danach:

```bash
cd Speedy
```

Dependencies installieren:

```bash
npm install
```

---

# 5. Wichtiger Hinweis zu Windows

Unter Windows/Git Bash:

NICHT:

```bash
sudo npm install
sudo forge deploy
```

Richtig:

```bash
npm install
forge deploy
```

`sudo` wird unter Windows nicht benötigt.

---

# 6. Projekt prüfen

```bash
forge lint
```

Automatisch korrigieren:

```bash
forge lint --fix
```

---

# 7. App deployen

```bash
forge deploy
```

Explizit Development:

```bash
forge deploy --environment development
```

---

# 8. App in Jira installieren

Erstinstallation:

```bash
forge install --site horometrics.atlassian.net
```

Falls gefragt:

```text
Product: Jira
Environment: development
```

---

# 9. Änderungen deployen

## Nur Code geändert

```bash
forge deploy
```

## manifest.yml geändert

Dann zusätzlich:

```bash
forge install --upgrade --site horometrics.atlassian.net --environment development
```

---

# 10. Lokale Entwicklung

## Tunnel starten

```bash
forge tunnel
```

Danach Jira öffnen:

https://horometrics.atlassian.net

Die App läuft dann gegen deinen lokalen Code.

---

# 11. Typischer Entwicklungsablauf

## Kleine Codeänderung

```bash
forge deploy
```

## Größere Änderungen (Manifest / Permissions)

```bash
forge deploy
forge install --upgrade --site horometrics.atlassian.net --environment development
```

## Lokal entwickeln

```bash
forge tunnel
```

---

# 12. Logs anzeigen

```bash
forge logs
```

Oder live:

```bash
forge tunnel
```

Im Code:

```js
console.log("Debug:", value);
```

---

# 13. Häufige Fehler

## Fehler

```text
Changes to manifest.yml have been detected
```

Lösung:

```bash
forge deploy
forge install --upgrade --site horometrics.atlassian.net --environment development
```

---

## Fehler

```text
asUser() requires user consent
```

Lösung:

```bash
forge deploy
forge install --upgrade --site horometrics.atlassian.net --environment development
```

Danach App in Jira neu öffnen.

---

## Fehler

```text
sudo is disabled
```

Lösung:

Kein `sudo` unter Windows verwenden.

---

# 14. Nützliche Befehle

## Alle Environments anzeigen

```bash
forge environments list
```

---

## Aktuelles Environment setzen

```bash
forge settings set default-environment development
```

---

## App löschen

```bash
forge uninstall
```

---

## Deploy-Status prüfen

```bash
forge deploy list
```

---

# 15. Empfehlenswerte Struktur

```text
Speedy/
├── manifest.yml
├── package.json
├── src/
│   ├── index.js
│   ├── resolvers/
│   └── frontend/
└── static/
```

---

# 16. Gute Praxis

- Häufig `forge lint`
- Kleine Deployments
- `manifest.yml` Änderungen bewusst durchführen
- `forge tunnel` für schnelle Iterationen nutzen
- Logs permanent beobachten
- Berechtigungen minimal halten

---

# 17. Standardbefehle für den Alltag

## Normale Entwicklung

```bash
cd /c/Dev/Github/forgeJira/Speedy

forge lint
forge deploy
```

## Nach Manifeständerungen

```bash
forge deploy
forge install --upgrade --site horometrics.atlassian.net --environment development
```

## Lokales Debugging

```bash
forge tunnel
```

---

# 18. Wichtige Dateien

## manifest.yml

Definiert:

- Module
- Permissions
- Scopes
- Resolver
- Resources

Änderungen hier benötigen meist:

```bash
forge deploy
forge install --upgrade
```

---

# 19. Hilfreiche Links

Forge Dokumentation:

https://developer.atlassian.com/platform/forge/

Forge CLI:

https://developer.atlassian.com/platform/forge/cli-reference/

Forge Tunnel:

https://developer.atlassian.com/platform/forge/tunneling/

Forge Permissions:

https://developer.atlassian.com/platform/forge/manifest-reference/permissions/

---

# 20. Merksätze

## Nur Code geändert

```bash
forge deploy
```

## manifest.yml geändert

```bash
forge deploy
forge install --upgrade
```

## Lokal testen

```bash
forge tunnel
```
