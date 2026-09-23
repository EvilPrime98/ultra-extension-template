# ultra-extension-template

Chrome extension (MV3) template where the popup uses the real browser like local code. No routes, no requests: the backend *exposes* plain functions, the popup *calls* them, and chrome messaging carries the call in between.

```
popup/                      VIEW (ultra-light-js)
  src/App.ts                  components
  src/world.ts                the real browser as the popup sees it: world.tab, world.background
  core/ipc.ts                 connect<T>(target) -> typed proxy that sends calls

src/                        THE REAL WORLD
  api/                        plain functions that touch the DOM or chrome.*
  content.ts                  exposes { page }             (runs in the web page)
  background.ts               exposes { storage, tabs }    (runs in the service worker)
  core/expose.ts              plugs an object of functions into chrome.runtime.onMessage

shared/protocol.ts          wire format both sides import
```

## Flow

```
await world.tab.page.getInfo()
  -> connect() proxy ══ chrome messaging ══> expose() -> api/page.getInfo() (document.title, ...)
  <- return value (or thrown Error -> IpcError)
```

## Add a feature

1. **API** `src/api/foo.ts`: export functions that touch `document` or `chrome.*`.
2. **Expose it** in `content.ts` (DOM) or `background.ts` (chrome.*): `import * as foo from './api/foo'; const api = { ..., foo };`
3. **Call it** from a component: `await world.tab.foo.bar(1, 'x')` / `await world.background.foo.bar()`.

Types flow from the API to the popup on their own (`world.ts` imports `ContentApi` / `BackgroundApi` as types). Nothing to wire by hand.

## Rules

- Arguments and return values must be JSON-serializable (chrome messaging limit): no DOM nodes, functions, Blobs.
- Every function becomes async on the popup side, even sync ones.
- Throwing in an API function rejects the popup's call with `IpcError(message)`.
- Only own properties of what you `expose` are callable.
- `world.tab` targets the active tab; for a specific one: `connect<ContentApi>('tab', { tabId })`. Default timeout 10s (`{ timeout }`).

## Scripts

`pnpm dev` (HMR) / `pnpm build` -> load `dist/` in `chrome://extensions` / `pnpm typecheck` / `pnpm lint`

## Autogenerate

Build a template generator with `/scripts/generate-installer.mjs`
