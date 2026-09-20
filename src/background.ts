import { createStorageController } from './controllers/storage.controller';
import { listen } from './core/listen';
import { logger } from './core/middleware';
import { Receptor } from './core/receptor';

function startBackgroundApp() {
    
    const app = new Receptor();

    app.use(logger)
    
    app.route('/storage', createStorageController());

    listen(app);

}

startBackgroundApp();
