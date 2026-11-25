import { createApp } from './app.js';
import { config } from './config/index.js';

// 0.0.0.0 inside the container; docker-compose.yml publishes it to 127.0.0.1 only.
createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`Customer portal: ${config.appBaseUrl.origin}`);
  console.log(`Staff portal:    ${config.staffBaseUrl.origin}`);
});
