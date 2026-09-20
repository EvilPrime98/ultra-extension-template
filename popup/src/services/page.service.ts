import { xfetchJson } from "../../core/xfetch";
// Type-only import: erased at build time, so the popup shares the backend's types without bundling it.
import type { PageInfo } from "../../../src/models/page.model";

/** Client-side counterpart of `src/controllers/page.controller.ts`. */
export function getPageInfo(): Promise<PageInfo> {
    return xfetchJson<PageInfo>('/page');
}

export function highlight(selector: string, color = 'yellow'): Promise<{ selector: string; count: number }> {
    return xfetchJson('/page/highlight', { method: 'POST', body: { selector, color } });
}
