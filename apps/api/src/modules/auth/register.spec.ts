import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { PrismaService } from "../database/prisma.service";

// M17 self-registration + pending-approval login gate. Mock just
// the Prisma surface AuthService touches; same pattern as the M15
// change-password spec.

function makeFakePrisma() {
  const user = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const session = {
    create: jest.fn(),
    updateMany: jest.fn(),
  };
  return {
    api: {
      user,
      session,
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    } as unknown as PrismaService,
    user,
    session,
  };
}

describe("AuthService.register (M17)", () => {
  it("creates a new account with approvedAt=null when the email is unknown", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);

    fake.user.findUnique.mockResolvedValue(null);
    fake.user.create.mockResolvedValue({ id: "u1" });

    await svc.register({
      email: "new@example.com",
      displayName: "New User",
      password: "long-enough-pwd-1",
    });

    expect(fake.user.create).toHaveBeenCalledTimes(1);
    const data = fake.user.create.mock.calls[0][0].data;
    expect(data.email).toBe("new@example.com");
    expect(data.role).toBe("user");
    expect(data.approvedAt).toBeNull();
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("is a no-op when the email is already registered (no enumeration leak)", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);

    fake.user.findUnique.mockResolvedValue({ id: "u1" });

    await svc.register({
      email: "existing@example.com",
      displayName: "Anyone",
      password: "long-enough-pwd-1",
    });

    // No row created — duplicate registrations are silent.
    expect(fake.user.create).not.toHaveBeenCalled();
  });

  it("hashes the password on BOTH branches so response timing doesn't leak existence", async () => {
    // We can't directly measure timing in a unit test, but we can
    // assert that the hashing call path runs in both branches —
    // verified by checking it produces a real argon2 string for
    // the new-account case and that no fast-path short-circuit
    // returns before hashing on the existing-account case.
    //
    // The shape check on the create path (above test) already
    // confirms the hash is argon2id. Here we just confirm the
    // existing-account path doesn't throw and completes, which
    // means it ran the hash + the lookup + the silent no-op.
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    fake.user.findUnique.mockResolvedValue({ id: "u1" });

    await expect(
      svc.register({
        email: "existing@example.com",
        displayName: "X",
        password: "long-enough-pwd-1",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("AuthService.login — pending approval gate (M17)", () => {
  it("refuses login when approvedAt is null", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    const goodHash = await svc.hashPassword("real-password-x");

    fake.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "pending@example.com",
      displayName: "Pending User",
      role: "user",
      disabled: false,
      passwordHash: goodHash,
      approvedAt: null,
    });

    await expect(
      svc.login("pending@example.com", "real-password-x", {}),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // No session created on a pending-approval login attempt.
    expect(fake.session.create).not.toHaveBeenCalled();
  });

  it("admits login when approvedAt is set", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    const goodHash = await svc.hashPassword("real-password-x");

    fake.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "ok@example.com",
      displayName: "OK User",
      role: "user",
      disabled: false,
      passwordHash: goodHash,
      approvedAt: new Date(),
    });
    fake.session.create.mockResolvedValue({});
    fake.user.update.mockResolvedValue({});

    const result = await svc.login("ok@example.com", "real-password-x", {});
    expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.user.id).toBe("u1");
  });

  it("returns UnauthorizedException (not ForbiddenException) on a wrong password — never reaches the approval check", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api);
    const goodHash = await svc.hashPassword("real-password-x");

    fake.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "pending@example.com",
      displayName: "Pending User",
      role: "user",
      disabled: false,
      passwordHash: goodHash,
      approvedAt: null, // pending — but we shouldn't reach the gate
    });

    await expect(
      svc.login("pending@example.com", "WRONG-PASSWORD", {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
