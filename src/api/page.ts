/** The page's DOM. Exposed by the content script as `world.tab.page`. */

export interface PageInfo {
    title: string;
    url: string;
    lang: string;
    selection: string;
}

export function getInfo(): PageInfo {
    return {
        title: document.title,
        url: location.href,
        lang: document.documentElement.lang,
        selection: window.getSelection()?.toString() ?? '',
    };
}

export function getTexts(selector: string, limit = 50): string[] {
    return query(selector)
        .slice(0, limit)
        .map((el) => el.innerText.trim());
}

export function highlight(selector: string, color = 'yellow'): number {
    const elements = query(selector);
    elements.forEach((el) => (el.style.backgroundColor = color));
    return elements.length;
}

function query(selector: string): HTMLElement[] {
    try {
        return Array.from(document.querySelectorAll<HTMLElement>(selector));
    } catch {
        throw new Error(`Invalid selector: ${selector}`);
    }
}
