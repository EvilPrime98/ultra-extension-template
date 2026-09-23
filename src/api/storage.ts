/** Persistent key/value data on top of chrome.storage.local. Exposed by the background as `world.background.storage`. */

export async function read(key: string): Promise<unknown> {
    return (await chrome.storage.local.get(key))[key];
}

export async function write(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
}

export async function remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
}
