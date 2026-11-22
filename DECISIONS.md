# Decisions

- npm workspaces monorepo — simple, no extra tooling needed for three packages
- Three.js for 3D rendering — required by design spec
- Hono on Cloudflare Workers — lightweight, Worker-native router with zero overhead
- Vite for client build — fast HMR, native TypeScript, proxies /api/* to local Worker in dev
- zod owned by shared package — both client and server consume shared api-types that use zod
- CSS vignette + filter for stress/fatigue cues — avoids Three.js EffectComposer dependency
- Uniform variance threshold 30ms² for anti-bot check — rejects bot-like uniform timing, passes natural human variance (typically 100–10000ms²)
- Demo mode controlled by server DEMO_MODE env var, echoed in StartRunResponse — client can't set it; both sides use the same timing source
- esbuild.pure strips console.log/info/warn from production bundle — keeps console.error for real runtime errors
- Multiplicative scoring (not additive) — neglecting any single area tanks total score, enforces balanced play
- D1 save is best-effort (try/catch) — leaderboard degrades gracefully in local dev without wrangler d1 create
