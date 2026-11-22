import type { Identified, RecordParser } from "./records.ts";

import { themesPath } from "./paths.ts";
import { createRecordStore } from "./records.ts";

export const createThemeStore = <T extends Identified>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(themesPath, parse);
  return {
    deleteTheme: store.remove,
    getTheme: store.get,
    listThemes: store.list,
    saveTheme: store.save,
  };
};
