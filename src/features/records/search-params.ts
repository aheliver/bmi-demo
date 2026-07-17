import { createLoader, parseAsInteger } from "nuqs/server"

export const recordsSearchParams = {
  page: parseAsInteger.withDefault(1),
}

export const loadRecordsSearchParams = createLoader(recordsSearchParams)
