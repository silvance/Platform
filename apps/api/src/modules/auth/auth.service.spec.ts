import { AuthService } from "./auth.service";
import type { AccessCodesService } from "../access-codes/access-codes.service";
import type { PrismaService } from "../database/prisma.service";

// We test the pure helpers that don't touch the DB. Login/session flows
// will get integration tests once a test Postgres is wired up — out of
// scope for M1, which uses Jest unit tests only.
// Read the private `dummyHash` field for invariant checks without
// adding a test-only public method to the production service.
function peekDummyHash(svc: AuthService): string | null {
  return (svc as unknown as { dummyHash: string | null }).dummyHash;
}

// AccessCodesService isn't exercised by any of the pure-helper tests
// below — a bare stub keeps the constructor happy.
const stubAccessCodes = {} as unknown as AccessCodesService;

describe("AuthService (unit)", () => {
  const fakePrisma = {} as unknown as PrismaService;
  const svc = new AuthService(fakePrisma, stubAccessCodes);

  describe("password hashing", () => {
    it("hashes a password and verifies the same password", async () => {
      const hash = await svc.hashPassword("correct horse battery staple");
      expect(hash).toMatch(/^\$argon2id\$/);
      expect(await svc.verifyPassword(hash, "correct horse battery staple")).toBe(true);
    });

    it("rejects an incorrect password", async () => {
      const hash = await svc.hashPassword("expected");
      expect(await svc.verifyPassword(hash, "wrong")).toBe(false);
    });

    it("returns false rather than throwing on malformed hashes", async () => {
      expect(await svc.verifyPassword("not-a-real-hash", "anything")).toBe(false);
    });
  });

  describe("token hashing", () => {
    it("produces a hex SHA-256 of the input", () => {
      // sha256("hello") known value
      expect(svc.hashToken("hello")).toBe(
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      );
    });

    it("produces the same hash for the same token", () => {
      const t = "abc.def.ghi";
      expect(svc.hashToken(t)).toBe(svc.hashToken(t));
    });

    it("produces different hashes for different tokens", () => {
      expect(svc.hashToken("a")).not.toBe(svc.hashToken("b"));
    });
  });

  describe("user-enumeration mitigation (dummy hash)", () => {
    it("onModuleInit populates a real argon2id hash", async () => {
      await svc.onModuleInit();
      const dummy = peekDummyHash(svc);
      expect(dummy).not.toBeNull();
      expect(dummy).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[^$]+\$[^$]+$/);
    });

    it("verifyAgainstDummy returns false without throwing", async () => {
      await svc.onModuleInit();
      await expect(svc.verifyAgainstDummy("anything")).resolves.toBe(false);
      await expect(svc.verifyAgainstDummy("")).resolves.toBe(false);
    });

    it("falls back to lazy init if onModuleInit was skipped", async () => {
      // Construct a fresh instance, deliberately skipping onModuleInit.
      const fresh = new AuthService(fakePrisma, stubAccessCodes);
      expect(peekDummyHash(fresh)).toBeNull();
      await expect(fresh.verifyAgainstDummy("anything")).resolves.toBe(false);
      expect(peekDummyHash(fresh)).toMatch(/^\$argon2id\$/);
    });
  });

  describe("constantTimeEqualHex", () => {
    it("returns true for identical hex strings", () => {
      expect(AuthService.constantTimeEqualHex("deadbeef", "deadbeef")).toBe(true);
    });

    it("returns false for different hex strings of equal length", () => {
      expect(AuthService.constantTimeEqualHex("deadbeef", "feedface")).toBe(false);
    });

    it("returns false for hex strings of different lengths", () => {
      expect(AuthService.constantTimeEqualHex("dead", "deadbeef")).toBe(false);
    });
  });
});
