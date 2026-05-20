import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, DynamicTable,
  Tabs, Tab, TabList, TabPanel,
  Select, TextArea,
  useProductContext,
} from '@forge/react';
import { requestJira, invoke } from "@forge/bridge";

// ---------------------------------------------------------------------------
// Hilfsfunktion: Baut eine zweispaltige DynamicTable aus einem Array von
// [Bezeichnung, Wert]-Paaren.
// ---------------------------------------------------------------------------

/**
 * Rendert eine kompakte Metadaten-Tabelle mit zwei Spalten.
 *
 * @param {{ rows: [string, string][] }} props
 * @returns {JSX.Element}
 */
const MetaTable = ({ rows }) => {
  const head = {
    cells: [
      { key: 'label', content: 'Eigenschaft' },
      { key: 'value', content: 'Wert' },
    ],
  };
  const tableRows = rows.map(([label, value]) => ({
    key: label,
    cells: [
      { key: 'label', content: label },
      { key: 'value', content: String(value ?? '–') },
    ],
  }));
  return <DynamicTable head={head} rows={tableRows} />;
};

// ---------------------------------------------------------------------------
// Tab 1: Aktueller Benutzer
// ---------------------------------------------------------------------------

/**
 * Lädt die Profildaten des aktuell eingeloggten Jira-Nutzers und zeigt
 * sie als Tabelle an.
 *
 * @returns {JSX.Element}
 */
const UserTab = () => {
  const [user, setUser]   = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('[Speedy] Lade Benutzerdaten...');
    // invoke ruft den Backend-Resolver auf – dieser verwendet @forge/api,
    // das die App-Credentials nutzt und kein separates Frontend-Scope benötigt.
    invoke('getCurrentUser')
      .then(data => {
        console.log('[Speedy] Benutzerdaten empfangen:', data);
        setUser(data);
      })
      .catch(err => {
        console.error('[Speedy] Fehler Benutzerdaten:', err);
        setError(err.message);
      });
  }, []);

  if (error) return <Text>Fehler: {error}</Text>;
  if (!user)  return <Text>Lade Benutzerdaten...</Text>;

  // Konto-ID wird aus Datenschutzgründen gekürzt dargestellt.
  const maskedId = user.accountId ? `${user.accountId.slice(0, 8)}…` : '–';

  return (
    <>
      <Heading size="medium">{user.displayName}</Heading>
      <MetaTable rows={[
        ['Anzeigename',  user.displayName],
        ['E-Mail',       user.emailAddress || '–'],
        ['Kontotyp',     user.accountType],
        ['Konto-ID',     maskedId],
        ['Zeitzone',     user.timeZone || '–'],
        ['Sprache',      user.locale || '–'],
        ['Aktiv',        user.active ? 'Ja' : 'Nein'],
      ]} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Tab 2: Projekt
// ---------------------------------------------------------------------------

/**
 * Zeigt Metadaten eines Jira-Projekts.
 * Das aktive Projekt wird automatisch aus dem Seitenkontext ermittelt.
 * Ist kein Kontext verfügbar, kann der Nutzer ein Projekt aus einer
 * Auswahlliste wählen.
 *
 * @returns {JSX.Element}
 */
const ProjectTab = () => {
  const context = useProductContext();

  const [project,     setProject]     = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [error,       setError]       = useState(null);

  // Projektschlüssel aus dem Jira-Seitenkontext (z. B. CHRONO beim Aufruf der Projektseite).
  const contextKey = context?.extension?.project?.key;

  useEffect(() => {
    // context === undefined bedeutet: noch nicht geladen (async). Warten.
    if (context === undefined) return;

    if (contextKey) {
      console.log('[Speedy] Projekt aus Kontext:', contextKey);
      setSelectedKey(contextKey);
    } else {
      console.log('[Speedy] Kein Projektkontext – lade Projektliste...');
      requestJira('/rest/api/3/project/search', { headers: { 'Accept': 'application/json' } })
        .then(res => res.json())
        .then(data => setAllProjects(data.values || []))
        .catch(err => setError(err.message));
    }
  }, [context]);

  useEffect(() => {
    if (!selectedKey) return;
    console.log('[Speedy] Lade Projektdaten für:', selectedKey);
    setProject(null);
    requestJira(`/rest/api/3/project/${selectedKey}`, { headers: { 'Accept': 'application/json' } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[Speedy] Projektdaten empfangen:', data);
        setProject(data);
      })
      .catch(err => setError(err.message));
  }, [selectedKey]);

  if (error) return <Text>Fehler: {error}</Text>;

  return (
    <>
      {/* Auswahlliste nur anzeigen, wenn kein Kontext ermittelt werden konnte */}
      {!contextKey && (
        <Select
          placeholder="Projekt auswählen…"
          options={allProjects.map(p => ({ label: `${p.name} (${p.key})`, value: p.key }))}
          onChange={opt => setSelectedKey(opt?.value ?? null)}
        />
      )}

      {selectedKey && !project && <Text>Lade Projektdaten…</Text>}
      {!selectedKey && !contextKey && allProjects.length > 0 && <Text>Bitte ein Projekt auswählen.</Text>}

      {project && (
        <>
          <Heading size="medium">{project.name} ({project.key})</Heading>
          <MetaTable rows={[
            ['Name',          project.name],
            ['Schlüssel',     project.key],
            ['Beschreibung',  project.description || '–'],
            ['Projektleiter', project.lead?.displayName || '–'],
            ['Stil',          project.style],
            ['Aufgabentypen', project.issueTypes?.map(t => t.name).join(', ') || '–'],
            ['Komponenten',   project.components?.length > 0 ? project.components.map(c => c.name).join(', ') : '–'],
            ['Kategorie',     project.projectCategory?.name || '–'],
            ['URL',           project.url || '–'],
          ]} />
        </>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Tab 3: Anforderung
// ---------------------------------------------------------------------------

/**
 * Einfaches Eingabefeld für Anforderungen.
 *
 * @returns {JSX.Element}
 */
const AnforderungTab = () => {
  const [text, setText] = useState('');
  return (
    <>
      <Heading size="medium">Anforderung erfassen</Heading>
      <TextArea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Anforderung hier beschreiben…"
        resize="vertical"
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// App-Root
// ---------------------------------------------------------------------------

/**
 * Hauptkomponente: rendert die Tab-Navigation mit den drei Bereichen
 * Benutzer, Projekt und Anforderung.
 *
 * @returns {JSX.Element}
 */
const App = () => (
  <Tabs id="speedy-tabs">
    <TabList>
      <Tab>Benutzer</Tab>
      <Tab>Projekt</Tab>
      <Tab>Anforderung</Tab>
    </TabList>
    <TabPanel><UserTab /></TabPanel>
    <TabPanel><ProjectTab /></TabPanel>
    <TabPanel><AnforderungTab /></TabPanel>
  </Tabs>
);

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
