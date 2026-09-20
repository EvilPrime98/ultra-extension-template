import { HttpError, Receptor } from '../core/receptor';
import { readValue, removeValue, writeValue } from '../models/storage.model';

export function createStorageController() {

    const storageController = new Receptor()


    storageController.get('/:key', async (c) => {
        const key = c.req.param('key');
        const value = await readValue(key);
        if (value === undefined) throw new HttpError(404, `No value for "${key}"`);
        return c.json({ key, value });
    })

    storageController.put('/:key', async (c) => {
        const key = c.req.param('key');
        const value = await c.req.json();
        await writeValue(key, value);
        return c.json({ key, value });
    })

    storageController.delete('/:key', async (c) => {
        await removeValue(c.req.param('key'));
        return c.empty();
    });

    return storageController

}
