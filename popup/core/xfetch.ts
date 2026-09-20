import {
    XFETCH_TAG,
    NULL_BODY_STATUS,
    type Envelope,
    type Target,
    type WireRequest,
    type WireResponse,
} from '../../shared/protocol';

/**
 * `fetch()` for the extension backend.
 *
 *   const res = await xfetch('/page');                                  // active tab's content script
 *   const res = await xfetch('/storage/theme', { target: 'background', method: 'PUT', body: { dark: true } });
 *   const page = await res.json();
 *
 * Same contract as fetch: it resolves with a real `Response` for ANY status (check `res.ok`)
 * and rejects with `XfetchError` only when the message could not be delivered or answered.
 */

export interface XfetchInit {
    method?: string;
    headers?: HeadersInit;
    /** Strings are sent as-is. Plain objects/arrays/numbers/booleans are JSON-encoded. */
    body?: string | number | boolean | object | null;
    signal?: AbortSignal;
    /** `'tab'` (default): the content script of a tab. `'background'`: the service worker. */
    target?: Target;
    /** Only for `target: 'tab'`. Defaults to the active tab of the current window. */
    tabId?: number;
    /** Milliseconds to wait for an answer. Default 10000, `0` disables. */
    timeout?: number;
}

export class XfetchError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'XfetchError';
    }
}

const DEFAULT_TIMEOUT = 10_000;

/** `xfetch` + `res.json()`; throws a `XfetchError` carrying the server's `error` message on non-2xx. */
export async function xfetchJson<T>(input: string, init?: XfetchInit): Promise<T> {
    const res = await xfetch(input, init);
    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new XfetchError(body?.error ?? `${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
}

export async function xfetch(input: string, init: XfetchInit = {}): Promise<Response> {
    const request = buildRequest(input, init);
    const envelope: Envelope = { tag: XFETCH_TAG, request };

    const wire = await raceAbort(deliver(envelope, init), init.signal, init.timeout ?? DEFAULT_TIMEOUT);

    return new Response(NULL_BODY_STATUS.includes(wire.status) ? null : wire.body, {
        status: wire.status,
        statusText: wire.statusText,
        headers: wire.headers,
    });
}

function buildRequest(input: string, init: XfetchInit): WireRequest {
    if (!input.startsWith('/')) {
        throw new TypeError(`xfetch expects a path starting with "/", got "${input}"`);
    }

    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    let body: string | null = null;

    if (init.body != null) {
        if (method === 'GET' || method === 'HEAD') {
            throw new TypeError(`Request with ${method} method cannot have body.`);
        }
        if (typeof init.body === 'string') {
            body = init.body;
        } else if (isJsonLike(init.body)) {
            if (!headers.has('content-type')) headers.set('content-type', 'application/json');
            body = JSON.stringify(init.body);
        } else {
            throw new TypeError('xfetch bodies must be a string or JSON-serializable data.');
        }
    }

    return { method, url: input, headers: [...headers.entries()], body };
}

function isJsonLike(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return true;
    if (Array.isArray(value)) return true;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

async function deliver(envelope: Envelope, init: XfetchInit): Promise<WireResponse> {
    const target = init.target ?? 'tab';
    let wire: WireResponse | undefined;

    try {
        if (target === 'background') {
            wire = await chrome.runtime.sendMessage<Envelope, WireResponse | undefined>(envelope);
        } else {
            const tabId = init.tabId ?? (await activeTabId());
            // frameId 0: only the top frame's content script answers, never iframes.
            wire = await chrome.tabs.sendMessage<Envelope, WireResponse | undefined>(tabId, envelope, {
                frameId: 0,
            });
        }
    } catch (cause) {
        throw new XfetchError(explain(cause, target), { cause });
    }

    if (!wire) {
        throw new XfetchError(`No receptor answered on target "${target}".`);
    }
    return wire;
}

async function activeTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new XfetchError('No active tab found.');
    return tab.id;
}

function explain(cause: unknown, target: Target): string {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (target === 'tab' && message.includes('Receiving end does not exist')) {
        return 'The tab has no content script (restricted page like chrome://, or reload the tab after installing the extension).';
    }
    return message;
}

/** Reject early on abort/timeout. The message itself cannot be recalled, we just stop waiting. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined, timeout: number): Promise<T> {
    if (!signal && !timeout) return promise;

    return new Promise<T>((resolve, reject) => {
        const timer =
            timeout > 0
                ? setTimeout(
                      () => settle(() => reject(new DOMException(`xfetch timed out after ${timeout}ms`, 'TimeoutError'))),
                      timeout,
                  )
                : undefined;
        const onAbort = () => settle(() => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')));

        function settle(fn: () => void) {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            fn();
        }

        if (signal?.aborted) return onAbort();
        signal?.addEventListener('abort', onAbort, { once: true });
        promise.then(
            (value) => settle(() => resolve(value)),
            (err) => settle(() => reject(err)),
        );
    });
}
