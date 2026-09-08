/* ORION CLIENT — deployment configuration
 *
 * Accounts, friends and the mod store need somewhere to live, which a static
 * site cannot provide, so they talk to a Supabase project. Everything below is
 * safe to publish: the publishable key grants nothing on its own, because the
 * tables deny it all direct access and every call goes through a function that
 * checks a session token the browser keeps to itself. Rotate or replace it from
 * the Supabase dashboard at any time.
 *
 * Blank out `api.url` to run Orion with no accounts at all: it then stops
 * asking anyone to sign in and hides the parts that need one.
 */
window.ORION = window.ORION || {};
window.ORION.config = {
  api: {
    url: 'https://bgoxonxxutkporbqbtbh.supabase.co',
    key: 'sb_publishable_HtWG15aHqfYe2gFNbhTfjQ_gy86rIWU',
    heartbeatMs: 20000,   // presence lapses server-side after 75s
    pollMs: 5000
  },

  /* TURN servers for shared worlds.
   *
   * `credentialsUrl` must return either a bare array of ICE servers or
   * { iceServers: [...] }. It points at a small proxy in the same Supabase
   * project rather than straight at the provider, because the provider's API
   * key must not sit in a public page: with that key anyone can mint
   * credentials against the account. The proxy holds it and caches the result,
   * so the browser only ever sees short-lived credentials.
   *
   * To go direct instead, put the provider URL here and accept that the key in
   * it is readable by every visitor.
   *
   * mode: 'replace' uses only these servers (the relay's list is discarded);
   * 'append' keeps the relay's and adds these after them.
   */
  turn: {
    credentialsUrl: 'https://bgoxonxxutkporbqbtbh.supabase.co/functions/v1/orion-turn',
    mode: 'replace',
    refreshMs: 1800000   // credentials are short-lived; refresh while open
  }
};
