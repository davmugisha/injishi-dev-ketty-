// Expo's ambient types (`*.css` among them, for `import "../global.css"` in
// the root layout) without depending on `expo-env.d.ts`. That file holds the
// same reference but is gitignored, written only by a dev server or by `expo
// customize`, so `pnpm -r typecheck` on a fresh checkout (CI's typecheck job)
// failed TS2882 on the stylesheet import: TypeScript 6 checks side-effect
// imports by default.
/// <reference types="expo/types" />
