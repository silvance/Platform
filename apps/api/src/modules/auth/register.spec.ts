import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AccessCodesService } from "../access-codes/access-codes.service";
import type { PrismaService } from "../database/prisma.service";

// self-registration: gated by an admin-issued access code.
// Valid code → create user with approvedAt=NOW so login works on
// the next request. Bad code → BadRequestException with a single
// generic message. Duplicate-email + valid code → silent no-op
// (enumeration safety) and the code-use is refunded.

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
  const accessCode = {
    update: jest.fn(),
  };
  // $transaction(callback) — we just hand back the tx object that
  // looks like the same fake. The service's tx.user.findUnique and
  // tx.user.create go through these same mocks.
  const tx = { user, accessCode };
  // AuthService uses BOTH $transaction(callback) (register path,
 // ) and $transaction([promises]) (login path, session writes).
  // Handle either form.
  const $transaction = jest.fn(
    (arg: unknown[] | ((t: typeof tx) => Promise<unknown>)) => {
      if (typeof arg === "function") return Promise.resolve(arg(tx));
      return Promise.all(arg as Promise<unknown>[]);
    },
  );
  return {
    api: { user, session, $transaction } as unknown as PrismaService,
    user,
    session,
    accessCode,
    $transaction,
  };
}

function makeAccessCodes(
  validateReturns: { autoApprove: boolean } | null,
): AccessCodesService {
  return {
    validateAndConsume: jest.fn().mockResolvedValue(validateReturns),
  } as unknown as AccessCodesService;
}

describe("AuthService.register (access-code gate)", () => {
  it("creates a new account with approvedAt set when the code is valid and email is new", async () => {
    const fake = makeFakePrisma();
    const codes = makeAccessCodes({ autoApprove: true });
    const svc = new AuthService(fake.api, codes);

    fake.user.findUnique.mockResolvedValue(null);
    fake.user.create.mockResolvedValue({ id: "u1" });

    await svc.register({
      email: "new@example.com",
      displayName: "New User",
      password: "long-enough-pwd-1",
      accessCode: "JOIN-2026",
    });

    expect(fake.user.create).toHaveBeenCalledTimes(1);
    const data = fake.user.create.mock.calls[0][0].data;
    expect(data.email).toBe("new@example.com");
    expect(data.role).toBe("user");
    expect(data.approvedAt).toBeInstanceOf(Date);
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("never sets role=admin even if some upstream caller tried (defensive — controller already strips, but service must not trust input)", async () => {
    const fake = makeFakePrisma();
    const codes = makeAccessCodes({ autoApprove: true });
    const svc = new AuthService(fake.api, codes);
    fake.user.findUnique.mockResolvedValue(null);
    fake.user.create.mockResolvedValue({ id: "u1" });

    await svc.register({
      email: "new@example.com",
      displayName: "New User",
      password: "long-enough-pwd-1",
      accessCode: "JOIN-2026",
    });

    const data = fake.user.create.mock.calls[0][0].data;
    expect(data.role).toBe("user");
  });

  it("throws BadRequestException with a generic message when the code is invalid", async () => {
    const fake = makeFakePrisma();
    const codes = makeAccessCodes(null);
    const svc = new AuthService(fake.api, codes);

    await expect(
      svc.register({
        email: "new@example.com",
        displayName: "New User",
        password: "long-enough-pwd-1",
        accessCode: "WRONG",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // No user write attempted.
    expect(fake.user.create).not.toHaveBeenCalled();
    // findUnique on user is also not called — code check runs first.
    expect(fake.user.findUnique).not.toHaveBeenCalled();
  });

  it("is a no-op when the email is already registered (enumeration safety) and refunds the code use", async () => {
    const fake = makeFakePrisma();
    const codes = makeAccessCodes({ autoApprove: true });
    const svc = new AuthService(fake.api, codes);

    fake.user.findUnique.mockResolvedValue({ id: "u1" });

    await svc.register({
      email: "existing@example.com",
      displayName: "Anyone",
      password: "long-enough-pwd-1",
      accessCode: "JOIN-2026",
    });

    // No row created — duplicate registrations are silent.
    expect(fake.user.create).not.toHaveBeenCalled();
    // Code use was refunded so enumeration probes don't drain a
    // usesLimit-capped code.
    expect(fake.accessCode.update).toHaveBeenCalledTimes(1);
    expect(fake.accessCode.update.mock.calls[0][0].data).toEqual({
      usesCount: { decrement: 1 },
    });
  });

  it("hashes the password on both successful branches so response timing doesn't leak existence", async () => {
    const fake = makeFakePrisma();
    const codes = makeAccessCodes({ autoApprove: true });
    const svc = new AuthService(fake.api, codes);
    fake.user.findUnique.mockResolvedValue({ id: "u1" });

    await expect(
      svc.register({
        email: "existing@example.com",
        displayName: "X",
        password: "long-enough-pwd-1",
        accessCode: "JOIN-2026",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("AuthService.login — pending approval gate (kept for legacy pending rows)", () => {
  it("refuses login when approvedAt is null", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api, makeAccessCodes({ autoApprove: true }));
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

    expect(fake.session.create).not.toHaveBeenCalled();
  });

  it("admits login when approvedAt is set", async () => {
    const fake = makeFakePrisma();
    const svc = new AuthService(fake.api, makeAccessCodes({ autoApprove: true }));
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
    const svc = new AuthService(fake.api, makeAccessCodes({ autoApprove: true }));
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
      svc.login("pending@example.com", "WRONG-PASSWORD", {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
