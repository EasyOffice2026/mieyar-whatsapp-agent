import fs from 'fs';
import path from 'path';
import { config } from './config.js';

/** A Map mirrored to DATA_DIR/<name>.json (debounced) so a restart loses nothing. */
export const createStore = (name) => {
  const file = config.dataDir ? path.join(config.dataDir, `${name}.json`) : null;
  const map = new Map();
  if (file && fs.existsSync(file)) {
    try {
      for (const [key, value] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) map.set(key, value);
    } catch (error) {
      console.error(`[store] could not read ${file}`, error.message);
    }
  }
  let timer = null;
  const flush = () => {
    if (!file) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(Object.fromEntries(map)));
      } catch (error) {
        console.error(`[store] could not write ${file}`, error.message);
      }
    }, 200);
  };
  return {
    get: (key) => map.get(key),
    set: (key, value) => { map.set(key, value); flush(); return value; },
    values: () => [...map.values()],
    clear: () => map.clear(),
  };
};
