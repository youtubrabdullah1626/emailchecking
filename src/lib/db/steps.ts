/**
 * Steps are managed as part of their parent Sequence.
 * All step DB operations are in src/lib/db/sequences.ts.
 *
 * This file is retained for architectural reference.
 * Import from sequences.ts for all sequence and step operations.
 */

export { getSequence, createSequence, updateSequence, startSequence, deleteSequence } from "@/lib/db/sequences";
export type { SequenceWithSteps } from "@/lib/db/sequences";
