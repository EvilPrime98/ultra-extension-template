import { listen } from './core/listen';
import { logger } from './core/middleware';
import { Receptor } from './core/receptor';
import { createPageController } from './controllers/page.controller';

function startApp() {

    const app = new Receptor();
    
    app.use(logger)
    
    app.route('/page', createPageController());

    listen(app);

}

startApp();