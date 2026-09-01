/**
 * Small JSON store: localStorage on the web, a file in the document
 * directory on iOS and Android (expo-file-system).
 */
import { Platform } from 'react-native';

export interface JsonStore {
  read<T>(key: string, fallback: T): Promise<T>;
  write<T>(key: string, value: T): Promise<void>;
}

const webStore: JsonStore = {
  async read(key, fallback) {
    try {
      const raw = globalThis.localStorage?.getItem(`rithmos:${key}`);
      return raw ? (JSON.parse(raw) as typeof fallback) : fallback;
    } catch {
      return fallback;
    }
  },
  async write(key, value) {
    try {
      globalThis.localStorage?.setItem(`rithmos:${key}`, JSON.stringify(value));
    } catch {
      // storage unavailable (private mode): keep going without persistence
    }
  },
};

function fileStore(): JsonStore {
  // required lazily so the web bundle never touches the native module
  const fs = require('expo-file-system') as typeof import('expo-file-system');
  const file = (key: string) => new fs.File(fs.Paths.document, `rithmos-${key}.json`);
  return {
    async read(key, fallback) {
      try {
        const f = file(key);
        if (!f.exists) return fallback;
        return JSON.parse(await f.text()) as typeof fallback;
      } catch {
        return fallback;
      }
    },
    async write(key, value) {
      try {
        file(key).write(JSON.stringify(value));
      } catch {
        // ignore: the game works without persistence
      }
    },
  };
}

export const store: JsonStore = Platform.OS === 'web' ? webStore : fileStore();
