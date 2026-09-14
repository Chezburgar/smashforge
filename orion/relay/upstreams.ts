// ORION CLIENT — which relay the proxy is allowed to forward to.
//
// Kept apart from the server so it can be checked on its own, and so the
// Cloudflare build and the Supabase build cannot drift into different lists.

/* Relays the proxy will forward to. Anything else is refused, so this cannot be
 * used as an open proxy to arbitrary hosts. */
export const ALLOWED = [
  "relay.deev.is",
  "relay.lax1dude.net",
  "relay.shhnowisnottheti.me",
];

/* Used when no ?to= is given. Orion always sends one: a shared world is
 * registered with a single relay, and the people joining only find it because
 * they scan the relays in their own list, so which one it lands on has to be
 * predictable rather than whichever answered first. */
export const DEFAULT_UPSTREAM = "relay.deev.is";

export type Resolved =
  | { ok: true; host: string; url: string }
  | { ok: false; error: string };

/* Which relay a request is asking for, and whether it may have it. Accepts a
 * bare hostname or a full wss:// address. */
export function resolveUpstream(raw: string | null | undefined): Resolved {
  let host = String(raw == null ? "" : raw).trim();
  if (!host) host = DEFAULT_UPSTREAM;
  if (/^wss?:\/\//i.test(host)) {
    try {
      host = new URL(host).hostname;
    } catch {
      return { ok: false, error: "that is not a valid relay address" };
    }
  }
  host = host.replace(/\/+$/, "").toLowerCase();
  if (!ALLOWED.includes(host)) {
    return { ok: false, error: host + " is not one of the relays this proxy forwards to" };
  }
  return { ok: true, host: host, url: "wss://" + host + "/" };
}
