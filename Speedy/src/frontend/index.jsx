import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, DynamicTable,
  Tabs, Tab, TabList, TabPanel,
  Select, TextArea, Textfield,
  Stack, Inline, Box,
  Badge, Lozenge, Tag, TagGroup,
  User, SectionMessage,
  Spinner, Button, Label,
  useProductContext, xcss,
} from '@forge/react';
import { requestJira, invoke } from "@forge/bridge";

// ─── Styles ──────────────────────────────────────────────────────────────────

const roundedXcss = xcss({ borderRadius: 'border.radius.200' });

const cardXcss = xcss({
  borderRadius: 'border.radius.200',
  boxShadow:    'elevation.shadow.raised',
});

// ─── Shared Components ───────────────────────────────────────────────────────

/**
 * Zentrierter Lade-Spinner mit Beschriftung.
 *
 * @param {{ label: string }} props
 */
const LoadingView = ({ label }) => (
  <Box padding="space.600">
    <Stack space="space.200" alignInline="center">
      <Spinner size="large" label={label} />
      <Text>{label}</Text>
    </Stack>
  </Box>
);

/**
 * Fehlermeldung als farbiges SectionMessage.
 *
 * @param {{ message: string }} props
 */
const ErrorView = ({ message }) => (
  <Box padding="space.200">
    <SectionMessage appearance="error" title="Fehler beim Laden">
      <Text>{message}</Text>
    </SectionMessage>
  </Box>
);

/**
 * Zweispaltige Metadaten-Tabelle (Eigenschaft / Wert).
 *
 * @param {{ rows: [string, string][] }} props
 */
const MetaTable = ({ rows }) => (
  <DynamicTable
    head={{ cells: [
      { key: 'label', content: 'Eigenschaft', width: 35 },
      { key: 'value', content: 'Wert' },
    ]}}
    rows={rows.map(([label, value]) => ({
      key: label,
      cells: [
        { key: 'label', content: label },
        { key: 'value', content: String(value ?? '–') },
      ],
    }))}
  />
);

// ─── Tab 1: Benutzer ─────────────────────────────────────────────────────────

/**
 * Zeigt das Profil des eingeloggten Jira-Nutzers.
 * Daten werden über den Forge-Resolver geladen (Backend, kein 401-Problem).
 *
 * @returns {JSX.Element}
 */
const UserTab = () => {
  const [user, setUser]   = useState(null);
  const [error, setError] = useState(null);

  // Leeres [] → einmaliger Aufruf beim ersten Rendern.
  useEffect(() => {
    console.log('[Speedy] Lade Benutzerdaten...');
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

  if (error) return <ErrorView message={error} />;
  if (!user)  return <LoadingView label="Lade Benutzerdaten…" />;

  // Konto-ID aus Datenschutzgründen kürzen.
  const maskedId = user.accountId ? `${user.accountId.slice(0, 8)}…` : '–';

  return (
    <Box padding="space.200">
      <Stack space="space.300">

        {/* Profil-Header */}
        <Box backgroundColor="color.background.accent.blue.subtlest" padding="space.400" xcss={roundedXcss}>
          <Stack space="space.250">
            <Inline space="space.300" alignBlock="center">
              <User accountId={user.accountId} hideDisplayName />
              <Stack space="space.075">
                <Heading size="medium">{user.displayName}</Heading>
                <Text>{user.emailAddress || '–'}</Text>
              </Stack>
            </Inline>
            <Inline space="space.100">
              <Lozenge appearance={user.active ? 'success' : 'removed'}>
                {user.active ? 'Aktiv' : 'Inaktiv'}
              </Lozenge>
              <Lozenge appearance="new">{user.accountType}</Lozenge>
              {user.locale && (
                <Lozenge appearance="default">{user.locale.replace('_', '-')}</Lozenge>
              )}
            </Inline>
          </Stack>
        </Box>

        {/* Detail-Karte */}
        <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
          <Stack space="space.200">
            <Heading size="small">Details</Heading>
            <MetaTable rows={[
              ['Zeitzone', user.timeZone || '–'],
              ['Konto-ID', maskedId],
            ]} />
          </Stack>
        </Box>

      </Stack>
    </Box>
  );
};

// ─── Tab 2: Projekt ──────────────────────────────────────────────────────────

/**
 * Zeigt Metadaten des aktuellen Jira-Projekts.
 * Projekt wird automatisch aus dem Seitenkontext ermittelt;
 * Fallback: Dropdown-Auswahl.
 *
 * @returns {JSX.Element}
 */
const ProjectTab = () => {
  const context = useProductContext();

  const [project,     setProject]     = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [error,       setError]       = useState(null);

  // Projektschlüssel aus dem Jira-Seitenkontext (z. B. CHRONO).
  const contextKey = context?.extension?.project?.key;

  // context === undefined → noch nicht geladen, warten.
  useEffect(() => {
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

  if (error) return <ErrorView message={error} />;

  return (
    <Box padding="space.200">
      <Stack space="space.300">

        {/* Fallback: Projekt-Auswahl */}
        {!contextKey && (
          <Select
            placeholder="Projekt auswählen…"
            options={allProjects.map(p => ({ label: `${p.name} (${p.key})`, value: p.key }))}
            onChange={opt => setSelectedKey(opt?.value ?? null)}
          />
        )}

        {!contextKey && !selectedKey && allProjects.length > 0 && (
          <SectionMessage appearance="information" title="Projekt wählen">
            <Text>Wähle ein Projekt aus der Liste oben aus.</Text>
          </SectionMessage>
        )}

        {selectedKey && !project && <LoadingView label="Lade Projektdaten…" />}

        {project && (
          <Stack space="space.300">

            {/* Projekt-Header */}
            <Box backgroundColor="color.background.accent.teal.subtlest" padding="space.400" xcss={roundedXcss}>
              <Stack space="space.250">
                <Inline space="space.200" alignBlock="center">
                  <Heading size="medium">{project.name}</Heading>
                  <Badge appearance="primary">{project.key}</Badge>
                </Inline>
                {project.description && <Text>{project.description}</Text>}
                <Inline space="space.100">
                  <Lozenge appearance="inprogress">{project.style}</Lozenge>
                  {project.projectCategory && (
                    <Lozenge appearance="moved">{project.projectCategory.name}</Lozenge>
                  )}
                  {project.lead && (
                    <Lozenge appearance="default">Lead: {project.lead.displayName}</Lozenge>
                  )}
                </Inline>
              </Stack>
            </Box>

            {/* Aufgabentypen */}
            {project.issueTypes?.length > 0 && (
              <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
                <Stack space="space.150">
                  <Heading size="small">Aufgabentypen</Heading>
                  <TagGroup>
                    {project.issueTypes.map(t => (
                      <Tag key={t.id} text={t.name} />
                    ))}
                  </TagGroup>
                </Stack>
              </Box>
            )}

            {/* Komponenten */}
            {project.components?.length > 0 && (
              <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
                <Stack space="space.150">
                  <Heading size="small">Komponenten</Heading>
                  <TagGroup>
                    {project.components.map(c => (
                      <Tag key={c.id} text={c.name} />
                    ))}
                  </TagGroup>
                </Stack>
              </Box>
            )}

            {/* Metadaten-Tabelle */}
            <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
              <Stack space="space.200">
                <Heading size="small">Metadaten</Heading>
                <MetaTable rows={[
                  ['Schlüssel',     project.key],
                  ['Stil',          project.style],
                  ['Kategorie',     project.projectCategory?.name || '–'],
                  ['Projektleiter', project.lead?.displayName || '–'],
                  ['URL',           project.url || '–'],
                ]} />
              </Stack>
            </Box>

          </Stack>
        )}
      </Stack>
    </Box>
  );
};

// ─── Tab 3: Anforderung ──────────────────────────────────────────────────────

/**
 * Formular zum Erfassen einer neuen Anforderung.
 * Speichern-Logik ist als Platzhalter vorbereitet.
 *
 * @returns {JSX.Element}
 */
const AnforderungTab = () => {
  const [titel, setTitel] = useState('');
  const [text, setText]   = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    console.log('[Speedy] Anforderung gespeichert:', { titel, text });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setTitel('');
    setText('');
    setSaved(false);
  };

  return (
    <Box padding="space.200">
      <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
        <Stack space="space.300">

          <Stack space="space.050">
            <Heading size="medium">Neue Anforderung</Heading>
            <Text>Erfasse hier eine Anforderung für das Projekt.</Text>
          </Stack>

          <Stack space="space.100">
            <Label labelFor="req-titel">Titel *</Label>
            <Textfield
              id="req-titel"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="Kurze, prägnante Bezeichnung…"
            />
          </Stack>

          <Stack space="space.100">
            <Label labelFor="req-text">Beschreibung</Label>
            <TextArea
              id="req-text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Detaillierte Beschreibung der Anforderung, Akzeptanzkriterien, Abhängigkeiten…"
              resize="vertical"
            />
          </Stack>

          {saved && (
            <SectionMessage appearance="success" title="Gespeichert">
              <Text>Die Anforderung wurde erfolgreich gespeichert.</Text>
            </SectionMessage>
          )}

          <Inline space="space.100" alignInline="end">
            <Button appearance="subtle" onClick={handleReset}>
              Zurücksetzen
            </Button>
            <Button
              appearance="primary"
              onClick={handleSave}
              isDisabled={!titel.trim()}
            >
              Speichern
            </Button>
          </Inline>

        </Stack>
      </Box>
    </Box>
  );
};

// ─── App-Root ────────────────────────────────────────────────────────────────

/**
 * Einstiegspunkt: Tab-Navigation mit Benutzer, Projekt und Anforderung.
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
