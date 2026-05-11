console.log('[boot] api/index.ts loading');
import { handle } from 'hono/vercel';
console.log('[boot] hono/vercel imported');
import { createApp } from '../server/app.js';
console.log('[boot] createApp imported');

export const config = {
  runtime: 'nodejs',
};

const app = createApp();
console.log('[boot] app created, exporting handler');

export default handle(app);
