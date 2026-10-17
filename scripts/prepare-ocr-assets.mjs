import {copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..'),target=resolve(root,'public','ocr');
await mkdir(target,{recursive:true});
await Promise.all([
  copyFile(resolve(root,'node_modules','tesseract.js','dist','worker.min.js'),resolve(target,'worker.min.js')),
  copyFile(resolve(root,'node_modules','tesseract.js-core','tesseract-core-lstm.wasm.js'),resolve(target,'tesseract-core-lstm.wasm.js')),
  copyFile(resolve(root,'node_modules','@tesseract.js-data','por','4.0.0','por.traineddata.gz'),resolve(target,'por.traineddata.gz')),
]);
