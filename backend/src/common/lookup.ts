/**
 * A picker option. Kept apart from the paged list endpoints: a dropdown fed by
 * page one would make record 101 unselectable with nothing on screen to say so
 * (SRS NFR-13.5 — the register pages, the pickers do not).
 */
export type LookupOption = {
  id: number;
  label: string;
};
