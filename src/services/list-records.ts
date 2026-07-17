import type { RecordsQuery, RecordsResponse } from "@/domain/record"
import { listParticipants } from "@/infrastructure/participant-repo"

export async function listRecords(query: RecordsQuery): Promise<RecordsResponse> {
  return listParticipants(query)
}
