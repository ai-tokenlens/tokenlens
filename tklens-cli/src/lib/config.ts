import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface Config {
  endpoint?: string;
  apiKey?: string;
  userId?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.tklens');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function readConfig(): Config {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
