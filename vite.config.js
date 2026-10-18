import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const {version}=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'));
export default defineConfig({base:process.env.GITHUB_ACTIONS?'/tsp/':'/',define:{__APP_VERSION__:JSON.stringify(version)},build:{rollupOptions:{input:{main:resolve(import.meta.dirname,'index.html'),portal:resolve(import.meta.dirname,'portal.html')}}}});
