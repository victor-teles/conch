import type { Identified, RecordParser } from "./records.ts";

import { httpEndpointsPath, mcpServersPath } from "./paths.ts";
import { createRecordStore } from "./records.ts";

export const createMcpServerStore = <T extends Identified>(
  parse: RecordParser<T>
) => createRecordStore(mcpServersPath, parse);

export const createHttpEndpointStore = <T extends Identified>(
  parse: RecordParser<T>
) => createRecordStore(httpEndpointsPath, parse);
