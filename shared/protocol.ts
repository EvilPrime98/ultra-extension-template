/**
 * Wire format between the popup (`connect`) and the real world (`expose`).
 *
 * A call is "run the function at this path with these arguments"; a reply is
 * its return value or the message of what it threw. chrome messaging only
 * carries JSON, so arguments and return values must be JSON-serializable.
 */

/** Discriminator so unrelated `runtime.onMessage` traffic is never mistaken for ours. */
export const IPC_TAG = 'ipc/1' as const;

/** Where a call runs: the page's content script (DOM), or the service worker (chrome.*). */
export type Target = 'tab' | 'background';

export interface Call {
    tag: typeof IPC_TAG;
    /** Route into the exposed API, e.g. `['page', 'getInfo']`. */
    path: string[];
    args: unknown[];
}

export type Reply = { ok: true; value?: unknown } | { ok: false; error: string };

export function isCall(message: unknown): message is Call {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as Call).tag === IPC_TAG &&
        Array.isArray((message as Call).path) &&
        Array.isArray((message as Call).args)
    );
}
