import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, DynamicTable,
  Tabs, Tab, TabList, TabPanel,
  Select, TextArea, Textfield,
  Stack, Inline, Box,
  Badge, Lozenge, Tag, TagGroup,
  User, SectionMessage,
  Spinner, Button, Label,
  DatePicker, LineChart,
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

  useEffect(() => {
    invoke('getCurrentUser')
      .then(setUser)
      .catch(err => setError(err.message));
  }, []);

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
        .catch(err => setError(err.message));
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
      .catch(err => setError(err.message));
  }, [selectedKey]);

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
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
              placeholder="Detaillierte Beschreibung, Akzeptanzkriterien, Abhängigkeiten…"
              resize="vertical"
            />
          </Stack>

          {saved && (
            <SectionMessage appearance="success" title="Gespeichert">
              <Text>Die Anforderung wurde erfolgreich gespeichert.</Text>
            </SectionMessage>
          )}

          <Inline space="space.100" alignInline="end">
            <Button appearance="subtle" onClick={() => { setTitel(''); setText(''); setSaved(false); }}>
              Zurücksetzen
            </Button>
            <Button appearance="primary" onClick={handleSave} isDisabled={!titel.trim()}>
              Speichern
            </Button>
          </Inline>

        </Stack>
      </Box>
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
  'Finalisierung (Beginn)':         'Start der Finalisierungsphase – letzte Überprüfungen vor Go-Live',
  'Freigabe an IT':                 'Formelle Softwarefreigabe an IT-Betrieb (selber Tag wie Finalisierung)',
  'Vorbereitung Finalisierung':     'Abschluss aller Entwicklungsarbeiten vor der Finalisierungsphase',
  'Liveschaltung':                  'Deployment auf Produktion – ausschließlich Mittwoch oder Donnerstag',
};

const WEEKDAY_OPTIONS = [
  { label: 'variabel', value: 'any' },
  { label: 'Mo', value: '1' },
  { label: 'Di', value: '2' },
  { label: 'Mi', value: '3' },
  { label: 'Do', value: '4' },
  { label: 'Fr', value: '5' },
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
  { name: 'Finalisierung (Beginn)',         phase: 'Release-Woche', offset:  -8, adjust: 2 },
  { name: 'Freigabe an IT',                 phase: 'Release-Woche', offset:  -8, adjust: 2 },
  { name: 'Vorbereitung Finalisierung',     phase: 'Entwicklung',   dependsOn: 'Finalisierung (Beginn)', workdaysBefore: 3 },
  { name: 'Liveschaltung',                  phase: 'Release-Woche', offset:   0 },
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
    .sort((a, b) => a.date - b.date);
}

// ─── Tab 4: Release ──────────────────────────────────────────────────────────

/**
 * Release-Meilensteinplaner mit editierbarem Regelwerk, LineChart und NRW-Feiertagen.
 *
 * @returns {JSX.Element}
 */
const ReleaseTab = () => {
  const [liveIso,    setLiveIso]    = useState(DEFAULT_LIVE_DATE);
  const [rules,      setRules]      = useState(initRules);
  const [plan,       setPlan]       = useState(null);
  const [error,      setError]      = useState('');
  const [showRules,  setShowRules]  = useState(false);

  const updateRule = (idx, field, value) =>
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const handleCalculate = () => {
    if (!liveIso) { setError('Bitte ein Datum wählen.'); return; }
    const live = parseLocalDate(liveIso);
    if (live.getDay() !== 3 && live.getDay() !== 4) {
      setError('Regelverstoß: Liveschaltung muss Mittwoch (Mi) oder Donnerstag (Do) sein.');
      setPlan(null);
      return;
    }
    setError('');
    setPlan(calculatePlan(live, rules));
  };

  const liveEntry = plan?.find(m => m.name === 'Liveschaltung');
  const betaEntry = plan?.find(m => m.name === 'Beta-Version');
  const finEntry  = plan?.find(m => m.name === 'Finalisierung (Beginn)');
  const betaWeek  = betaEntry ? getWeekRange(betaEntry.date) : null;
  const finWeek   = finEntry  ? getWeekRange(finEntry.date)  : null;

  // LineChart als Scatter: colorAccessor="name" → 12 Einzelserien, je 1 Punkt → keine Verbindungslinien.
  // ISO-Datum als x → Victory Charts erkennt temporale Daten und skaliert die x-Achse proportional.
  // Jeder Meilenstein = zwei Punkte mit gleichem x (Date) und y ∈ {0, 1}.
  // colorAccessor="name" legt je Meilenstein eine eigene Serie an (12 Serien).
  // Gleiche x-Koordinate, unterschiedliche y → Victory Charts zeichnet eine senkrechte Linie.
  // Date-Objekte statt ISO-Strings erzwingen eine Zeitskala mit proportionalen Abständen.
  const chartData = plan ? plan.flatMap(m => [
    { datum: m.date, y: 0, name: m.name },
    { datum: m.date, y: 1, name: m.name },
  ]) : [];

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
                <Text>Liveschaltung ausschließlich Mittwoch oder Donnerstag (kein Freitags-Deployment).</Text>
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
              <Button appearance="subtle" onClick={() => setRules(initRules())}>
                Standardwerte
              </Button>
            </Inline>
            <SectionMessage appearance="information" title="Erklärung der Felder">
              <Stack space="space.075">
                <Text>Tage (Offset): negativer Wert = Kalendertage VOR dem Go-Live (z. B. -98 = 98 Tage früher). 0 = Go-Live-Tag.</Text>
                <Text>Werktage: negativer Wert = Arbeitstage rückwärts vom genannten Bezugstermin (z. B. -1 vor Beta-Version) – nicht vom Go-Live.</Text>
                <Text>Wochentag: Das berechnete Datum wird rückwärts auf den nächsten passenden Wochentag verschoben.</Text>
              </Stack>
            </SectionMessage>
            <DynamicTable
              head={{ cells: [
                { key: 'ms',   content: 'Meilenstein',            width: 20 },
                { key: 'desc', content: 'Bedeutung',              width: 30 },
                { key: 'abs',  content: 'Wert',                   width: 26 },
                { key: 'wt',   content: 'Wochentag',              width: 24 },
              ]}}
              rows={rules.map((rule, idx) => ({
                key: rule.name,
                cells: [
                  { key: 'ms', content: (
                    <Stack space="space.050">
                      <Text>{rule.name}</Text>
                      <Lozenge appearance={PHASE_APPEARANCE[rule.phase] || 'default'}>
                        {rule.phase}
                      </Lozenge>
                    </Stack>
                  )},
                  { key: 'desc', content: RULE_DOCS[rule.name] || '' },
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
                  { key: 'wt', content: (
                    <Select
                      options={WEEKDAY_OPTIONS}
                      value={WEEKDAY_OPTIONS.find(o => o.value === rule.adjustStr) || WEEKDAY_OPTIONS[0]}
                      onChange={opt => updateRule(idx, 'adjustStr', opt?.value ?? 'any')}
                    />
                  )},
                ],
              }))}
            />
          </Stack>
        </Box>

        {/* Datepicker + Berechnen */}
        <Box backgroundColor="elevation.surface.raised" padding="space.400" xcss={cardXcss}>
          <Stack space="space.200">
            <DatePicker
              name="liveDate"
              label="Liveschaltung wählen (Mi / Do)"
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
        {plan && (
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
            <SectionMessage appearance="warning" title="Keine Urlaubsplanung in kritischen Phasen">
              <Stack space="space.100">
                <Text>Beta-Woche: {formatDate(betaWeek.start)} – {formatDate(betaWeek.end)}</Text>
                <Text>Finalisierungs-Woche: {formatDate(finWeek.start)} – {formatDate(finWeek.end)}</Text>
                <Text>Tag der Liveschaltung: {formatDate(liveEntry.date)}</Text>
              </Stack>
            </SectionMessage>

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
      <Tab>Anforderung</Tab>
      <Tab>Release</Tab>
    </TabList>
    <TabPanel><UserTab /></TabPanel>
    <TabPanel><ProjectTab /></TabPanel>
    <TabPanel><AnforderungTab /></TabPanel>
    <TabPanel><ReleaseTab /></TabPanel>
  </Tabs>
);

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
