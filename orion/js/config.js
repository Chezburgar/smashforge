/* ORION CLIENT — deployment configuration
 *
 * The lobby needs somewhere to keep "who is online", which a static site
 * cannot do by itself. These are the Supabase project URL and its publishable
 * key. A publishable key is designed to ship inside a public page: it grants
 * nothing on its own, because the tables deny it all direct access and every
 * write goes through a function that checks a secret your browser keeps to
 * itself. Rotate or replace it from the Supabase dashboard at any time.
 *
 * Blank out `url` to turn the lobby off; Orion then hides that tab and
 * everything else keeps working.
 */
window.ORION = window.ORION || {};
window.ORION.config = {
  lobby: {
    url: 'https://bgoxonxxutkporbqbtbh.supabase.co',
    key: 'sb_publishable_HtWG15aHqfYe2gFNbhTfjQ_gy86rIWU',
    heartbeatMs: 20000,   // presence expires server-side after 75s
    pollMs: 5000
  }
};
