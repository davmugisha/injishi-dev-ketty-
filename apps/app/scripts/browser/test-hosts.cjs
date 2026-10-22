/**
 * Preloaded (`node --require`) into every Node process `prod-stack.mjs` starts: `injishi.test` and its
 * subdomains resolve to this machine, as Chromium's `--host-resolver-rules` does for the browser.
 *
 * Web's server side fetches `NEXT_PUBLIC_API_URL` itself, so without this its server rendering could not
 * reach the API the browser uses. Every other name resolves as it always does. CommonJS, because
 * `--require` is how NODE_OPTIONS preloads a file into processes it does not start directly (Next's workers).
 */
const dns = require("node:dns");

const PARENT = "injishi.test";

function isTestHost(hostname) {
  const host = String(hostname).toLowerCase().replace(/\.$/, "");
  return host === PARENT || host.endsWith(`.${PARENT}`);
}

function answer(options) {
  const opts = typeof options === "number" ? { family: options } : options || {};
  return opts.all ? [[{ address: "127.0.0.1", family: 4 }]] : ["127.0.0.1", 4];
}

const lookup = dns.lookup;
dns.lookup = function lookupTestHosts(hostname, options, callback) {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? {} : options;
  if (!isTestHost(hostname)) return lookup.call(this, hostname, options, callback);
  process.nextTick(cb, null, ...answer(opts));
  return {};
};

const lookupPromise = dns.promises.lookup;
dns.promises.lookup = async function lookupTestHostsPromise(hostname, options) {
  if (!isTestHost(hostname)) return lookupPromise.call(this, hostname, options);
  const [result, family] = answer(options);
  return family === undefined ? result : { address: result, family };
};
