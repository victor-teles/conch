import type { Identified, RecordParser } from "./records.ts";

import { miniAppsPath } from "./paths.ts";
import { createRecordStore } from "./records.ts";

export const createMiniAppStore = <T extends Identified>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(miniAppsPath, parse);
  return {
    deleteMiniApp: store.remove,
    getMiniApp: store.get,
    listMiniApps: store.list,
    saveMiniApp: store.save,
    updateMiniApp: store.update,
  };
};
