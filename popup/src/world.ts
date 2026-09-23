import { connect } from '../core/ipc';
// Type-only imports: erased at build time, so the popup shares the backend's types without bundling it.
import type { ContentApi } from '../../src/content';
import type { BackgroundApi } from '../../src/background';

/**
 * The real browser, as seen from the popup.
 *
 *   await world.tab.page.getInfo();              // DOM of the active tab
 *   await world.background.storage.read('k');    // chrome.* APIs
 */
export const world = {
    tab: connect<ContentApi>('tab'),
    background: connect<BackgroundApi>('background'),
};
