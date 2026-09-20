/**
 * Wire format between the popup (xfetch) and the backend (receptor).
 *
 * chrome messaging only carries JSON, so a request/response is flattened to
 * plain data here and rebuilt into a real `Response` on the client side.
 */

/** Discriminator so unrelated `runtime.onMessage` traffic is never mistaken for ours. */
export const XFETCH_TAG = 'xfetch/1' as const;

/** Where a request is delivered: the page's content script, or the service worker. */
export type Target = 'tab' | 'background';

export interface WireRequest {
    method: string;
    /** Path + query string, e.g. `/tabs/3?pinned=1`. Never a full origin. */
    url: string;
    headers: [string, string][];
    body: string | null;
}

export interface WireResponse {
    status: number;
    statusText: string;
    headers: [string, string][];
    body: string | null;
}

export interface Envelope {
    tag: typeof XFETCH_TAG;
    request: WireRequest;
}

export function isEnvelope(message: unknown): message is Envelope {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as Envelope).tag === XFETCH_TAG &&
        typeof (message as Envelope).request === 'object'
    );
}

/** Statuses that must not carry a body (the `Response` constructor throws otherwise). */
export const NULL_BODY_STATUS = [101, 204, 205, 304];
