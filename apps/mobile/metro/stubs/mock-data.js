// What a feature's mock-data.ts becomes outside mock mode (metro/sample-data.js). Api mode never
// calls into it, so any use is a bug in the seam: every export is a function that says so loudly.

module.exports = new Proxy(
  {},
  {
    get(_target, name) {
      if (name === "__esModule") return true;
      if (typeof name === "symbol") return undefined;
      return () => {
        throw new Error(`Sample data "${name}" was read outside mock mode, and this build carries none.`);
      };
    },
  },
);
