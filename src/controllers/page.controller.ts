import { HttpError, Receptor } from '../core/receptor';
import { getPageInfo, getTexts, highlight } from '../models/page.model';

export function createPageController() {

    const app = new Receptor();

    app.get('/', (c) => c.json(getPageInfo()))

    app.get('/elements', (c) => {
        const selector = c.req.query('selector');
        if (!selector) throw new HttpError(400, 'Missing ?selector=');
        try {
            return c.json({ selector, texts: getTexts(selector) });
        } catch {
            throw new HttpError(400, `Invalid selector: ${selector}`);
        }
    })

    app.post('/highlight', async (c) => {
        const { selector, color = 'yellow' } = await c.req.json<{ selector?: string; color?: string }>();
        if (!selector) throw new HttpError(400, 'Body needs a "selector"');

        try {
            return c.json({ selector, count: highlight(selector, color) });
        } catch {
            throw new HttpError(400, `Invalid selector: ${selector}`);
        }
    });

    return app

}
