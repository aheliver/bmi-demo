import { parseAsInteger, parseAsStringLiteral } from "nuqs/server"

import { sortField, sortOrder } from "./schema"

export const recordsSearchParsers = {
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(sortField.options).withDefault("createdAt"),
  order: parseAsStringLiteral(sortOrder.options).withDefault("desc"),
}
