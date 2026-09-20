/**
 * Receptor: a router for the extension "backend".
 *
 * Paths use path-to-regexp v8 syntax (`:id`, `{/:optional}`, `*wildcard`).
 * It knows nothing about `chrome.*`: it turns a `WireRequest` into a `WireResponse`.
 * `listen.ts` is the piece that plugs it into chrome messaging.
 *
 *   const app = new Receptor();
 *   app.get('/tabs/:id', async (c) => c.json(await getTab(Number(c.req.param('id')))));
 */

import { match } from 'path-to-regexp';

import { NULL_BODY_STATUS, type WireRequest, type WireResponse } from '../../shared/protocol';

import { Env, ErrorHandler, Handler, Layer, Matcher, Params, RawParams } from './core.types';

export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

const FAKE_ORIGIN = 'http://receptor.local';

export class ContextRequest<P extends string = string> {

    readonly method: string;
    /** Path without the query string. */
    readonly path: string;
    readonly headers: Headers;
    readonly #url: URL;
    readonly #body: string | null;
    #params: RawParams = {};

    constructor(request: WireRequest) {
        this.method = request.method.toUpperCase();
        this.#url = new URL(request.url, FAKE_ORIGIN);
        this.path = this.#url.pathname;
        this.headers = new Headers(request.headers);
        this.#body = request.body;
    }

    /** @internal Called by the router before each handler runs. */
    setParams(params: RawParams): void {
        this.#params = params;
    }

    param<K extends keyof Params<P>>(key: K): Params<P>[K];
    param(): Params<P>;
    param(key?: string): unknown {
        return key === undefined ? { ...this.#params } : this.#params[key];
    }

    query(key: string): string | undefined;
    query(): Record<string, string>;
    query(key?: string): unknown {
        return key === undefined
        ? Object.fromEntries(this.#url.searchParams)
        : (this.#url.searchParams.get(key) ?? undefined);
    }

    async text(): Promise<string> {
        return this.#body ?? '';
    }

    async json<T = unknown>(): Promise<T> {
        try {
            return JSON.parse(this.#body ?? '') as T;
        } catch {
            throw new HttpError(400, 'Invalid JSON body');
        }
    }

}

export class Context<P extends string = string> {
    
    readonly req: ContextRequest<P>;
    readonly env: Env;
    readonly #vars = new Map<string, unknown>();

    constructor(request: WireRequest, env: Env) {
        this.req = new ContextRequest<P>(request);
        this.env = env;
    }

    /** Share values between middleware and handlers. */
    set(key: string, value: unknown): void {
        this.#vars.set(key, value);
    }

    get<T = unknown>(key: string): T | undefined {
        return this.#vars.get(key) as T | undefined;
    }

    json(data: unknown, status = 200, headers?: HeadersInit): Response {
        const h = new Headers(headers);
        h.set('content-type', 'application/json');
        return new Response(JSON.stringify(data), { status, headers: h });
    }

    text(data: string, status = 200, headers?: HeadersInit): Response {
        const h = new Headers(headers);
        if (!h.has('content-type')) h.set('content-type', 'text/plain; charset=utf-8');
        return new Response(data, { status, headers: h });
    }

    /** Empty response, `204 No Content` by default. */
    empty(status = 204): Response {
        return new Response(null, { status });
    }
}

/** Throws at registration time if `pattern` is not valid path-to-regexp syntax. */
function compile(pattern: string, end: boolean): Matcher {
    return pattern === '' ? () => ({ params: {} }) : match(pattern, { end });
}

function joinPaths(prefix: string, pattern: string, end: boolean): string {
    const base = prefix.replace(/\/+$/, '');
    const joined = base + (pattern === '/' ? '' : pattern);
    return joined === '' && end ? '/' : joined;
}

const defaultNotFound: Handler = (c) => c.json({ error: `Not Found: ${c.req.method} ${c.req.path}` }, 404);

const defaultOnError: ErrorHandler = (err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    console.error('[receptor]', err);
    return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
};

export class Receptor {
    
    readonly #layers: Layer[] = [];
    #notFound: Handler = defaultNotFound;
    #onError: ErrorHandler = defaultOnError;

    get<P extends string>(path: P, ...handlers: Handler<P>[]): this {
        return this.#add('GET', path, handlers);
    }

    post<P extends string>(path: P, ...handlers: Handler<P>[]): this {
        return this.#add('POST', path, handlers);
    }

    put<P extends string>(path: P, ...handlers: Handler<P>[]): this {
        return this.#add('PUT', path, handlers);
    }

    patch<P extends string>(path: P, ...handlers: Handler<P>[]): this {
        return this.#add('PATCH', path, handlers);
    }

    delete<P extends string>(path: P, ...handlers: Handler<P>[]): this {
        return this.#add('DELETE', path, handlers);
    }

    all<P extends string>(path: P, ...handlers: Handler<P>[]): this {
        return this.#add('ALL', path, handlers);
    }

    /** Middleware. Without a path it runs for every request; with one, for that path and everything below it. */
    use(...handlers: Handler[]): this;
    
    use<P extends string>(path: P, ...handlers: Handler<P>[]): this;
    
    use(first: string | Handler, ...rest: Handler[]): this {
        if (typeof first === 'string') {
            // '/' means "everything", which is the empty pattern for a prefix match.
            return this.#add('ALL', first.replace(/\/+$/, ''), rest, false);
        }
        return this.#add('ALL', '', [first, ...rest], false);
    }

    /**
     * Mount a sub-app (a controller) under a prefix.
     * Routes are copied at call time, so register everything on `sub` first.
     * Errors and 404s are always handled by the root app.
     */
    route(prefix: string, sub: Receptor): this {
        for (const layer of sub.#layers) {
            const pattern = joinPaths(prefix, layer.pattern, layer.end);
            this.#layers.push({ ...layer, pattern, matcher: compile(pattern, layer.end) });
        }
        return this;
    }

    notFound(handler: Handler): this {
        this.#notFound = handler;
        return this;
    }

    onError(handler: ErrorHandler): this {
        this.#onError = handler;
        return this;
    }

    /** Run a request through the app and get a real `Response` back. */
    async fetch(request: WireRequest, env: Env = {}): Promise<Response> {
        const c = new Context(request, env);

        const dispatch = async (from: number): Promise<Response> => {
            for (let i = from; i < this.#layers.length; i++) {
                const layer = this.#layers[i];
                if (layer.method !== 'ALL' && layer.method !== c.req.method) continue;

                let matched: ReturnType<Matcher>;
                try {
                    matched = layer.matcher(c.req.path);
                } catch {
                    // path-to-regexp URI-decodes params while matching; bad %-escapes throw.
                    throw new HttpError(400, 'Malformed URL parameter');
                }
                if (!matched) continue;

                c.req.setParams(matched.params);

                const res = await layer.handler(c, () => dispatch(i + 1));
                if (!(res instanceof Response)) {
                    throw new TypeError(`Handler for ${layer.method} ${layer.pattern} did not return a Response`);
                }
                return res;
            }
            return this.#notFound(c, () => Promise.reject(new Error('notFound handlers have no next')));
        };

        try {
            return await dispatch(0);
        } catch (err) {
            try {
                return await this.#onError(err, c);
            } catch (fatal) {
                console.error('[receptor] onError threw', fatal);
                return new Response('Internal Server Error', { status: 500 });
            }
        }
    }

    /** Same as `fetch`, flattened to the JSON-safe shape chrome messaging can carry. */
    async handle(request: WireRequest, env: Env = {}): Promise<WireResponse> {
        const res = await this.fetch(request, env);
        return {
            status: res.status,
            statusText: res.statusText,
            headers: [...res.headers.entries()],
            body: NULL_BODY_STATUS.includes(res.status) ? null : await res.text(),
        };
    }

    #add(method: Layer['method'], path: string, handlers: Handler<never>[], end = true): this {
        if (path !== '' && !path.startsWith('/')) {
            throw new TypeError(`Route path must start with "/": "${path}"`);
        }
        const matcher = compile(path, end);
        for (const handler of handlers as Handler[]) {
            this.#layers.push({ method, pattern: path, end, matcher, handler });
        }
        return this;
    }

}
