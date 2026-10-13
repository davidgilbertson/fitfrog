import {mergeTodayTicks} from '../src/model.js';

export function resolveSave(current, {log, baseSavedAt, today}) {
  // Older app versions don't send today; leave their existing save behavior alone.
  if (current && today && current.savedAt !== baseSavedAt) {
    mergeTodayTicks(log, current.log, today);
  }
  return {savedAt: Date.now(), log};
}
