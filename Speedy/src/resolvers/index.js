import Resolver from '@forge/resolver';
import { requestJira } from '@forge/api';

const resolver = new Resolver();

/**
 * Liefert die Profildaten des aktuell eingeloggten Nutzers.
 * Wird im Frontend per invoke('getCurrentUser') aufgerufen.
 * Der Aufruf läuft über das Forge-Backend, das die App-Credentials
 * nutzt — daher kein 401 wie bei direkten Frontend-Aufrufen.
 */
resolver.define('getCurrentUser', async () => {
  const res = await requestJira('/rest/api/3/myself', {
    headers: { 'Accept': 'application/json' },
  });
  return res.json();
});

export const handler = resolver.getDefinitions();
