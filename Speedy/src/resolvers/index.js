import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

/**
 * Liefert die Profildaten des aktuell eingeloggten Nutzers.
 * Wird im Frontend per invoke('getCurrentUser') aufgerufen.
 *
 * @param {object} req - Forge-Request-Kontext (enthält u.a. accountId des aufrufenden Users)
 * @returns {Promise<object>} Jira-Benutzerprofil
 */
resolver.define('getCurrentUser', async (req) => {
  console.log('[Speedy Resolver] getCurrentUser aufgerufen, accountId:', req.context?.accountId);

  // asUser() stellt den Aufruf im Namen des eingeloggten Nutzers –
  // nur so liefert /myself die Daten des richtigen Accounts.
  const res = await api.asUser().requestJira(route`/rest/api/3/myself`, {
    headers: { 'Accept': 'application/json' },
  });

  // Fehlerhafte Antworten (non-2xx) enthalten oft plain-text statt JSON –
  // daher zuerst als Text lesen, dann loggen und weiterwerfen.
  if (!res.ok) {
    const body = await res.text();
    console.error(`[Speedy Resolver] /myself schlug fehl: HTTP ${res.status}`, body);
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  console.log('[Speedy Resolver] Benutzerdaten geladen:', data.displayName, data.accountType);
  return data;
});

export const handler = resolver.getDefinitions();
