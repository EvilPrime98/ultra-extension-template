import { IPC_TAG, type Call, type Reply, type Target } from '../../shared/protocol';

/**
 * Use the real browser from the popup as if it were local code.
 *
 *   const tab = connect<typeof contentApi>('tab');
 *   const info = await tab.page.getInfo();      // runs in the page, returns here
 *
 * `T` is the type of the object passed to `expose()` on the other side; import it
 * with `import type` so nothing from the backend is bundled into the popup.
 * Every function becomes async. Errors thrown over there reject here as `IpcError`.
 */

export type Remote<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
        ? (...args: A) => Promise<Awaited<R>>
        : T[K] extends object
          ? Remote<T[K]>
          : never;
};

export interface ConnectOptions {
    /** Only for `'tab'`. Defaults to the active tab of the current window. */
    tabId?: number;
    /** Milliseconds to wait for an answer. Default 10000, `0` disables. */
    timeout?: number;
}

export class IpcError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'IpcError';
    }
}

const DEFAULT_TIMEOUT = 10_000;

export function connect<T extends object>(target: Target, options: ConnectOptions = {}): Remote<T> {
    return proxy([], target, options) as Remote<T>;
}

/** A callable proxy: property access extends the path, calling it sends the call. */
function proxy(path: string[], target: Target, options: ConnectOptions): unknown {
    return new Proxy(function () {}, {
        get: (_fn, key) =>
            // `then` stays undefined so a proxy is never mistaken for a thenable by `await`.
            typeof key === 'string' && key !== 'then' ? proxy([...path, key], target, options) : undefined,
        apply: (_fn, _this, args) => send({ tag: IPC_TAG, path, args }, target, options),
    });
}

async function send(call: Call, target: Target, { tabId, timeout = DEFAULT_TIMEOUT }: ConnectOptions): Promise<unknown> {
    if (call.path.length === 0) throw new TypeError('Nothing to call: use e.g. tab.page.getInfo().');

    const reply = await withTimeout(deliver(call, target, tabId), timeout, call.path.join('.'));

    if (!reply) throw new IpcError(`Nothing answered "${call.path.join('.')}" on target "${target}".`);
    if (!reply.ok) throw new IpcError(reply.error);
    return reply.value;
}

async function deliver(call: Call, target: Target, tabId?: number): Promise<Reply | undefined> {
    try {
        if (target === 'background') {
            return await chrome.runtime.sendMessage<Call, Reply | undefined>(call);
        }
        // frameId 0: only the top frame's content script answers, never iframes.
        return await chrome.tabs.sendMessage<Call, Reply | undefined>(tabId ?? (await activeTabId()), call, {
            frameId: 0,
        });
    } catch (cause) {
        throw new IpcError(explain(cause, target), { cause });
    }
}

async function activeTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new IpcError('No active tab found.');
    return tab.id;
}

function explain(cause: unknown, target: Target): string {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (target === 'tab' && message.includes('Receiving end does not exist')) {
        return 'The tab has no content script (restricted page like chrome://, or reload the tab after installing the extension).';
    }
    return message;
}

/** The message itself cannot be recalled, we just stop waiting. */
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
    if (!ms) return promise;

    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new IpcError(`"${what}" timed out after ${ms}ms.`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
