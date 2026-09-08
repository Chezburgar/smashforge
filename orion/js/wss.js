/* ORION CLIENT — getting a server to speak wss://
 *
 * This is the single most common reason an Eaglercraft server "does not work",
 * and the reason is not the server: it is that a browser on an HTTPS page may
 * only open an encrypted socket. Orion is on GitHub Pages, so it is HTTPS, so
 * `ws://` is refused by the browser before anything reaches the network. No
 * server setting changes that. The address has to be `wss://`.
 *
 * What EaglerXServer actually needs, read out of its own CONFIG.md rather than
 * guessed at:
 *
 *   - **One port, not two.** `listener.cfg` has `dual_stack` on by default:
 *     the listener works out what kind of connection it is from the first
 *     packet — an HTTP/1.1 request is Eaglercraft, anything else is ordinary
 *     Java — so Eaglercraft uses the same address and port as Java Edition.
 *   - **TLS is off by default.** `tls_config.enable_tls` is false, so a fresh
 *     install speaks plain `ws://` only.
 *   - **`require_tls` defaults to true**, which assumes *every* connection is
 *     TLS. Turning TLS on without turning that off takes the Java players off
 *     the same port.
 *   - The files it wants are a PEM chain and a **PKCS#8** private key. Most
 *     ACME clients hand you a PKCS#1 key ("BEGIN RSA PRIVATE KEY") or a SEC1
 *     one ("BEGIN EC PRIVATE KEY"), which have to be converted, and that is
 *     the step people miss.
 *
 * The certificate is the part that traps people on shared hosts. A certificate
 * has to match the hostname the browser asks for, and free hosts hand out a
 * subdomain of *their* domain, whose DNS you do not control — so you cannot
 * prove ownership of it, and no certificate authority will issue for it. The
 * way round is a hostname you do control pointed at the server, and a DNS-01
 * challenge, which proves ownership through a TXT record instead of through an
 * open port. That is why the instructions below go via a domain of your own.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const W = {};
  O.Wss = W;

  /* Everything this needs to know about one server. */
  W.parse = function (addr) {
    let url;
    try {
      url = new URL(String(addr || '').trim());
    } catch (e) {
      return null;
    }
    if (!/^wss?:$/.test(url.protocol)) return null;
    return {
      scheme: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || (url.protocol === 'wss:' ? '443' : '25565'),
      path: url.pathname === '/' ? '' : url.pathname
    };
  };

  /* Is this a hostname nobody can get a certificate for? Not a blocklist of
   * hosts — a test for the shape of the problem: a subdomain of somebody
   * else's domain, or a bare IP address. */
  W.certifiable = function (host) {
    if (!host) return { ok: false, why: 'no host' };
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.indexOf(':') >= 0) {
      return {
        ok: false,
        why: 'That is an IP address. A certificate is issued for a name, never for a bare address, so ' +
             'a browser can never be given an encrypted connection to it. You need a hostname.'
      };
    }
    const parts = host.split('.');
    if (parts.length > 2) {
      return {
        ok: false,
        why: 'That is a subdomain of ' + parts.slice(-2).join('.') + ', which belongs to your host rather ' +
             'than to you. Nobody will issue a certificate for a name whose DNS you cannot edit, so this ' +
             'address cannot be given TLS by you — point a name of your own at the server instead.'
      };
    }
    return { ok: true };
  };

  /* The listener.cfg block to paste in. Kept as text rather than built from a
   * template engine so what you copy is exactly what is shown. */
  W.listenerConfig = function () {
    return [
      '# plugins/EaglerXServer/listener.cfg   (Spigot / Paper / Bukkit)',
      '#',
      '# dual_stack is already true by default: this one port keeps serving your',
      '# Java players and starts serving browsers as well.',
      '',
      'tls_config {',
      '    enable_tls = true',
      '',
      '    # MUST be false. True means "assume every connection is TLS", which',
      '    # would stop the same port accepting Java Edition.',
      '    require_tls = false',
      '',
      '    tls_public_chain_file = "fullchain.pem"',
      '    tls_private_key_file = "privatekey.pem"',
      '    tls_private_key_password = ""',
      '',
      '    # Re-upload a renewed certificate and it is picked up without a restart.',
      '    tls_auto_refresh_cert = true',
      '}'
    ].join('\n');
  };

  /* The commands, with their hostname filled in. acme.sh with a DNS-01
   * challenge because it needs no open port on the server — which is the whole
   * point on a host that only gives you a game port. */
  W.certCommands = function (hostname) {
    const h = String(hostname || 'mc.example.com').trim() || 'mc.example.com';
    return [
      '# On your own computer, not on the server. Needs a domain whose DNS you',
      '# can edit; a free DuckDNS name works.',
      '',
      'curl https://get.acme.sh | sh -s email=you@example.com',
      '',
      '# DuckDNS: your token from duckdns.org. Other providers have their own',
      '# variables — acme.sh has a page listing every one of them.',
      'export DuckDNS_Token="your-duckdns-token"',
      '',
      '# --dns proves you own the name with a TXT record, so nothing has to be',
      '# reachable on port 80 or 443. That is what makes this work on a host',
      '# that only gives you a game port.',
      '~/.acme.sh/acme.sh --issue --dns dns_duckdns -d ' + h,
      '',
      '# EaglerXServer wants PKCS#8 ("BEGIN PRIVATE KEY"). acme.sh writes',
      '# PKCS#1 or SEC1, so convert it — skipping this is the usual reason the',
      '# server logs a key error and carries on without TLS.',
      'openssl pkcs8 -topk8 -nocrypt \\',
      '  -in ~/.acme.sh/' + h + '/' + h + '.key \\',
      '  -out privatekey.pem',
      'cp ~/.acme.sh/' + h + '/fullchain.cer fullchain.pem',
      '',
      '# Upload fullchain.pem and privatekey.pem to the server\'s root folder',
      '# (the same folder as server.properties), then restart it.'
    ].join('\n');
  };

  /* What to point at what. */
  W.dnsSteps = function (parsed, wanted) {
    const host = (parsed && parsed.host) || 'your-server.example';
    const mine = String(wanted || '').trim() || 'your-name';
    return [
      {
        title: 'Get a hostname you control',
        text: 'A free DuckDNS name is enough — it is a subdomain, but one whose DNS you can edit, which is ' +
              'what a certificate authority checks. Any domain you own works too.'
      },
      {
        title: 'Point it at the server',
        text: 'Add a CNAME from your name to ' + host + '. If your host gives you an IP rather than a name, ' +
              'use an A record with that IP instead. Nothing here needs the port — DNS does not carry ports.'
      },
      {
        title: 'Issue the certificate with a DNS challenge',
        text: 'The commands below use a TXT record to prove the name is yours, so no port on the server has ' +
              'to be reachable. That matters: a host that only gives you a game port cannot answer the ' +
              'usual challenge on port 80.'
      },
      {
        title: 'Turn TLS on and restart',
        text: 'Upload the two files, paste the tls_config block into listener.cfg, restart. Then join at ' +
              'wss://' + mine + (parsed && parsed.port ? ':' + parsed.port : '') + ' — same port as before.'
      }
    ];
  };

  /* The address to use once it is done. */
  W.finalAddress = function (parsed, hostname) {
    const h = String(hostname || '').trim();
    if (!h) return null;
    const port = (parsed && parsed.port) || '25565';
    return 'wss://' + h + (port === '443' ? '' : ':' + port) + ((parsed && parsed.path) || '');
  };

  /* The other way out, for anyone who cannot get a certificate at all: a page
   * served over plain http:// is allowed to open a plain ws:// socket, and the
   * repository ships a dev server for exactly that. It is a real answer, not a
   * consolation prize — it just does not work for friends who are not at your
   * computer. */
  W.localFallback = function () {
    return [
      'git clone https://github.com/Chezburgar/smashforge',
      'cd smashforge',
      'node tools/serve.js . 8123',
      '',
      '# then open http://localhost:8123/orion/ instead of the GitHub Pages one.',
      '# On an http:// page the browser allows plain ws://, so your server works',
      '# untouched — but only for whoever is at that computer.'
    ].join('\n');
  };
})(window.ORION);
