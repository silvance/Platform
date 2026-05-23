import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { PrismaService } from "../database/prisma.service";

// Focused integration-style spec for the M15 password-change paths.
// Mocks just the prisma calls we touch — same shape the AuthService
// itself uses, no separate Prisma instance.

function makeFakePrisma() {
  const user = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const session = {
    updateMany: jest.fn(),
  };
  return {
    api: { user, session } as unknown as PrismaService,
    user,
    session,
  };
}

describe("AuthService.changePassword", () => {
  it("updates the hash and revokes other sessions when the current password is correct", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    const currentHash = await svc.hashPassword("correct password");

    fake.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: currentHash,
    });
    fake.user.update.mockResolvedValue({});
    fake.session.updateMany.mockResolvedValue({ count: 3 });

    const result = await svc.changePassword(
      "u1",
      "session-abc",
      "correct password",
      "brand new password",
    );

    expect(result.revokedSessions).toBe(3);
    expect(fake.user.update).toHaveBeenCalledTimes(1);
    const updateArgs = fake.user.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "u1" });
    expect(updateArgs.data.passwordHash).toMatch(/^\$argon2id\$/);

    // Sessions: revoke ALL active sessions for this user EXCEPT
    // the one referenced by sessionId.
    expect(fake.session.updateMany).toHaveBeenCalledTimes(1);
    const sessArgs = fake.session.updateMany.mock.calls[0][0];
    expect(sessArgs.where.userId).toBe("u1");
    expect(sessArgs.where.revokedAt).toBeNull();
    expect(sessArgs.where.NOT).toEqual({ id: "session-abc" });
    expect(sessArgs.data.revokedAt).toBeInstanceOf(Date);
  });

  it("throws UnauthorizedException and does not touch the DB when the current password is wrong", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    const currentHash = await svc.hashPassword("real");

    fake.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: currentHash,
    });

    await expect(
      svc.changePassword("u1", "session-abc", "WRONG", "new password long"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fake.user.update).not.toHaveBeenCalled();
    expect(fake.session.updateMany).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException when the user row vanished (no user-id enumeration)", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);

    fake.user.findUnique.mockResolvedValue(null);

    await expect(
      svc.changePassword("ghost-id", "session-abc", "anything", "new password long"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fake.user.update).not.toHaveBeenCalled();
    expect(fake.session.updateMany).not.toHaveBeenCalled();
  });
});

describe("AuthService.revokeAllSessionsForUser", () => {
  it("revokes every active session when keepSessionId is null", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    fake.session.updateMany.mockResolvedValue({ count: 5 });

    const result = await svc.revokeAllSessionsForUser("u1", null);

    expect(result.revoked).toBe(5);
    const where = fake.session.updateMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.revokedAt).toBeNull();
    // No NOT clause when keepSessionId is null — full revoke.
    expect(where.NOT).toBeUndefined();
  });

  it("excludes the kept session id from the revoke set", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    fake.session.updateMany.mockResolvedValue({ count: 2 });

    await svc.revokeAllSessionsForUser("u1", "keep-me");

    const where = fake.session.updateMany.mock.calls[0][0].where;
    expect(where.NOT).toEqual({ id: "keep-me" });
  });
});
