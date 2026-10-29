import { fromZonedTime, toZonedTime } from "date-fns-tz";

/** "2026-11-03T09:30" interpretado no fuso do usuário -> instante UTC. */
export const localToUtc = (local: string, tz = "America/Sao_Paulo") => fromZonedTime(local, tz);
export const utcToLocal = (d: Date, tz = "America/Sao_Paulo") => toZonedTime(d, tz);

/** Backoff progressivo: 1, 2, 4, 8, 16 min (máx. 5 tentativas). */
export const backoffMs = (attempt: number) => Math.min(2 ** (attempt - 1), 16) * 60_000;
export const MAX_ATTEMPTS = 5;
