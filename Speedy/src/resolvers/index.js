import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

async function getSiteBase(context) {
  const raw = context?.localBaseUrl;
  if (raw) {
    try { return new URL(raw).origin; } catch { /* fall through */ }
  }
  const res  = await api.asUser().requestJira(route`/rest/api/3/serverInfo`, { headers: { Accept: 'application/json' } });
  const info = await res.json();
  return info.baseUrl ? new URL(info.baseUrl).origin : '';
}

/**
 * Gibt die ID des ersten Boards zurück, das dem Projekt zugeordnet ist.
 * Liefert `null` wenn kein Board gefunden oder der Aufruf fehlschlägt.
 *
 * @param {string} projectKey
 * @returns {Promise<number|null>}
 */
async function findBoardId(projectKey) {
  try {
    const res = await api.asUser().requestJira(
      route`/rest/agile/1.0/board?projectKeyOrId=${projectKey}&maxResults=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.values?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Sucht Issues per JQL via POST /rest/api/3/search/jql (das seit Jira Cloud 2024/2025
 * vorgeschriebene Nachfolger-Endpoint; GET /rest/api/3/search → HTTP 410 Gone).
 *
 * @param {string}   jql
 * @param {string[]} fields
 * @returns {Promise<object[]>} issues-Array
 */
async function searchIssues(jql, fields = ['id', 'issuetype']) {
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({ jql, fields, maxResults: 50 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Suche fehlgeschlagen: HTTP ${res.status} – ${body}`);
  }
  const data = await res.json();
  return data.issues ?? [];
}

/**
 * Liefert die Profildaten des aktuell eingeloggten Nutzers.
 *
 * @returns {Promise<object>} Jira-Benutzerprofil
 */
resolver.define('getCurrentUser', async (req) => {
  console.log('[Speedy] getCurrentUser, accountId:', req.context?.accountId);

  const res = await api.asUser().requestJira(route`/rest/api/3/myself`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Speedy] /myself fehlgeschlagen: HTTP ${res.status}`, body);
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  console.log('[Speedy] Benutzerdaten geladen:', data.displayName, data.accountType);
  return data;
});

resolver.define('getMyIssues', async (req) => {
  const JQL    = '(assignee = currentUser() OR reporter = currentUser() OR creator = currentUser()) AND statusCategory != Done ORDER BY priority ASC, updated DESC';
  const FIELDS = ['summary', 'status', 'priority', 'issuetype', 'updated', 'project', 'assignee'];
  const PAGE   = 100;
  const LIMIT  = 500;

  let allIssues     = [];
  let nextPageToken = undefined;

  do {
    const payload = { jql: JQL, fields: FIELDS, maxResults: PAGE };
    if (nextPageToken) payload.nextPageToken = nextPageToken;

    const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Issues konnten nicht geladen werden: HTTP ${res.status} – ${text}`);
    }
    const data    = await res.json();
    const page    = data.issues ?? [];
    allIssues     = allIssues.concat(page);
    nextPageToken = data.nextPageToken;
    if (page.length < PAGE || !nextPageToken) break;
  } while (allIssues.length < LIMIT);

  console.log(`[Speedy] getMyIssues: ${allIssues.length} geladen`);
  const siteBase = await getSiteBase(req.context);
  return allIssues.map(issue => ({
    key:            issue.key,
    url:            `${siteBase}/browse/${issue.key}`,
    summary:        issue.fields.summary,
    status:         issue.fields.status?.name               ?? '–',
    statusCategory: issue.fields.status?.statusCategory?.key ?? '',
    priority:       issue.fields.priority?.name             ?? '–',
    type:           issue.fields.issuetype?.name            ?? '–',
    project:        issue.fields.project?.key               ?? '–',
    updated:        issue.fields.updated                    ?? null,
    isAssigned:     issue.fields.assignee?.accountId === req.context.accountId,
  }));
});

function adfToText(node, max = 320) {
  const walk = (n) => {
    if (!n) return '';
    if (n.type === 'text')     return n.text ?? '';
    if (n.type === 'hardBreak') return ' ';
    if (n.type === 'mention')  return n.attrs?.text ? `@${n.attrs.text}` : '';
    return (n.content ?? []).map(walk).join('');
  };
  const text = walk(node).replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

resolver.define('getProjectActivity', async (req) => {
  const { projectKey } = req.payload;
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const searchRes = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({
      jql:        `project = "${projectKey}" AND updated >= "${todayStr}" ORDER BY key ASC`,
      fields:     ['summary', 'issuetype'],
      maxResults: 100,
    }),
  });
  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(`Suche fehlgeschlagen: HTTP ${searchRes.status} – ${text}`);
  }
  const issues = (await searchRes.json()).issues ?? [];
  console.log(`[Speedy] getProjectActivity: ${issues.length} Issues heute in ${projectKey}`);
  if (issues.length === 0) return [];

  const siteBase = await getSiteBase(req.context);

  // Changelog + Kommentare parallel laden
  const settled = await Promise.allSettled(
    issues.map(issue =>
      api.asUser().requestJira(
        route`/rest/api/3/issue/${issue.key}?expand=changelog&fields=summary,issuetype,created,reporter,comment,description`,
        { headers: { Accept: 'application/json' } }
      ).then(r => r.json())
    )
  );

  const result = [];

  for (let i = 0; i < issues.length; i++) {
    if (settled[i].status !== 'fulfilled') continue;
    const detail     = settled[i].value;
    const issue      = issues[i];
    const activities = [];

    // Issue heute angelegt?
    const created = detail.fields?.created ?? '';
    if (created.startsWith(todayStr)) {
      activities.push({
        description: 'Issue angelegt',
        author:      detail.fields.reporter?.displayName ?? '–',
        authorId:    detail.fields.reporter?.accountId   ?? null,
        time:        created,
      });
    }

    // Changelog-Einträge von heute
    for (const h of detail.changelog?.histories ?? []) {
      if (!h.created?.startsWith(todayStr)) continue;
      const author   = h.author?.displayName ?? '–';
      const authorId = h.author?.accountId   ?? null;
      const time     = h.created;
      for (const item of h.items ?? []) {
        let desc;
        switch (item.field) {
          case 'status':      desc = `Status: ${item.fromString} → ${item.toString}`;          break;
          case 'priority':    desc = `Priorität: ${item.fromString} → ${item.toString}`;       break;
          case 'assignee':    desc = item.toString ? `Zugewiesen an ${item.toString}` : 'Zuweisung entfernt'; break;
          case 'resolution':  desc = item.toString ? `Geschlossen (${item.toString})` : 'Wieder geöffnet';   break;
          case 'summary':     desc = 'Titel geändert';       break;
          case 'description': desc = 'Beschreibung geändert'; break;
          case 'comment':     continue; // wird über comment.comments erfasst
          default:            desc = `${item.field} geändert`;
        }
        const text = item.field === 'description'
          ? adfToText(detail.fields?.description)
          : undefined;
        activities.push({ description: desc, author, authorId, time, text });
      }
    }

    // Kommentare von heute
    for (const c of detail.fields?.comment?.comments ?? []) {
      const isNew = c.created?.startsWith(todayStr);
      const isEdit = !isNew && c.updated?.startsWith(todayStr);
      if (!isNew && !isEdit) continue;
      activities.push({
        description: isNew ? 'Kommentar hinzugefügt' : 'Kommentar bearbeitet',
        author:      (isNew ? c.author : c.updateAuthor)?.displayName ?? '–',
        authorId:    (isNew ? c.author : c.updateAuthor)?.accountId   ?? null,
        time:        isNew ? c.created : c.updated,
        text:        adfToText(c.body),
      });
    }

    if (activities.length === 0) continue;
    activities.sort((a, b) => a.time.localeCompare(b.time));
    result.push({
      key:     issue.key,
      url:     `${siteBase}/browse/${issue.key}`,
      summary: detail.fields?.summary ?? issue.fields.summary,
      type:    detail.fields?.issuetype?.name ?? '–',
      activities,
    });
  }

  return result;
});

/**
 * Konvertiert Plain-Text (mit Zeilenumbrüchen) in ein ADF-Dokument.
 *
 * @param {string} text
 * @returns {object|undefined}
 */
function buildPlainTextADF(text) {
  if (!text) return undefined;
  const blocks = text.split(/\n\n+/);
  return {
    type: 'doc', version: 1,
    content: blocks.map(block => {
      const lines = block.split('\n');
      const inline = [];
      lines.forEach((line, i) => {
        inline.push({ type: 'text', text: line });
        if (i < lines.length - 1) inline.push({ type: 'hardBreak' });
      });
      return { type: 'paragraph', content: inline };
    }),
  };
}

/**
 * ADF-Beschreibung für eine Sub-task, die Eigenständigkeit und Unabhängigkeit betont.
 *
 * @param {string} areaLabel  - z. B. "VBON"
 * @param {string} storyTitle - Titel der übergeordneten Story
 * @returns {object}
 */
function buildSubtaskDescription(areaLabel, storyTitle) {
  const item = text => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  return {
    type: 'doc', version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: `Bereich: ${areaLabel}  |  Story: „${storyTitle}"`, marks: [{ type: 'strong' }] }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Diese Sub-task ist Teil einer aufgeteilten Story und wird eigenständig bearbeitet:' }],
      },
      {
        type: 'bulletList',
        content: [
          item('Kann unabhängig und zeitversetzt von den anderen Sub-tasks bearbeitet werden.'),
          item('Wird typischerweise von einer anderen Person bearbeitet als die übrigen Sub-tasks.'),
          item('Besitzt einen eigenen, unabhängigen Status.'),
        ],
      },
    ],
  };
}

/**
 * Gibt die Issue-Typ-ID für den bevorzugten Namen zurück (Fallback auf ersten nicht-Epic-
 * und nicht-Subtask-Typ). Notwendig, da in manchen Projekten "Story" nicht konfiguriert ist.
 *
 * @param {string} projectKey
 * @param {string} preferred  - bevorzugter Typname, z. B. 'Story'
 * @param {string} fallback   - Fallback-Typname, z. B. 'Task'
 * @returns {Promise<{ id: string }|{ name: string }>}
 */
async function resolveIssueType(projectKey, preferred, fallback) {
  const res = await api.asUser().requestJira(
    route`/rest/api/3/project/${projectKey}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return { name: fallback };
  const data  = await res.json();
  const types = (data.issueTypes ?? []).filter(t => !t.subtask);
  const find  = name => types.find(t => t.name.toLowerCase() === name.toLowerCase());
  const match = find(preferred) ?? find(fallback) ?? types.find(t => t.name !== 'Epic');
  return match ? { id: match.id } : { name: fallback };
}

/**
 * Ermittelt den Subtask-Issue-Typ über das `subtask: true`-Flag.
 * Primär: Projektebene. Fallback: globale Typliste.
 *
 * @param {string} projectKey
 * @returns {Promise<{ id: string }|{ name: string }>}
 */
async function resolveSubtaskType(projectKey) {
  const projectRes = await api.asUser().requestJira(
    route`/rest/api/3/project/${projectKey}`,
    { headers: { Accept: 'application/json' } }
  );
  if (projectRes.ok) {
    const data = await projectRes.json();
    const sub  = (data.issueTypes ?? []).find(t => t.subtask === true);
    if (sub) return { id: sub.id };
  }
  const globalRes = await api.asUser().requestJira(
    route`/rest/api/3/issuetype`,
    { headers: { Accept: 'application/json' } }
  );
  if (globalRes.ok) {
    const types = await globalRes.json();
    const sub   = types.find(t => t.subtask === true);
    if (sub) return { id: sub.id };
  }
  return { name: 'Subtask' };
}

/**
 * Legt eine Story (Kind-Issue des Epics) mit optionalen Sub-tasks an.
 *
 * @param {string}   req.payload.projectKey
 * @param {string}   req.payload.epicKey
 * @param {string}   req.payload.storyTitle
 * @param {string}   req.payload.storyDesc
 * @param {{ key, label, title }[]} req.payload.areas
 * @returns {{ storyKey, storyUrl, subtasks: { key, label, title, url }[] }}
 */
resolver.define('createRequirement', async (req) => {
  const { projectKey, epicKey, storyTitle, storyDesc, areas } = req.payload;
  console.log('[Speedy] createRequirement:', projectKey, epicKey, storyTitle, areas.length, 'Bereiche');

  const [storyType, subtaskType] = await Promise.all([
    resolveIssueType(projectKey, 'Story', 'Task'),
    resolveSubtaskType(projectKey),
  ]);
  console.log('[Speedy] Issue-Typen:', JSON.stringify(storyType), JSON.stringify(subtaskType));

  const storyRes  = await api.asUser().requestJira(route`/rest/api/3/issue`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({ fields: {
      project:     { key: projectKey },
      summary:     storyTitle,
      issuetype:   storyType,
      parent:      { key: epicKey },
      description: buildPlainTextADF(storyDesc),
    }}),
  });
  const storyData = await storyRes.json();
  if (!storyRes.ok) {
    const msg = storyData.errors ? Object.values(storyData.errors).join(', ') : String(storyRes.status);
    console.error('[Speedy] Story-Fehler:', msg);
    throw new Error(`Story: ${msg}`);
  }
  console.log('[Speedy] Story angelegt:', storyData.key);

  const createdSubtasks = [];
  for (const area of areas) {
    const subRes  = await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ fields: {
        project:     { key: projectKey },
        summary:     area.title,
        issuetype:   subtaskType,
        parent:      { key: storyData.key },
        description: area.desc
          ? buildPlainTextADF(area.desc)
          : buildSubtaskDescription(area.label, storyTitle),
      }}),
    });
    const subData = await subRes.json();
    if (!subRes.ok) {
      const msg = subData.errors ? Object.values(subData.errors).join(', ') : String(subRes.status);
      console.error('[Speedy] Sub-task-Fehler:', area.label, msg);
      throw new Error(`Sub-task "${area.label}": ${msg}`);
    }
    console.log('[Speedy] Sub-task angelegt:', subData.key, area.label);
    createdSubtasks.push({ key: subData.key, label: area.label, title: area.title });
  }

  const siteBase = await getSiteBase(req.context);
  return {
    storyKey: storyData.key,
    storyUrl: `${siteBase}/browse/${storyData.key}`,
    subtasks: createdSubtasks.map(t => ({ ...t, url: `${siteBase}/browse/${t.key}` })),
  };
});

/**
 * Erzeugt eine Atlassian Document Format (ADF) Beschreibung für das Epic.
 * Enthält die Urlaubssperr-Zeiträume aus der Planungswarnung.
 *
 * @param {{ betaStart, betaEnd, finStart, finEnd, liveDate }} vw
 * @returns {object} ADF-Dokument
 */
function buildEpicDescription(vw) {
  const item = text => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  return {
    type: 'doc', version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '⛔ Urlaubsplanung: Kritische Phasen', marks: [{ type: 'strong' }] }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'In den folgenden Zeiträumen sollte wegen kritischer Release-Phasen kein Urlaub geplant werden:' }],
      },
      {
        type: 'bulletList',
        content: [
          item(`Beta-Woche: ${vw.betaStart} bis ${vw.betaEnd}`),
          item(`Finalisierungs-Woche: ${vw.finStart} bis ${vw.finEnd}`),
          item(`Tag der Liveschaltung: ${vw.liveDate}`),
        ],
      },
    ],
  };
}

/**
 * Legt den berechneten Release-Plan als Jira-Epic mit Kind-Tasks an und erstellt
 * einen gespeicherten JQL-Filter (Ersatz für Board-Schnellfilter, da die Jira REST API
 * keine öffentliche Endpoint zum Erstellen von Schnellfiltern bietet).
 *
 * Ablauf:
 *   1. Bestehende Issues mit Label `speedy-{liveIso}` löschen.
 *   2. Epic anlegen (duedate = Go-Live, description = Urlaubswarnung).
 *   3. Tasks sequenziell als Kind-Issues anlegen.
 *   4. Gespeicherten JQL-Filter anlegen (oder bei Fehler ignorieren).
 *
 * @param {string}  req.payload.projectKey
 * @param {string}  req.payload.epicName
 * @param {string}  req.payload.liveIso           - 'YYYY-MM-DD'
 * @param {Array}   req.payload.plan              - [{ name, phase, date }]
 * @param {object}  req.payload.vacationWarning   - { betaStart, betaEnd, finStart, finEnd, liveDate }
 * @returns {{ epicKey, epicUrl, tasks, filterName?, filterId? }}
 */
resolver.define('createReleasePlan', async (req) => {
  const { projectKey, epicName, liveIso, plan, vacationWarning, blockingDeps = [] } = req.payload;
  console.log('[Speedy] createReleasePlan:', projectKey, epicName, liveIso, `${plan.length} Meilensteine`);

  const label = `speedy-${liveIso}`;

  // Bestehende Issues löschen (Tasks vor Epic wegen Jira-Hierarchie).
  const existing = await searchIssues(`project = "${projectKey}" AND labels = "${label}"`);
  const ordered  = [
    ...existing.filter(i => i.fields.issuetype.name !== 'Epic'),
    ...existing.filter(i => i.fields.issuetype.name === 'Epic'),
  ];
  for (const iss of ordered) {
    await api.asUser().requestJira(route`/rest/api/3/issue/${iss.id}`, { method: 'DELETE' });
    console.log('[Speedy] gelöscht:', iss.id);
  }

  // Epic anlegen (color darf beim Create nicht gesetzt werden → separater PUT).
  const epicRes  = await api.asUser().requestJira(route`/rest/api/3/issue`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({ fields: {
      project:     { key: projectKey },
      summary:     epicName,
      issuetype:   { name: 'Epic' },
      labels:      [label, 'release-plan'],
      duedate:     liveIso,
      description: vacationWarning ? buildEpicDescription(vacationWarning) : undefined,
    }}),
  });
  const epicData = await epicRes.json();
  if (!epicRes.ok) {
    const msg = epicData.errors ? Object.values(epicData.errors).join(', ') : String(epicRes.status);
    console.error('[Speedy] Epic-Fehler:', msg, JSON.stringify(epicData));
    throw new Error(`Epic: ${msg}`);
  }
  console.log('[Speedy] Epic angelegt:', epicData.key);

  // Tasks sequenziell anlegen.
  const createdTasks = [];
  for (const m of plan) {
    const taskRes  = await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ fields: {
        project:     { key: projectKey },
        summary:     m.name,
        issuetype:   { name: 'Task' },
        parent:      { key: epicData.key },
        labels:      [label, 'release-plan'],
        duedate:     m.date,
        description: {
          type: 'doc', version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: `Phase: ${m.phase}` }] }],
        },
      }}),
    });
    const taskData = await taskRes.json();
    if (!taskRes.ok) {
      const msg = taskData.errors ? Object.values(taskData.errors).join(', ') : String(taskRes.status);
      console.error('[Speedy] Task-Fehler:', m.name, msg);
      throw new Error(`Task "${m.name}": ${msg}`);
    }
    console.log('[Speedy] Task angelegt:', taskData.key, m.name);
    createdTasks.push({ key: taskData.key, name: m.name, date: m.date, phase: m.phase });
  }

  // Issuelinks anlegen: Typ "Blocks" zwischen abhängigen Meilensteinen.
  // Fehler werden nur gewarnt – bereits erstellte Issues sollen nicht zurückgerollt werden.
  const keyMap = new Map(createdTasks.map(t => [t.name, t.key]));
  keyMap.set(epicData.key, epicData.key); // Epic selbst ist kein Meilenstein, aber sicherheitshalber
  for (const dep of blockingDeps) {
    const blockerKey = keyMap.get(dep.blocker);
    const blockedKey = keyMap.get(dep.blocked);
    if (!blockerKey || !blockedKey) {
      console.warn(`[Speedy] Issuelink übersprungen (Key nicht gefunden): ${dep.blocker} → ${dep.blocked}`);
      continue;
    }
    const linkRes = await api.asUser().requestJira(route`/rest/api/3/issueLink`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({
        type:          { name: 'Blocks' },
        outwardIssue:  { key: blockerKey },
        inwardIssue:   { key: blockedKey },
      }),
    });
    if (!linkRes.ok) {
      const body = await linkRes.text();
      console.warn(`[Speedy] Issuelink fehlgeschlagen (${dep.blocker} → ${dep.blocked}): ${linkRes.status} ${body}`);
    } else {
      console.log(`[Speedy] Issuelink angelegt: ${blockerKey} blocks ${blockedKey}`);
    }
  }

  // localBaseUrl ist die echte Jira-Instanz-URL aus dem Forge-Kontext.
  // taskData.self zeigt auf den API-Gateway (api.atlassian.com) und ist nicht browserkompatibel.
  const siteBase = await getSiteBase(req.context);
  const result   = {
    epicKey: epicData.key,
    epicUrl: `${siteBase}/browse/${epicData.key}`,
    tasks:   createdTasks.map(t => ({ ...t, url: `${siteBase}/browse/${t.key}` })),
  };

  // Quick-Filter auf dem Board anlegen.
  const qfName = `Speedy: ${epicName}`;
  const qfJql  = `labels = "${label}"`;
  try {
    const boardId = await findBoardId(projectKey);
    if (boardId) {
      const qfRes  = await api.asUser().requestJira(route`/rest/agile/1.0/board/${boardId}/quickfilter`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ name: qfName, query: qfJql }),
      });
      if (qfRes.ok) {
        const qfData = await qfRes.json();
        console.log('[Speedy] Quick-Filter angelegt:', qfData.id, qfName);
        result.quickFilterId   = qfData.id;
        result.quickFilterName = qfName;
      } else {
        const body = await qfRes.text();
        console.warn('[Speedy] Quick-Filter konnte nicht angelegt werden:', qfRes.status, body);
      }
    } else {
      console.warn('[Speedy] Kein Board für Projekt gefunden, Quick-Filter übersprungen.');
    }
  } catch (qfErr) {
    console.warn('[Speedy] Quick-Filter-Fehler (ignoriert):', qfErr.message);
  }

  return result;
});

/**
 * Löscht den Release-Plan (Epic + alle Kind-Issues) für das angegebene Go-Live-Datum.
 *
 * Ablauf:
 *   1. Epic per Label suchen.
 *   2. Alle Kind-Issues des Epics per `parent = epicKey` suchen und löschen.
 *      (DELETE /rest/api/3/issue löscht in Jira nur das Issue selbst, keine Kinder.)
 *   3. Epic löschen.
 *
 * @param {string} req.payload.projectKey
 * @param {string} req.payload.liveIso
 * @returns {{ count: number }}
 */
resolver.define('deleteReleasePlan', async (req) => {
  const { projectKey, liveIso } = req.payload;
  const label = `speedy-${liveIso}`;
  console.log('[Speedy] deleteReleasePlan:', projectKey, label);

  const epics = await searchIssues(
    `project = "${projectKey}" AND labels = "${label}" AND issuetype = Epic`,
    ['id', 'key', 'issuetype']
  );

  let count = 0;
  for (const epic of epics) {
    // Alle Kind-Issues des Epics suchen und zuerst löschen.
    const children = await searchIssues(`parent = "${epic.key}"`, ['id', 'key']);
    for (const child of children) {
      await api.asUser().requestJira(route`/rest/api/3/issue/${child.id}`, { method: 'DELETE' });
      console.log('[Speedy] Kind gelöscht:', child.id);
      count++;
    }
    // Epic löschen (inkl. etwaiger echter Sub-Tasks).
    await api.asUser().requestJira(
      route`/rest/api/3/issue/${epic.id}?deleteSubtasks=true`,
      { method: 'DELETE' }
    );
    console.log('[Speedy] Epic gelöscht:', epic.id);
    count++;
  }

  // Quick-Filter auf dem Board entfernen (passend zum Label).
  try {
    const boardId = await findBoardId(projectKey);
    if (boardId) {
      const listRes = await api.asUser().requestJira(
        route`/rest/agile/1.0/board/${boardId}/quickfilter`,
        { headers: { Accept: 'application/json' } }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        for (const qf of (listData.values ?? [])) {
          if (qf.query?.includes(label)) {
            await api.asUser().requestJira(
              route`/rest/agile/1.0/board/${boardId}/quickfilter/${qf.id}`,
              { method: 'DELETE' }
            );
            console.log('[Speedy] Quick-Filter gelöscht:', qf.id, qf.name);
          }
        }
      }
    }
  } catch (qfErr) {
    console.warn('[Speedy] Quick-Filter-Löschung fehlgeschlagen (ignoriert):', qfErr.message);
  }

  return { count };
});

export const handler = resolver.getDefinitions();
