import { expose } from './core/expose';
import * as page from './api/page';

const api = { page };

/** What the popup sees as `world.tab`. */
export type ContentApi = typeof api;

expose(api);
