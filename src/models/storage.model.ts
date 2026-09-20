/** Model: persistent key/value data on top of chrome.storage.local. */

export async function readValue(key: string): Promise<unknown> {
    return (await chrome.storage.local.get(key))[key];
}

export async function writeValue(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
}

export async function removeValue(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
}
