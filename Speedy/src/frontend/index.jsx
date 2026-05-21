import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, DynamicTable,
  Tabs, Tab, TabList, TabPanel,
  Select, TextArea, Textfield, Toggle,
  Stack, Inline, Box,
  Badge, Lozenge, Tag, TagGroup,
  User, SectionMessage,
  Spinner, Button, Label, Link,
  DatePicker, LineChart,
  useProductContext, xcss,
} from '@forge/react';
import { requestJira, invoke, rovo } from "@forge/bridge";

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

// ─── Issue-Hilfsfunktionen & Komponente ─────────────────────────────────────

const PRIORITY_APPEARANCE = {
  highest: 'removed',
  high:    'moved',
  medium:  'new',
  low:     'default',
  lowest:  'default',
};

const priorityAppearance = (name) =>
  PRIORITY_APPEARANCE[(name ?? '').toLowerCase()] ?? 'default';

const statusAppearance = (category) => {
  if (category === 'done')          return 'success';
  if (category === 'indeterminate') return 'inprogress';
  return 'default';
};

const fmtIsoDate = (iso) => {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const ISSUE_HEAD = {
  cells: [
    { key: 'prio',    content: 'Priorität', width: 9  },
    { key: 'issue',   content: 'Issue'               },
    { key: 'type',    content: 'Typ',       width: 10 },
    { key: 'status',  content: 'Status',    width: 13 },
    { key: 'project', content: 'Projekt',   width: 8  },
    { key: 'role',    content: 'Rolle',     width: 10 },
    { key: 'updated', content: 'Geändert',  width: 10 },
  ],
};

const IssueTable = ({ issues, isLoading }) => (
  <DynamicTable
    head={ISSUE_HEAD}
    rows={issues.map(issue => ({
      key: issue.key,
      cells: [
        {
          key: 'prio',
          content: (
            <Lozenge appearance={priorityAppearance(issue.priority)}>
              {issue.priority}
            </Lozenge>
          ),
        },
        {
          key: 'issue',
          content: (
            <Stack space="space.050">
              <Link href={issue.url} openNewWindow>{issue.key}</Link>
              <Text>{issue.summary}</Text>
            </Stack>
          ),
        },
        { key: 'type',    content: <Text>{issue.type}</Text> },
        {
          key: 'status',
          content: (
            <Lozenge appearance={statusAppearance(issue.statusCategory)}>
              {issue.status}
            </Lozenge>
          ),
        },
        { key: 'project', content: <Badge>{issue.project}</Badge> },
        {
          key: 'role',
          content: (
            <Lozenge appearance={issue.isAssigned ? 'inprogress' : 'default'}>
              {issue.isAssigned ? 'Zugewiesen' : 'Erstellt'}
            </Lozenge>
          ),
        },
        { key: 'updated', content: <Text>{fmtIsoDate(issue.updated)}</Text> },
      ],
    }))}
    isLoading={isLoading}
    emptyView={<Text>Keine Issues gefunden.</Text>}
    rowsPerPage={20}
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
  const [user,          setUser]          = useState(null);
  const [error,         setError]         = useState(null);
  const [issues,        setIssues]        = useState(null);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issueError,    setIssueError]    = useState(null);
  const [projectFilter, setProjectFilter] = useState('');

  useEffect(() => {
    invoke('getCurrentUser')
      .then(data => data ? setUser(data) : setError('Keine Benutzerdaten erhalten.'))
      .catch(err => setError(err?.message ?? String(err)));
  }, []);

  const handleCheckIssues = () => {
    setLoadingIssues(true);
    setIssueError(null);
    setProjectFilter('');
    invoke('getMyIssues')
      .then(data => setIssues(data))
      .catch(err => setIssueError(err?.message ?? String(err)))
      .finally(() => setLoadingIssues(false));
  };

  const projectOptions = issues
    ? [
        { label: 'Alle Projekte', value: '' },
        ...Array.from(new Set(issues.map(i => i.project))).sort().map(p => ({ label: p, value: p })),
      ]
    : [];

  const filteredIssues = issues
    ? (projectFilter ? issues.filter(i => i.project === projectFilter) : issues)
    : [];

  if (error) return <ErrorView message={error} />;
  if (!user)  return <LoadingView label="Lade Benutzerdaten…" />;

  const maskedId = user.accountId ? `${user.accountId.slice(0, 8)}…` : '–';

  return (
    <Box padding="space.200">
      <Stack space="space.300">

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

        <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
          <Stack space="space.200">
            <Heading size="small">Details</Heading>
            <MetaTable rows={[
              ['Zeitzone', user.timeZone || '–'],
              ['Konto-ID', maskedId],
            ]} />
          </Stack>
        </Box>

        <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
          <Stack space="space.300">

            <Inline spread="space-between" alignBlock="center">
              <Stack space="space.050">
                <Heading size="small">Meine Issues</Heading>
                {issues !== null && !loadingIssues && (
                  <Text>
                    {projectFilter
                      ? `${filteredIssues.length} von ${issues.length} Issues`
                      : `${issues.length} Issue${issues.length !== 1 ? 's' : ''} gefunden`}
                  </Text>
                )}
              </Stack>
              <Button
                appearance="primary"
                onClick={handleCheckIssues}
                isDisabled={loadingIssues}
              >
                {loadingIssues ? 'Lade…' : issues === null ? 'Check Issues' : 'Aktualisieren'}
              </Button>
            </Inline>

            {issues !== null && !loadingIssues && projectOptions.length > 2 && (
              <Select
                options={projectOptions}
                value={projectOptions.find(o => o.value === projectFilter) ?? projectOptions[0]}
                onChange={opt => setProjectFilter(opt?.value ?? '')}
                placeholder="Nach Projekt filtern…"
              />
            )}

            {issueError && (
              <SectionMessage appearance="error" title="Fehler beim Laden">
                <Text>{issueError}</Text>
              </SectionMessage>
            )}

            {issues === null && !loadingIssues && !issueError && (
              <Box padding="space.200">
                <Text>Klick auf "Check Issues" um zugewiesene und erstellte Issues zu laden.</Text>
              </Box>
            )}

            {(issues !== null || loadingIssues) && (
              <IssueTable issues={filteredIssues} isLoading={loadingIssues} />
            )}

          </Stack>
        </Box>

      </Stack>
    </Box>
  );
};

// ─── Tab 2: Projekt ──────────────────────────────────────────────────────────

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';

const ActivityPanel = ({ items }) => {
  if (items.length === 0) {
    return (
      <SectionMessage appearance="information" title="Keine Aktivitäten heute">
        <Text>Heute wurden in diesem Projekt noch keine Issues bearbeitet.</Text>
      </SectionMessage>
    );
  }
  return (
    <Stack space="space.200">
      {items.map(issue => (
        <Box key={issue.key} backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
          <Stack space="space.150">
            <Inline space="space.150" alignBlock="center">
              <Link href={issue.url} openNewWindow>{issue.key}</Link>
              <Text>{issue.summary}</Text>
              <Lozenge appearance="default">{issue.type}</Lozenge>
            </Inline>
            <Box paddingInlineStart="space.200">
              <Stack space="space.075">
                {issue.activities.map((act, idx) => (
                  <Inline key={idx} space="space.150" alignBlock="center" shouldWrap={false}>
                    <Badge>{fmtTime(act.time)}</Badge>
                    {act.authorId
                      ? <User accountId={act.authorId} />
                      : <Text>{act.author}</Text>}
                    <Text weight="medium">{act.description}</Text>
                    {act.text && <Text>· {act.text}</Text>}
                  </Inline>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

/**
 * Zeigt Metadaten des aktuellen Jira-Projekts.
 * Projekt wird automatisch aus dem Seitenkontext ermittelt;
 * Fallback: Dropdown-Auswahl.
 *
 * @returns {JSX.Element}
 */
const ProjectTab = () => {
  const context = useProductContext();

  const [project,            setProject]            = useState(null);
  const [allProjects,        setAllProjects]        = useState([]);
  const [selectedKey,        setSelectedKey]        = useState(null);
  const [error,              setError]              = useState(null);
  const [activities,         setActivities]         = useState(null);
  const [loadingActivities,  setLoadingActivities]  = useState(false);
  const [activityError,      setActivityError]      = useState(null);

  const contextKey = context?.extension?.project?.key;

  // context === undefined → noch nicht geladen, warten.
  useEffect(() => {
    if (context === undefined) return;

    if (contextKey) {
      setSelectedKey(contextKey);
    } else {
      requestJira('/rest/api/3/project/search', { headers: { 'Accept': 'application/json' } })
        .then(res => res.json())
        .then(data => setAllProjects(data.values || []))
        .catch(err => setError(err?.message ?? String(err)));
    }
  }, [context]);

  useEffect(() => {
    if (!selectedKey) return;
    setProject(null);
    requestJira(`/rest/api/3/project/${selectedKey}`, { headers: { 'Accept': 'application/json' } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setProject)
      .catch(err => setError(err?.message ?? String(err)));
  }, [selectedKey]);

  const handleCheckActivities = () => {
    if (!selectedKey) return;
    setLoadingActivities(true);
    setActivityError(null);
    invoke('getProjectActivity', { projectKey: selectedKey })
      .then(data => setActivities(data))
      .catch(err => setActivityError(err?.message ?? String(err)))
      .finally(() => setLoadingActivities(false));
  };

  if (error) return <ErrorView message={error} />;

  return (
    <Box padding="space.200">
      <Stack space="space.300">

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

            {project.issueTypes?.length > 0 && (
              <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
                <Stack space="space.150">
                  <Heading size="small">Aufgabentypen</Heading>
                  <TagGroup>
                    {project.issueTypes.map(t => <Tag key={t.id} text={t.name} />)}
                  </TagGroup>
                </Stack>
              </Box>
            )}

            {project.components?.length > 0 && (
              <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
                <Stack space="space.150">
                  <Heading size="small">Komponenten</Heading>
                  <TagGroup>
                    {project.components.map(c => <Tag key={c.id} text={c.name} />)}
                  </TagGroup>
                </Stack>
              </Box>
            )}

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

            <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
              <Stack space="space.300">

                <Inline spread="space-between" alignBlock="center">
                  <Stack space="space.050">
                    <Heading size="small">Heutige Aktivitäten</Heading>
                    {activities !== null && !loadingActivities && (
                      <Text>{activities.length} Issue{activities.length !== 1 ? 's' : ''} mit Änderungen</Text>
                    )}
                  </Stack>
                  <Button
                    appearance="primary"
                    onClick={handleCheckActivities}
                    isDisabled={loadingActivities}
                  >
                    {loadingActivities ? 'Lade…' : activities === null ? 'Check Activities' : 'Aktualisieren'}
                  </Button>
                </Inline>

                {activityError && (
                  <SectionMessage appearance="error" title="Fehler beim Laden">
                    <Text>{activityError}</Text>
                  </SectionMessage>
                )}

                {activities === null && !loadingActivities && !activityError && (
                  <Box padding="space.200">
                    <Text>Klick auf "Check Activities" um heutige Änderungen im Projekt zu sehen.</Text>
                  </Box>
                )}

                {loadingActivities && <LoadingView label="Lade Aktivitäten…" />}

                {activities !== null && !loadingActivities && (
                  <ActivityPanel items={activities} />
                )}

              </Stack>
            </Box>

          </Stack>
        )}
      </Stack>
    </Box>
  );
};

// ─── Tab 4: Anforderung ──────────────────────────────────────────────────────

const BEREICHE = [
  { key: 'VBON', label: 'VBON',        suffix: 'VBON' },
  { key: 'DOL',  label: 'DOL',         suffix: 'DOL'  },
  { key: 'WS',   label: 'Webservices', suffix: 'WS'   },
];

const initAreas = () => ({
  VBON: { checked: false, title: '', desc: '' },
  DOL:  { checked: false, title: '', desc: '' },
  WS:   { checked: false, title: '', desc: '' },
});

const bereichAccent = {
  VBON: 'color.background.accent.blue.subtlest',
  DOL:  'color.background.accent.teal.subtlest',
  WS:   'color.background.accent.purple.subtlest',
};

const AnforderungTab = () => {
  const context    = useProductContext();
  const projectKey = context?.extension?.project?.key ?? null;

  const [epics,          setEpics]          = useState([]);
  const [epicsLoading,   setEpicsLoading]   = useState(false);
  const [epicsErr,       setEpicsErr]       = useState('');
  const [epicsRefresh,   setEpicsRefresh]   = useState(0);
  const [selectedEpic,   setSelectedEpic]   = useState(null);
  const [storyTitle,   setStoryTitle]   = useState('');
  const [storyDesc,    setStoryDesc]    = useState('');
  const [areas,        setAreas]        = useState(initAreas);
  const [creating,     setCreating]     = useState(false);
  const [result,       setResult]       = useState(null);
  const [createError,  setCreateError]  = useState('');
  const [rovoEnabled,  setRovoEnabled]  = useState(false);

  useEffect(() => {
    rovo.isEnabled().then(setRovoEnabled).catch(() => setRovoEnabled(false));
  }, []);

  useEffect(() => {
    if (!projectKey) return;
    setEpicsLoading(true);
    setEpicsErr('');
    requestJira('/rest/api/3/search/jql', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({
        jql:        `project = "${projectKey}" AND issuetype = Epic ORDER BY created DESC`,
        fields:     ['summary'],
        maxResults: 50,
      }),
    })
      .then(res => res.json())
      .then(data => setEpics((data.issues ?? []).map(i => ({ key: i.key, summary: i.fields.summary }))))
      .catch(err => setEpicsErr(err?.message ?? String(err)))
      .finally(() => setEpicsLoading(false));
  }, [projectKey, epicsRefresh]);

  const handleAreaToggle = (key, checked) => {
    const b = BEREICHE.find(x => x.key === key);
    setAreas(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        checked,
        title: checked && !prev[key].title
          ? (storyTitle.trim() ? `${storyTitle.trim()} [${b.suffix}]` : `[${b.suffix}]`)
          : prev[key].title,
      },
    }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    setResult(null);
    try {
      const checkedAreas = BEREICHE
        .filter(b => areas[b.key].checked)
        .map(b => ({ key: b.key, label: b.label, title: areas[b.key].title.trim(), desc: areas[b.key].desc.trim() }));
      const res = await invoke('createRequirement', {
        projectKey,
        epicKey:    selectedEpic.value,
        storyTitle: storyTitle.trim(),
        storyDesc:  storyDesc.trim(),
        areas:      checkedAreas,
      });
      setResult(res);
    } catch (err) {
      setCreateError(err?.message ?? String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setCreateError('');
    setStoryTitle('');
    setStoryDesc('');
    setSelectedEpic(null);
    setAreas(initAreas());
  };

  const checkedAreas   = BEREICHE.filter(b => areas[b.key].checked);
  const allTitlesValid = checkedAreas.every(b => areas[b.key].title.trim());
  const canCreate      = !!selectedEpic && !!storyTitle.trim() && !!projectKey && allTitlesValid;

  if (!projectKey) {
    return (
      <Box padding="space.200">
        <SectionMessage appearance="warning" title="Kein Projektkontext">
          <Text>Bitte öffne die App über eine Jira-Projektseite.</Text>
        </SectionMessage>
      </Box>
    );
  }

  return (
    <Box padding="space.200">
      <Stack space="space.300">

        <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
          <Stack space="space.200">
            <Inline space="space.200" alignBlock="center">
              <Heading size="small">Epic auswählen</Heading>
              <Button
                appearance="subtle"
                onClick={() => setEpicsRefresh(v => v + 1)}
                isDisabled={epicsLoading}
              >
                Aktualisieren
              </Button>
              {epicsLoading && <Spinner size="small" label="Lade Epics…" />}
            </Inline>
            {epicsErr
              ? <ErrorView message={epicsErr} />
              : <Select
                  placeholder={epicsLoading ? 'Lade Epics…' : 'Epic wählen…'}
                  options={epics.map(e => ({ label: `${e.key} – ${e.summary}`, value: e.key }))}
                  value={selectedEpic}
                  onChange={opt => setSelectedEpic(opt)}
                />
            }
            {!epicsLoading && !epicsErr && epics.length === 0 && (
              <Text>Keine Epics im Projekt gefunden.</Text>
            )}
          </Stack>
        </Box>

        <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
          <Stack space="space.250">
            <Heading size="small">Story (Anforderung)</Heading>
            <Stack space="space.100">
              <Label labelFor="story-title">Titel *</Label>
              <Textfield
                id="story-title"
                value={storyTitle}
                onChange={e => setStoryTitle(e.target.value)}
                placeholder="Kurze, prägnante Bezeichnung der Anforderung…"
              />
            </Stack>
            <Stack space="space.100">
              <Inline space="space.200" alignBlock="center">
                <Text>Beschreibung</Text>
                <Button
                  appearance="subtle"
                  isDisabled={!rovoEnabled}
                  onClick={() => {
                    try {
                      rovo.open({
                        agentKey:  'story-structurer',
                        agentName: 'Story Strukturierer',
                        prompt: storyDesc.trim()
                          ? `Strukturiere folgende Story-Beschreibung für Jira:\n\n${storyDesc.trim()}`
                          : 'Ich möchte eine neue Jira-Story schreiben. Führe mich durch die wichtigsten Punkte.',
                      });
                    } catch { /* ignore */ }
                  }}
                >
                  {rovoEnabled ? 'Mit Rovo strukturieren' : 'Rovo nicht verfügbar'}
                </Button>
              </Inline>
              <TextArea
                id="story-desc"
                value={storyDesc}
                onChange={e => setStoryDesc(e.target.value)}
                placeholder="Stichpunkte, Rohentwurf oder unstrukturierten Text eingeben – Rovo hilft beim Strukturieren…"
              />
            </Stack>
          </Stack>
        </Box>

        <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
          <Stack space="space.250">
            <Stack space="space.050">
              <Heading size="small">Betroffene Bereiche</Heading>
              <Text>Pro aktiviertem Bereich wird eine eigenständige Sub-task angelegt – separate Bearbeitung, eigener Status.</Text>
            </Stack>
            <Stack space="space.200">
              {BEREICHE.map(b => (
                <Stack key={b.key} space="space.075">
                  <Inline space="space.150" alignBlock="center">
                    <Toggle
                      id={`toggle-${b.key}`}
                      isChecked={areas[b.key].checked}
                      onChange={e => handleAreaToggle(b.key, e.target.checked)}
                      label={b.label}
                    />
                    <Text>{b.label}</Text>
                  </Inline>
                  {areas[b.key].checked && (
                    <Box
                      backgroundColor={bereichAccent[b.key]}
                      padding="space.200"
                      xcss={roundedXcss}
                    >
                      <Stack space="space.150">
                        <Stack space="space.075">
                          <Label labelFor={`area-${b.key}`}>Titel Sub-task {b.label} *</Label>
                          <Textfield
                            id={`area-${b.key}`}
                            value={areas[b.key].title}
                            onChange={e => setAreas(prev => ({
                              ...prev,
                              [b.key]: { ...prev[b.key], title: e.target.value },
                            }))}
                            placeholder={`Titel der Sub-task für ${b.label}…`}
                          />
                        </Stack>
                        <Stack space="space.075">
                          <Inline space="space.200" alignBlock="center">
                            <Text>Beschreibung Sub-task {b.label}</Text>
                              <Button
                                appearance="subtle"
                                isDisabled={!rovoEnabled}
                                onClick={() => {
                                  try {
                                    rovo.open({
                                      agentKey:  'story-structurer',
                                      agentName: 'Story Strukturierer',
                                      prompt: areas[b.key].desc.trim()
                                        ? `Strukturiere folgende Beschreibung für die Sub-task "${areas[b.key].title || b.label}" (Bereich ${b.label}) als Jira-Story:\n\n${areas[b.key].desc.trim()}`
                                        : `Ich möchte eine Sub-task für den Bereich ${b.label} beschreiben. Führe mich durch die wichtigsten Punkte.`,
                                    });
                                  } catch { /* ignore */ }
                                }}
                              >
                                {rovoEnabled ? 'Mit Rovo strukturieren' : 'Rovo nicht verfügbar'}
                              </Button>
                          </Inline>
                          <TextArea
                            id={`area-desc-${b.key}`}
                            value={areas[b.key].desc}
                            onChange={e => setAreas(prev => ({
                              ...prev,
                              [b.key]: { ...prev[b.key], desc: e.target.value },
                            }))}
                            placeholder={`Beschreibung oder Stichpunkte für ${b.label}…`}
                          />
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Box>

        {createError && <ErrorView message={createError} />}

        {result && (
          <SectionMessage appearance="success" title="Erfolgreich angelegt">
            <Stack space="space.100">
              <Inline space="space.100" alignBlock="center">
                <Text>Story:</Text>
                <Link href={result.storyUrl} openNewWindow>{result.storyKey}</Link>
              </Inline>
              {result.subtasks.map(t => (
                <Inline key={t.key} space="space.100" alignBlock="center">
                  <Text>Sub-task {t.label}:</Text>
                  <Link href={t.url} openNewWindow>{t.key}</Link>
                </Inline>
              ))}
            </Stack>
          </SectionMessage>
        )}

        <Inline space="space.100" alignInline="end">
          <Button appearance="subtle" onClick={handleReset}>
            Zurücksetzen
          </Button>
          <Button
            appearance="primary"
            onClick={handleCreate}
            isDisabled={!canCreate || creating}
          >
            {creating ? 'Wird angelegt…' : 'Anforderung anlegen'}
          </Button>
          {creating && <Spinner size="medium" label="Bitte warten…" />}
        </Inline>

      </Stack>
    </Box>
  );
};


// ─── Tab 4: Release – Hilfsfunktionen ────────────────────────────────────────

/** Gibt ein neues Date zurück, das `diff` Kalendertage von `date` entfernt ist (negativ = zurück). */
function addDays(date, diff) {
  const d = new Date(date);
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Berechnet den Ostersonntag eines Jahres nach der Gaußschen Osterformel.
 *
 * @param {number} year
 * @returns {Date}
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const holidayCache = {};

/**
 * Gibt alle gesetzlichen NRW-Feiertage eines Jahres als Map (ISO-Datum → Name) zurück.
 * Festtage: Bundesrecht + NRW-Landesrecht (SchFG NW).
 * Bewegliche Feste: berechnet aus Ostersonntag via Gaußscher Osterformel.
 *
 * @param {number} year
 * @returns {Map<string, string>}
 */
function getNRWHolidayMap(year) {
  if (holidayCache[year]) return holidayCache[year];
  const easter = getEasterSunday(year);
  const iso = toLocalISOString; // lokale Datumsformatierung statt toISOString() (UTC-Versatz in DE)
  holidayCache[year] = new Map([
    [`${year}-01-01`, 'Neujahr'],
    [`${year}-01-06`, 'Heilige Drei Könige'],
    [iso(addDays(easter, -2)),  'Karfreitag'],
    [iso(addDays(easter,  1)),  'Ostermontag'],
    [`${year}-05-01`, 'Tag der Arbeit'],
    [iso(addDays(easter, 39)), 'Christi Himmelfahrt'],
    [iso(addDays(easter, 50)), 'Pfingstmontag'],
    [iso(addDays(easter, 60)), 'Fronleichnam'],
    [`${year}-10-03`, 'Tag der deutschen Einheit'],
    [`${year}-11-01`, 'Allerheiligen'],
    [`${year}-12-25`, '1. Weihnachtstag'],
    [`${year}-12-26`, '2. Weihnachtstag'],
  ]);
  return holidayCache[year];
}

/** Gibt `true` zurück, wenn `date` ein gesetzlicher NRW-Feiertag ist. */
function isNRWHoliday(date) {
  return getNRWHolidayMap(date.getFullYear()).has(toLocalISOString(date));
}

/** Gibt den Namen des NRW-Feiertags zurück, oder `null` wenn kein Feiertag. */
function getHolidayName(date) {
  return getNRWHolidayMap(date.getFullYear()).get(toLocalISOString(date)) || null;
}

/** Gibt `true` zurück, wenn `date` ein Arbeitstag ist (Mo–Fr, kein NRW-Feiertag). */
function isWorkday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !isNRWHoliday(date);
}

/**
 * Zählt `n` Arbeitstage (Mo–Fr, ohne NRW-Feiertage) rückwärts von `date`.
 *
 * @param {Date}   date - Ausgangsdatum (exklusiv)
 * @param {number} n    - Anzahl Arbeitstage zurück (≥ 1)
 * @returns {Date}
 */
function subtractWorkdays(date, n) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return new Date(NaN);
  let d = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    if (isWorkday(d)) remaining--;
  }
  return d;
}

/**
 * Verschiebt `date` rückwärts auf den letzten Tag mit Wochentagnummer `target`
 * (0 = So … 6 = Sa). Liegt `date` bereits auf `target`, wird es nicht verändert.
 *
 * @param {Date}   date   - Ausgangsdatum
 * @param {number} target - Zielwochentag (1 = Mo, 4 = Do usw.)
 * @returns {Date}
 */
function adjustToWeekday(date, target) {
  const d = new Date(date);
  while (d.getDay() !== target) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Gibt die Kalenderwoche (Mo–Fr) zurück, in der `date` liegt.
 *
 * @param {Date} date
 * @returns {{ start: Date, end: Date }}
 */
function getWeekRange(date) {
  const d   = new Date(date);
  const dow = d.getDay();
  const monday = addDays(d, dow === 0 ? -6 : 1 - dow);
  return { start: monday, end: addDays(monday, 4) };
}

/**
 * Parst einen ISO-String 'YYYY-MM-DD' als lokales Datum.
 * `new Date('YYYY-MM-DD')` würde UTC mitternacht interpretieren → in DE (UTC+1/+2)
 * einen Tag zu früh. Diese Funktion umgeht das Problem via Date-Konstruktor mit Einzelwerten.
 *
 * @param {string} isoStr
 * @returns {Date}
 */
function parseLocalDate(isoStr) {
  const [y, mo, day] = isoStr.split('-').map(Number);
  return new Date(y, mo - 1, day);
}

/** Formatiert ein Date als deutsches Kurzformat mit Wochentag, z. B. "Mo, 04.06.2025". */
function formatDate(d) {
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Gibt 'YYYY-MM-DD' basierend auf der lokalen Zeitzone zurück.
 * `toISOString()` liefert UTC – in Deutschland (UTC+1/+2) wäre das einen Tag früher als
 * der angezeigte Kalendertag.
 *
 * @param {Date} d
 * @returns {string}
 */
function toLocalISOString(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Berechnet den Vorschlag für das Go-Live-Datum:
 * Vorletzter Mittwoch im nächsten bevorstehenden Juni oder Dezember.
 *
 * @returns {string} ISO-Datum 'YYYY-MM-DD'
 */
function getDefaultGoLiveDate() {
  const today = new Date();
  const year  = today.getFullYear();
  for (const [y, month] of [[year, 5], [year, 11], [year + 1, 5], [year + 1, 11]]) {
    const lastDay = new Date(y, month + 1, 0);
    let lastWed = new Date(lastDay);
    // Letzten Mittwoch des Monats suchen
    while (lastWed.getDay() !== 3) lastWed.setDate(lastWed.getDate() - 1);
    const candidate = addDays(lastWed, -7); // vorletzter Mittwoch
    if (candidate > today) return toLocalISOString(candidate);
  }
  return '';
}

const DEFAULT_LIVE_DATE = getDefaultGoLiveDate();

// ─── Tab 4: Release – Regelwerk ──────────────────────────────────────────────

const RULE_DOCS = {
  'Kick-off':                       'Auftaktveranstaltung – Startschuss für Planung und Konzepterstellung',
  'Erste Einreichung Fachkonzept':  'Fachkonzepte gehen erstmals in die Review-Phase ein',
  'Letzte Einreichung Fachkonzept': 'Nach diesem Termin werden keine neuen Konzepte mehr angenommen',
  'Letzte Änderungen Fachkonzept':  'Inhaltliche Konzeptänderungen sind danach nicht mehr möglich',
  'Technische Änderungsdoku':       'Technische Änderungsdokumentation muss fertig sein (Montag der Beta-Woche)',
  'Beta-Version':                   'Testversion wird für Beta-Tests freigegeben (Do, 10 Uhr)',
  'Vorbereitung Beta':              'Abschluss aller Vorbereitungsarbeiten vor der Beta-Bereitstellung',
  'Abschluss Programmierung':       'Sämtliche Entwicklungsarbeiten müssen abgeschlossen sein',
  'Test-/Abnahmephase fertig':      'Alle funktionalen Tests und fachlichen Abnahmen sind erfolgreich abgeschlossen – Freigabe für Finalisierung',
  'Finalisierung (Beginn)':         'Start der Finalisierungsphase – letzte Überprüfungen vor Go-Live',
  'Freigabe an IT':                 'Formelle Softwarefreigabe an IT-Betrieb (selber Tag wie Finalisierung)',
  'Vorbereitung Finalisierung':     'Abschluss aller Entwicklungsarbeiten vor der Finalisierungsphase',
  'Go-Live':                  'Deployment auf Produktion – ausschließlich Mittwoch oder Donnerstag',
};

const WEEKDAY_OPTIONS = [
  { label: 'variabel', value: 'any' },
  { label: 'Mo', value: '1' },
  { label: 'Di', value: '2' },
  { label: 'Mi', value: '3' },
  { label: 'Do', value: '4' },
  { label: 'Fr', value: '5' },
];

const PHASE_OPTIONS = [
  { label: 'Planung',       value: 'Planung' },
  { label: 'Entwicklung',   value: 'Entwicklung' },
  { label: 'Beta & Tests',  value: 'Beta & Tests' },
  { label: 'Release-Woche', value: 'Release-Woche' },
];

/**
 * Standardmeilensteine mit Berechnungsregeln relativ zum Go-Live-Datum.
 *
 * Felder:
 *   offset        – Kalendertage relativ zum Go-Live (negativ = davor, 0 = Go-Live-Tag)
 *   adjust        – Wochentag, auf den rückwärts angepasst wird (1 = Mo … 5 = Fr)
 *   dependsOn     – Name eines anderen Meilensteins als Bezugstermin (statt Go-Live)
 *   workdaysBefore – Arbeitstage (Mo–Fr, ohne NRW-Feiertage) rückwärts vom Bezugstermin
 *
 * Meilensteine mit `dependsOn` werden erst nach dem ersten Pass berechnet.
 */
const MILESTONES = [
  { name: 'Kick-off',                       phase: 'Planung',       offset: -98, adjust: 4 },
  { name: 'Erste Einreichung Fachkonzept',  phase: 'Planung',       offset: -89, adjust: 5 },
  { name: 'Letzte Einreichung Fachkonzept', phase: 'Planung',       offset: -75, adjust: 5 },
  { name: 'Letzte Änderungen Fachkonzept',  phase: 'Planung',       offset: -55, adjust: 5 },
  { name: 'Technische Änderungsdoku',       phase: 'Entwicklung',   offset: -51, adjust: 1 },
  { name: 'Beta-Version',                   phase: 'Beta & Tests',  offset: -48, adjust: 4 },
  { name: 'Vorbereitung Beta',              phase: 'Entwicklung',   dependsOn: 'Beta-Version',           workdaysBefore: 1 },
  { name: 'Abschluss Programmierung',       phase: 'Entwicklung',   offset: -19 },
  { name: 'Test-/Abnahmephase fertig',      phase: 'Beta & Tests',  dependsOn: 'Finalisierung (Beginn)', workdaysBefore: 1 },
  { name: 'Finalisierung (Beginn)',         phase: 'Release-Woche', offset:  -8, adjust: 2 },
  { name: 'Freigabe an IT',                 phase: 'Release-Woche', offset:  -8, adjust: 2 },
  { name: 'Vorbereitung Finalisierung',     phase: 'Entwicklung',   dependsOn: 'Finalisierung (Beginn)', workdaysBefore: 3 },
  { name: 'Go-Live',                  phase: 'Release-Woche', offset:   0 },
];

const PHASE_APPEARANCE = {
  'Planung':       'default',
  'Entwicklung':   'inprogress',
  'Beta & Tests':  'new',
  'Release-Woche': 'removed',
};

// Numerische Phase für Chart-y-Achse (1 = früheste Phase, 4 = Release)
const PHASE_ORDER = {
  'Planung':       1,
  'Entwicklung':   2,
  'Beta & Tests':  3,
  'Release-Woche': 4,
};

/**
 * Fachliche Abhängigkeiten (Blocker → Blocked).
 * Werden als Jira-Issuelinks (Typ "Blocks") angelegt und im Chart als
 * horizontale Verbindungslinien bei y = 0.5 dargestellt.
 */
const BLOCKING_DEPS = [
  { blocker: 'Technische Änderungsdoku',   blocked: 'Beta-Version' },
  { blocker: 'Vorbereitung Finalisierung', blocked: 'Finalisierung (Beginn)' },
  { blocker: 'Test-/Abnahmephase fertig',  blocked: 'Finalisierung (Beginn)' },
  { blocker: 'Finalisierung (Beginn)',      blocked: 'Go-Live' },
];


/**
 * Erzeugt den initialen Regelwerk-State aus MILESTONES.
 * Numerische Werte werden als Strings gespeichert, damit Textfelder während der Eingabe
 * keine NaN-Fehler produzieren. `workdaysBefore` wird negiert (Konvention: alle
 * Abstände sind negativ dargestellt, Math.abs() in calculatePlan).
 */
const initRules = () => MILESTONES.map(m => ({
  ...m,
  offsetInput:   m.offset !== undefined ? String(m.offset) : '0',
  workdaysInput: m.workdaysBefore !== undefined ? String(-m.workdaysBefore) : '-1',
  adjustStr:     m.adjust != null ? String(m.adjust) : 'any',
}));

/**
 * Berechnet alle Meilenstein-Daten ausgehend vom Go-Live-Datum.
 *
 * @param {Date}   live  - Mittwoch oder Donnerstag
 * @param {Array}  rules - editierbares Regelwerk (aus initRules)
 * @returns {{ name, phase, date }[]}  sortiert chronologisch
 */
function calculatePlan(live, rules) {
  const dates = new Map();

  for (const m of rules) {
    if (!m.dependsOn) {
      const offset = parseInt(m.offsetInput, 10);
      const adj    = m.adjustStr === 'any' ? null : parseInt(m.adjustStr, 10);
      let d = addDays(live, isNaN(offset) ? 0 : offset);
      if (adj !== null) d = adjustToWeekday(d, adj);
      dates.set(m.name, d);
    }
  }

  for (const m of rules) {
    if (m.dependsOn) {
      const n   = parseInt(m.workdaysInput, 10);
      const adj = m.adjustStr === 'any' ? null : parseInt(m.adjustStr, 10);
      const abs = isNaN(n) || n === 0 ? 1 : Math.abs(n);
      let d = subtractWorkdays(dates.get(m.dependsOn), abs);
      if (adj !== null) d = adjustToWeekday(d, adj);
      dates.set(m.name, d);
    }
  }

  return rules
    .map(m => ({ name: m.name, phase: m.phase, date: dates.get(m.name) }))
    .filter(m => m.date instanceof Date && !isNaN(m.date.getTime()))
    .sort((a, b) => a.date - b.date);
}

// ─── Tab 4: Release ──────────────────────────────────────────────────────────

/**
 * Release-Meilensteinplaner mit editierbarem Regelwerk, LineChart und NRW-Feiertagen.
 *
 * @returns {JSX.Element}
 */
const ReleaseTab = () => {
  const context    = useProductContext();
  const projectKey = context?.extension?.project?.key ?? null;

  const [liveIso,      setLiveIso]      = useState(DEFAULT_LIVE_DATE);
  const [rules,        setRules]        = useState(initRules);
  const [plan,         setPlan]         = useState(null);
  const [error,        setError]        = useState('');
  const [showRules,    setShowRules]    = useState(false);
  const [showRuleDocs, setShowRuleDocs] = useState(false);
  const [epicName,     setEpicName]     = useState(`Release ${DEFAULT_LIVE_DATE}`);
  const [creating,     setCreating]     = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [createError,  setCreateError]  = useState('');
  const [deleting,     setDeleting]     = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  const [deleteError,  setDeleteError]  = useState('');

  const updateRule = (idx, field, value) =>
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const handleAddMilestone = () =>
    setRules(prev => [...prev, {
      _id: Date.now(),
      name: '', phase: 'Planung', description: '',
      offsetInput: '-7', workdaysInput: '-1',
      adjustStr: 'any', dependsOn: undefined,
      userAdded: true,
    }]);

  const handleDeleteMilestone = (idx) =>
    setRules(prev => prev.filter((_, i) => i !== idx));

  const handleCalculate = () => {
    if (!liveIso) { setError('Bitte ein Datum wählen.'); return; }
    const live = parseLocalDate(liveIso);
    if (live.getDay() !== 3 && live.getDay() !== 4) {
      setError('Regelverstoß: Go-Live muss Mittwoch (Mi) oder Donnerstag (Do) sein.');
      setPlan(null);
      return;
    }
    setError('');
    setCreateResult(null);
    setCreateError('');
    setDeleteResult(null);
    setDeleteError('');
    setEpicName(`Release ${liveIso}`);

    setPlan(calculatePlan(live, rules));
  };

  /** Löscht alle Jira-Issues der aktuellen Planung (Label speedy-{liveIso}). */
  const handleDeletePlan = async () => {
    if (!projectKey) return;
    setDeleting(true);
    setDeleteError('');
    setDeleteResult(null);
    setCreateResult(null);
    try {
      const result = await invoke('deleteReleasePlan', { projectKey, liveIso });
      setDeleteResult(result);
    } catch (err) {
      setDeleteError(err.message ?? String(err));
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Legt den berechneten Plan als Jira-Epic mit Kind-Tasks an.
   * Existierende Issues mit demselben Label (speedy-{liveIso}) werden zuvor gelöscht.
   * Tasks erhalten Start- und Fälligkeitsdatum = berechnetes Meilenstein-Datum.
   * Der Epic spannt von Kick-off bis Go-Live.
   */
  /**
   * Delegiert die gesamte Jira-Erstellung an den Backend-Resolver (asUser).
   * Dates werden als ISO-Strings serialisiert, da Date-Objekte über invoke() nicht übertragen werden.
   */
  const handleCreateInJira = async () => {
    if (!plan || !projectKey) return;
    setCreating(true);
    setCreateError('');
    setCreateResult(null);
    try {
      const result = await invoke('createReleasePlan', {
        projectKey,
        epicName:  epicName.trim(),
        liveIso,
        plan:         plan.map(m => ({ name: m.name, phase: m.phase, date: toLocalISOString(m.date) })),
        blockingDeps: BLOCKING_DEPS,
        vacationWarning: betaWeek && finWeek && liveEntry ? {
          betaStart: formatDate(betaWeek.start),
          betaEnd:   formatDate(betaWeek.end),
          finStart:  formatDate(finWeek.start),
          finEnd:    formatDate(finWeek.end),
          liveDate:  formatDate(liveEntry.date),
        } : null,
      });
      setCreateResult(result);
    } catch (err) {
      setCreateError(err.message ?? String(err));
    } finally {
      setCreating(false);
    }
  };

  const liveEntry = plan?.find(m => m.name === 'Go-Live');
  const betaEntry = plan?.find(m => m.name === 'Beta-Version');
  const finEntry  = plan?.find(m => m.name === 'Finalisierung (Beginn)');
  const betaWeek  = betaEntry ? getWeekRange(betaEntry.date) : null;
  const finWeek   = finEntry  ? getWeekRange(finEntry.date)  : null;

  // LineChart als Scatter: colorAccessor="name" → 12 Einzelserien, je 1 Punkt → keine Verbindungslinien.
  // ISO-Datum als x → Victory Charts erkennt temporale Daten und skaliert die x-Achse proportional.
  // Meilensteine: zwei Punkte mit gleichem x (Date) und y ∈ {0, 1} → senkrechte Linie.
  // Abhängigkeiten: zwei Punkte mit unterschiedlichem x bei y = 0.5 → waagerechte Verbindung.
  // Date-Objekte statt ISO-Strings erzwingen eine Zeitskala mit proportionalen Abständen.
  const chartData = plan ? [
    ...plan.flatMap(m => [
      { datum: m.date, y: 0, name: m.name },
      { datum: m.date, y: 1, name: m.name },
    ]),
    ...BLOCKING_DEPS.flatMap((dep, i) => {
      const from = plan.find(m => m.name === dep.blocker);
      const to   = plan.find(m => m.name === dep.blocked);
      if (!from || !to) return [];
      return [
        { datum: from.date, y: 0.5, name: `dep_${i}` },
        { datum: to.date,   y: 0.5, name: `dep_${i}` },
      ];
    }),
  ] : [];

  return (
    <Box padding="space.200">
      <Stack space="space.300">

        {/* Grundregeln (einklappbar) */}
        <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
          <Inline space="space.300" alignBlock="center">
            <Heading size="small">Verbindliche Planungsregeln</Heading>
            <Button appearance="subtle" onClick={() => setShowRules(v => !v)}>
              {showRules ? 'Ausblenden' : 'Anzeigen'}
            </Button>
          </Inline>
          {showRules && (
            <Box padding="space.200">
              <Stack space="space.075">
                <Text>Go-Live ausschließlich Mittwoch oder Donnerstag (kein Freitags-Deployment).</Text>
                <Text>NRW-Feiertage werden bei Arbeitstags-Berechnungen automatisch übersprungen. Grundlage: Bundesrecht, NRW-Landesrecht (SchFG NW) sowie die Gaußsche Osterformel für bewegliche Feste.</Text>
                <Text>Tage (Offset): negative Zahl = Kalendertage VOR dem Go-Live. 0 = Go-Live-Tag selbst.</Text>
                <Text>Werktage: negative Zahl = Arbeitstage (Mo–Fr, ohne NRW-Feiertage) VOR dem jeweiligen Bezugstermin (z. B. -1 vor Beta-Version, -3 vor Finalisierung) – nicht vor dem Go-Live.</Text>
                <Text>Wochentag-Anpassung: Das berechnete Datum wird rückwärts auf den nächsten passenden Wochentag verschoben.</Text>
              </Stack>
            </Box>
          )}
        </Box>

        {/* Editierbares Regelwerk */}
        <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
          <Stack space="space.200">
            <Inline space="space.300" alignBlock="center">
              <Heading size="small">Regelwerk (editierbar)</Heading>
              <Button appearance="subtle" onClick={() => setShowRuleDocs(v => !v)}>
                {showRuleDocs ? 'Erklärung ausblenden' : 'Erklärung anzeigen'}
              </Button>
              <Button appearance="subtle" onClick={() => setRules(initRules())}>
                Standardwerte
              </Button>
            </Inline>
            {showRuleDocs && (
              <SectionMessage appearance="information" title="Erklärung der Felder">
                <Stack space="space.075">
                  <Text>Tage (Offset): negativer Wert = Kalendertage VOR dem Go-Live (z. B. -98 = 98 Tage früher). 0 = Go-Live-Tag.</Text>
                  <Text>Werktage: negativer Wert = Arbeitstage rückwärts vom genannten Bezugstermin (z. B. -1 vor Beta-Version) – nicht vom Go-Live.</Text>
                  <Text>Wochentag: Das berechnete Datum wird rückwärts auf den nächsten passenden Wochentag verschoben.</Text>
                </Stack>
              </SectionMessage>
            )}
            <DynamicTable
              head={{ cells: [
                { key: 'ms',     content: 'Meilenstein',  width: 17 },
                { key: 'desc',   content: 'Bedeutung',    width: 20 },
                { key: 'abs',    content: 'Tage',         width: 9  },
                { key: 'before', content: 'Vor Ereignis', width: 20 },
                { key: 'wt',     content: 'Wochentag',    width: 20 },
                { key: 'del',    content: '',             width: 8  },
              ]}}
              rows={rules
                .map((rule, idx) => ({ rule, idx }))
                .sort((a, b) => {
                  const key = r => {
                    if (r.dependsOn) {
                      const ref = rules.find(x => x.name === r.dependsOn);
                      const refOff = ref ? parseInt(ref.offsetInput, 10) : 0;
                      const wbd    = parseInt(r.workdaysInput, 10);
                      return (isNaN(refOff) ? 0 : refOff) + (isNaN(wbd) ? -1 : wbd);
                    }
                    const off = parseInt(r.offsetInput, 10);
                    return isNaN(off) ? 0 : off;
                  };
                  return key(a.rule) - key(b.rule);
                })
                .map(({ rule, idx }) => {
                  const refOptions = [
                    { label: 'Go-Live', value: '' },
                    ...rules.filter(r => r.name && r.name !== rule.name).map(r => ({ label: r.name, value: r.name })),
                  ];
                  return {
                    key: rule._id ? String(rule._id) : rule.name,
                    cells: [
                      { key: 'ms', content: rule.userAdded ? (
                        <Stack space="space.075">
                          <Textfield
                            placeholder="Name…"
                            value={rule.name}
                            onChange={e => updateRule(idx, 'name', e.target.value)}
                          />
                          <Select
                            options={PHASE_OPTIONS}
                            value={PHASE_OPTIONS.find(o => o.value === rule.phase) || PHASE_OPTIONS[0]}
                            onChange={opt => updateRule(idx, 'phase', opt?.value ?? 'Planung')}
                          />
                        </Stack>
                      ) : (
                        <Stack space="space.050">
                          <Text>{rule.name}</Text>
                          <Lozenge appearance={PHASE_APPEARANCE[rule.phase] || 'default'}>
                            {rule.phase}
                          </Lozenge>
                        </Stack>
                      )},
                      { key: 'desc', content: rule.userAdded ? (
                      <Textfield
                        placeholder="Bedeutung…"
                        value={rule.description ?? ''}
                        onChange={e => updateRule(idx, 'description', e.target.value)}
                      />
                    ) : (
                      RULE_DOCS[rule.name] || ''
                    )},
                      { key: 'abs', content: rule.dependsOn ? (
                        <Textfield
                          value={rule.workdaysInput}
                          onChange={e => updateRule(idx, 'workdaysInput', e.target.value)}
                        />
                      ) : (
                        <Textfield
                          value={rule.offsetInput}
                          onChange={e => updateRule(idx, 'offsetInput', e.target.value)}
                        />
                      )},
                      { key: 'before', content: rule.userAdded ? (
                        <Select
                          options={refOptions}
                          value={refOptions.find(o => o.value === (rule.dependsOn ?? '')) || refOptions[0]}
                          onChange={opt => updateRule(idx, 'dependsOn', opt?.value || undefined)}
                        />
                      ) : (
                        <Text>{rule.dependsOn ?? 'Go-Live'}</Text>
                      )},
                      { key: 'wt', content: (
                        <Select
                          options={WEEKDAY_OPTIONS}
                          value={WEEKDAY_OPTIONS.find(o => o.value === rule.adjustStr) || WEEKDAY_OPTIONS[0]}
                          onChange={opt => updateRule(idx, 'adjustStr', opt?.value ?? 'any')}
                        />
                      )},
                      { key: 'del', content: rule.userAdded ? (
                        <Button appearance="subtle" onClick={() => handleDeleteMilestone(idx)}>
                          Entfernen
                        </Button>
                      ) : <Text> </Text> },
                    ],
                  };
                })
              }
            />
            <Button appearance="subtle" onClick={handleAddMilestone}>
              + Meilenstein hinzufügen
            </Button>
          </Stack>
        </Box>

        {/* Datepicker + Berechnen */}
        <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
          <Stack space="space.200">
            <DatePicker
              name="liveDate"
              label="Go-Live wählen (Mi / Do)"
              defaultValue={DEFAULT_LIVE_DATE}
              onChange={val => { setLiveIso(val); setPlan(null); setError(''); }}
            />
            {error && (
              <SectionMessage appearance="error" title="Ungültiges Datum">
                <Text>{error}</Text>
              </SectionMessage>
            )}
            <Inline space="space.100" alignInline="start">
              <Button appearance="primary" onClick={handleCalculate} isDisabled={!liveIso}>
                Plan berechnen
              </Button>
              {plan && (
                <Button appearance="subtle" onClick={() => { setPlan(null); setLiveIso(''); setError(''); }}>
                  Zurücksetzen
                </Button>
              )}
            </Inline>
          </Stack>
        </Box>

        {/* Ergebnisse */}
        {plan && !liveEntry && (
          <SectionMessage appearance="warning" title="Go-Live-Meilenstein fehlt">
            <Text>Der Meilenstein "Go-Live" wurde aus dem Regelwerk entfernt. Klicke auf "Standardwerte", um ihn wiederherzustellen.</Text>
          </SectionMessage>
        )}
        {plan && liveEntry && (
          <Stack space="space.300">

            {/* Go-Live Header */}
            <Box backgroundColor="color.background.accent.purple.subtlest" padding="space.400" xcss={roundedXcss}>
              <Inline space="space.200" alignBlock="center">
                <Heading size="medium">Go-Live</Heading>
                <Badge appearance="primary">{formatDate(liveEntry.date)}</Badge>
              </Inline>
            </Box>

            {/* LineChart – Countdown je Meilenstein */}
            <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
              <LineChart
                data={chartData}
                xAccessor="datum"
                yAccessor="y"
                colorAccessor="name"
                title="Meilenstein-Timeline"
                height={260}
              />
            </Box>

            {/* Meilenstein-Tabelle */}
            <Box backgroundColor="elevation.surface.raised" padding="space.300" xcss={cardXcss}>
              <Stack space="space.200">
                <Heading size="small">Meilensteine (chronologisch)</Heading>
                <DynamicTable
                  head={{ cells: [
                    { key: 'ms',    content: 'Meilenstein', width: 42 },
                    { key: 'datum', content: 'Datum',       width: 32 },
                    { key: 'phase', content: 'Phase' },
                  ]}}
                  rows={plan.map(m => {
                    const holiday = getHolidayName(m.date);
                    return {
                      key: m.name,
                      cells: [
                        { key: 'ms',    content: m.name },
                        { key: 'datum', content: holiday
                          ? `${formatDate(m.date)} 🎉 ${holiday}`
                          : formatDate(m.date)
                        },
                        { key: 'phase', content: (
                          <Lozenge appearance={PHASE_APPEARANCE[m.phase] || 'default'}>
                            {m.phase}
                          </Lozenge>
                        )},
                      ],
                    };
                  })}
                />
              </Stack>
            </Box>

            {/* Urlaubssperren */}
            {betaWeek && finWeek && (
              <SectionMessage appearance="warning" title="Keine Urlaubsplanung in kritischen Phasen">
                <Stack space="space.100">
                  <Text>Beta-Woche: {formatDate(betaWeek.start)} – {formatDate(betaWeek.end)}</Text>
                  <Text>Finalisierungs-Woche: {formatDate(finWeek.start)} – {formatDate(finWeek.end)}</Text>
                  <Text>Tag des Go-Live: {formatDate(liveEntry.date)}</Text>
                </Stack>
              </SectionMessage>
            )}

            {/* Jira-Export */}
            <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
              <Stack space="space.200">
                <Heading size="small">Als Jira-Roadmap anlegen</Heading>
                <SectionMessage appearance="information" title="Was wird angelegt?">
                  <Stack space="space.075">
                    <Text>1 Epic ({epicName || '…'}) mit Start = Kick-off, Fälligkeit = Go-Live.</Text>
                    <Text>{plan.length} Tasks (je ein Meilenstein) als Kind-Issues des Epics, mit Start- und Fälligkeitsdatum.</Text>
                    <Text>Label: speedy-{liveIso} · release-plan. Bereits vorhandene Issues mit diesem Label werden überschrieben.</Text>
                  </Stack>
                </SectionMessage>
                <Inline space="space.200" alignBlock="start">
                  <Stack space="space.100">
                    <Label labelFor="epic-name">Epic-Name</Label>
                    <Textfield
                      id="epic-name"
                      value={epicName}
                      onChange={e => setEpicName(e.target.value)}
                    />
                  </Stack>
                </Inline>
                {createError && (
                  <SectionMessage appearance="error" title="Fehler beim Anlegen">
                    <Text>{createError}</Text>
                  </SectionMessage>
                )}
                {createResult && (
                  <Stack space="space.200">
                    <SectionMessage appearance="success" title="Erfolgreich terminiert">
                      <Stack space="space.075">
                        <Text>Epic <Link href={createResult.epicUrl} openNewWindow>{createResult.epicKey}</Link> mit {createResult.tasks.length} Tasks angelegt.</Text>
                        {createResult.quickFilterName
                          ? <Text>Board-Schnellfilter "{createResult.quickFilterName}" angelegt.</Text>
                          : <Text>Hinweis: Board-Schnellfilter konnte nicht angelegt werden (kein Board gefunden oder fehlende Berechtigung).</Text>
                        }
                      </Stack>
                    </SectionMessage>
                    <DynamicTable
                      head={{ cells: [
                        { key: 'key',   content: 'Ticket',     width: 18 },
                        { key: 'name',  content: 'Meilenstein' },
                        { key: 'date',  content: 'Datum',      width: 28 },
                        { key: 'phase', content: 'Phase',      width: 22 },
                      ]}}
                      rows={[
                        {
                          key: createResult.epicKey,
                          cells: [
                            { key: 'key',   content: <Link href={createResult.epicUrl} openNewWindow><Badge appearance="primary">{createResult.epicKey}</Badge></Link> },
                            { key: 'name',  content: <Text>{epicName}</Text> },
                            { key: 'date',  content: <Text>–</Text> },
                            { key: 'phase', content: <Lozenge appearance="default">Epic</Lozenge> },
                          ],
                        },
                        ...createResult.tasks.map(t => ({
                          key: t.key,
                          cells: [
                            { key: 'key',   content: <Link href={t.url} openNewWindow><Badge>{t.key}</Badge></Link> },
                            { key: 'name',  content: <Text>{t.name}</Text> },
                            { key: 'date',  content: <Text>{t.date}</Text> },
                            { key: 'phase', content: <Lozenge appearance={PHASE_APPEARANCE[t.phase] || 'default'}>{t.phase}</Lozenge> },
                          ],
                        })),
                      ]}
                    />
                  </Stack>
                )}
                {deleteResult && (
                  <SectionMessage appearance="success" title="Planung entfernt">
                    <Text>{deleteResult.count} Issue(s) mit Label speedy-{liveIso} wurden gelöscht.</Text>
                  </SectionMessage>
                )}
                {deleteError && (
                  <SectionMessage appearance="error" title="Fehler beim Löschen">
                    <Text>{deleteError}</Text>
                  </SectionMessage>
                )}
                {!projectKey && (
                  <SectionMessage appearance="warning" title="Kein Projektkontext">
                    <Text>Die App wurde außerhalb einer Projektseite geöffnet. Bitte öffne sie über ein Jira-Projekt.</Text>
                  </SectionMessage>
                )}
                <Inline space="space.100" alignBlock="center">
                  <Button
                    appearance="primary"
                    onClick={handleCreateInJira}
                    isDisabled={creating || deleting || !epicName.trim() || !projectKey}
                  >
                    {creating ? 'Wird terminiert…' : 'Neu terminieren'}
                  </Button>
                  <Button
                    appearance="danger"
                    onClick={handleDeletePlan}
                    isDisabled={creating || deleting || !projectKey}
                  >
                    {deleting ? 'Wird entfernt…' : 'Planung entfernen'}
                  </Button>
                  {(creating || deleting) && <Spinner size="medium" label="Bitte warten…" />}
                </Inline>
              </Stack>
            </Box>

          </Stack>
        )}

      </Stack>
    </Box>
  );
};

// ─── App-Root ────────────────────────────────────────────────────────────────

/**
 * Einstiegspunkt: Tab-Navigation mit Benutzer, Projekt, Anforderung und Release.
 *
 * @returns {JSX.Element}
 */
const App = () => (
  <Tabs id="speedy-tabs">
    <TabList>
      <Tab>Benutzer</Tab>
      <Tab>Projekt</Tab>
      <Tab>Release</Tab>
      <Tab>Anforderung</Tab>
    </TabList>
    <TabPanel><UserTab /></TabPanel>
    <TabPanel><ProjectTab /></TabPanel>
    <TabPanel><ReleaseTab /></TabPanel>
    <TabPanel><AnforderungTab /></TabPanel>
  </Tabs>
);

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
