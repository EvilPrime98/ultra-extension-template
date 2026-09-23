import { isCall, type Reply } from '../../shared/protocol';

/**
 * Expose an object of functions (nested objects allowed) to the popup.
 *
 *   expose({ page })        // popup: await world.tab.page.getInfo()
 *
 * Call it synchronously at the top level of the entry file: a MV3 service worker
 * only wakes up for listeners that were registered during its first turn.
 * Messages that are not ipc calls are ignored, so other listeners keep working.
 */
export function expose(api: object): void {

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {

        if (!isCall(message)) return false;

        void run(api, message.path, message.args).then(sendResponse);

        return true;

    });

}

async function run(api: object, path: string[], args: unknown[]): Promise<Reply> {
    try {
        const fn = resolve(api, path);
        if (!fn) return { ok: false, error: `Nothing exposed at "${path.join('.')}".` };
        return { ok: true, value: await fn(...args) };
    } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
    }
}

/** Walk own properties only, so `constructor`, `__proto__`, etc. can never be reached. */
function resolve(api: object, path: string[]): ((...args: unknown[]) => unknown) | undefined {
    let node: unknown = api;
    for (const key of path) {
        if (typeof node !== 'object' && typeof node !== 'function') return undefined;
        if (node === null || !Object.hasOwn(node, key)) return undefined;
        node = (node as Record<string, unknown>)[key];
    }
    return typeof node === 'function' ? (node as (...args: unknown[]) => unknown) : undefined;
}
