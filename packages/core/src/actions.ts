import type { Identified, RecordParser } from "./records.ts";

import { actionsPath, writePermissionsPath } from "./paths.ts";
import { createRecordStore, updateRecords } from "./records.ts";

interface ActionRecord extends Identified {
  widgetId: string;
}

interface PermissionRecord extends Identified {
  kind: string;
  targetId: string;
}

const belongsTo = (raw: unknown, widgetId: string): boolean =>
  typeof raw === "object" &&
  raw !== null &&
  (raw as { widgetId?: unknown }).widgetId === widgetId;

export const createActionStore = <T extends ActionRecord>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(actionsPath, parse);
  return {
    get: store.get,
    async listForWidget(widgetId: string): Promise<T[]> {
      const actions = await store.list();
      return actions.filter((action) => action.widgetId === widgetId);
    },
    remove: store.remove,
    removeForWidget: (widgetId: string): Promise<void> =>
      updateRecords(actionsPath(), (records) =>
        records.filter((record) => !belongsTo(record, widgetId))
      ),
    save: store.save,
  };
};

export const permissionKey = (kind: string, targetId: string): string =>
  `${kind}:${targetId}`;

export const createPermissionStore = <T extends PermissionRecord>(
  parse: RecordParser<T>
) => {
  const store = createRecordStore(writePermissionsPath, parse);
  return {
    async isAllowed(kind: string, targetId: string): Promise<boolean> {
      return (await store.get(permissionKey(kind, targetId))) !== null;
    },
    list: store.list,
    remove: (kind: string, targetId: string): Promise<void> =>
      store.remove(permissionKey(kind, targetId)),
    async removeWhere(matches: (record: T) => boolean): Promise<void> {
      const records = await store.list();
      const doomed = new Set(
        records.filter(matches).map((record) => record.id)
      );
      if (doomed.size > 0) {
        await updateRecords(writePermissionsPath(), (stored) =>
          stored.filter((record) => !doomed.has(record.id))
        );
      }
    },
    save: store.save,
  };
};
