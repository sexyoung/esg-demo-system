import { createApp } from '../server/app.js';

export const config = {
  runtime: 'nodejs',
};

const app = createApp();

export default app.fetch;
