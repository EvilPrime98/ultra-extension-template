# ultra-extension-template

Chrome extension (MV3) framework built on MVC. A tiny client in the popup talks to a Hono-style backend through `xfetch`, a custom `fetch`.

```
popup/                      VIEW (ultra-light-js)
  src/App.ts                  components
  src/services/*.service.ts   typed wrappers around xfetch, one per controller
  core/xfetch.ts             custom fetch -> Promise<Response>

src/                        BACKEND (talks to the real browser)
  core/receptor.ts            Hono-style router (get/post/put/patch/delete/use/route/onError)
  core/listen.ts              plugs a receptor into chrome.runtime.onMessage
  controllers/                routes, mounted with app.route('/prefix', controller)
  models/                     the code that touches the DOM or chrome.* APIs
  content.ts                  backend inside the web page  (DOM)          -> xfetch('/page')
  background.ts               backend in the service worker (chrome.*)    -> xfetch('/tabs', { target: 'background' })

shared/protocol.ts          wire format both sides import
```

## Flow

```
App.ts -> page.service.ts -> xfetch('/page') ══ chrome messaging ══> listen() -> Receptor
                                                                         -> pageController -> page.model (DOM)
```

## Add a feature

1. **Model** `src/models/foo.model.ts`: functions that touch `document` or `chrome.*`.
2. **Controller** `src/controllers/foo.controller.ts`: `export const fooController = new Receptor().get('/:id', c => c.json(...))`.
3. **Mount it** in `content.ts` or `background.ts`: `.route('/foo', fooController)`.
4. **Service** `popup/src/services/foo.service.ts`: `xfetchJson<Foo>('/foo/1')`.
5. Call the service from a component.

## Routes

Paths use [path-to-regexp](https://github.com/pillarjs/path-to-regexp) v8 syntax, and `c.req.param()` is typed from the route string:

```ts
.get('/tabs/:id', c => c.req.param('id'))        // string
.get('/tabs{/:id}', c => c.req.param('id'))      // string | undefined (optional)
.get('/files/*path', c => c.req.param('path'))   // string[] (wildcard, URI-decoded)
.use('/admin', guard)                            // middleware for /admin and everything below it
```

A bare `*` is not valid in v8: name the wildcard (`*rest`). Invalid patterns throw when the route is registered.

## xfetch

```ts
const res = await xfetch('/page');                                   // active tab's content script
const res = await xfetch('/storage/k', { target: 'background', method: 'PUT', body: { a: 1 } });
const data = await xfetchJson<T>('/page');                           // throws XfetchError on non-2xx
```

Like `fetch`: resolves for any HTTP status, rejects only when delivery fails (no content script, abort, timeout).
Bodies and responses travel as JSON/text; binary data (Blob, ArrayBuffer) is not supported by chrome messaging.

## Scripts

`pnpm dev` (HMR) / `pnpm build` -> load `dist/` in `chrome://extensions` / `pnpm typecheck` / `pnpm lint`
