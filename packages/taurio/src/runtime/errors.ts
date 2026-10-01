/** A thrown value as text for the user: the message of an Error, otherwise the value. */
export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
