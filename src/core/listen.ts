import { isEnvelope } from '../../shared/protocol';
import type { Receptor } from './receptor';

/**
 * Plug a receptor into `chrome.runtime.onMessage`.
 *
 * Call it synchronously at the top level of the entry file: a MV3 service worker
 * only wakes up for listeners that were registered during its first turn.
 * Messages that are not xfetch envelopes are ignored, so other listeners keep working.
 */
export function listen(
    app: Receptor
): void {

    chrome.runtime.onMessage.addListener((
        message: unknown, 
        sender, sendResponse
    ) => {
    
        if (!isEnvelope(message)) return false;

        void app.handle(message.request, { sender }).then(sendResponse);

        return true;
        
    });

}
