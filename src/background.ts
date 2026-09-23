import { expose } from './core/expose';
import * as storage from './api/storage';
import * as tabs from './api/tabs';

const api = { storage, tabs };

/** What the popup sees as `world.background`. */
export type BackgroundApi = typeof api;

expose(api);
