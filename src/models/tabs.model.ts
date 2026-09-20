/** Model: browser tabs. Runs in the background service worker (needs the "tabs" permission). */

export interface TabInfo {
    id: number;
    title: string;
    url: string;
    active: boolean;
}

function toTabInfo(tab: chrome.tabs.Tab): TabInfo {
    return { id: tab.id ?? -1, title: tab.title ?? '', url: tab.url ?? '', active: tab.active };
}

export async function listTabs(): Promise<TabInfo[]> {
    return (await chrome.tabs.query({})).map(toTabInfo);
}

export async function getTab(id: number): Promise<TabInfo | undefined> {
    try {
        return toTabInfo(await chrome.tabs.get(id));
    } catch {
        return undefined;
    }
}
