// Dev entry only — mounts the visual test harness (src/dev/harness.vue).
// The shipped library is built from src/index.js (see vite.config.js lib.entry); this file is
// never bundled into dist. Run `yarn dev` and use the in-page nav to switch BL2/BSL × tags/single.
import { createApp } from 'vue';
import Harness from '@/dev/harness.vue';

createApp(Harness).mount('#app');
