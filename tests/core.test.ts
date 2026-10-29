import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "../src/lib/crypto";
import { localToUtc, backoffMs } from "../src/lib/time";
import { MetaError } from "../src/lib/meta";

beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); });

describe("crypto", () => {
  it("round-trip e não expõe o token", () => {
    const c = encryptToken("IGQV-secret");
    expect(c).not.toContain("IGQV");
    expect(decryptToken(c)).toBe("IGQV-secret");
  });
  it("detecta adulteração", () => {
    const [iv, tag, enc] = encryptToken("x").split(".");
    expect(() => decryptToken([iv, tag, Buffer.from("zz").toString("base64")].join("."))).toThrow();
    expect(enc).toBeTruthy();
  });
});
describe("fuso horário", () => {
  it("09:00 em São Paulo = 12:00 UTC (UTC-3, sem horário de verão)", () => {
    expect(localToUtc("2026-11-03T09:00", "America/Sao_Paulo").toISOString()).toBe("2026-11-03T12:00:00.000Z");
  });
  it("respeita outro fuso", () => {
    expect(localToUtc("2026-11-03T09:00", "America/New_York").toISOString()).toBe("2026-11-03T14:00:00.000Z");
  });
});
describe("backoff e classificação de erros", () => {
  it("cresce e limita em 16 min", () => {
    expect([1, 2, 3, 4, 5, 9].map(backoffMs)).toEqual([60e3, 120e3, 240e3, 480e3, 960e3, 960e3]);
  });
  it("classifica códigos da Meta", () => {
    expect(new MetaError(190, undefined, "", 401).kind).toBe("AUTH");
    expect(new MetaError(4, undefined, "", 429).kind).toBe("RATE");
    expect(new MetaError(undefined, undefined, "", 503).kind).toBe("TRANSIENT");
  });
});
