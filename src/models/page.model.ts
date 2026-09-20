export interface PageInfo {
    title: string;
    url: string;
    lang: string;
    selection: string;
}

export function getPageInfo(): PageInfo {
    return {
        title: document.title,
        url: location.href,
        lang: document.documentElement.lang,
        selection: window.getSelection()?.toString() ?? '',
    };
}

export function getTexts(selector: string, limit = 50): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .slice(0, limit)
        .map((el) => el.innerText.trim());
}

export function highlight(selector: string, color: string): number {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach((el) => (el.style.backgroundColor = color));
    return elements.length;
}
