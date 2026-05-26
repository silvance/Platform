import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { UsersService } from "./users.service";
import { AuthService } from "../auth/auth.service";
import type { PrismaService } from "../database/prisma.service";

function makeFakePrisma() {
  const user = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };
  const session = {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  return {
    api: { user, session } as unknown as PrismaService,
    user,
    session,
  };
}

function makeAuth(prisma: PrismaService): AuthService {
  // AccessCodesService is only consumed by AuthService.register,
  // which isn't exercised in the UsersService suite. A bare stub
  // with a validateAndConsume that always succeeds is enough to
  // satisfy the constructor signature without pulling in a real
  // database fixture.
  const accessCodes = {
    validateAndConsume: jest.fn().mockResolvedValue(true),
  } as unknown as import("../access-codes/access-codes.service").AccessCodesService;
  return new AuthService(prisma, accessCodes);
}

const ROW = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "u1",
  email: "user@example.com",
  displayName: "Test User",
  role: "user",
  disabled: false,
  approvedAt: new Date("2026-05-01T00:00:00Z"),
  createdAt: new Date("2026-05-01T00:00:00Z"),
  lastLoginAt: null,
  ...over,
});

describe("UsersService", () => {
  describe("list", () => {
    it("returns the public projection (no passwordHash)", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findMany.mockResolvedValue([ROW()]);

      const rows = await svc.list();
      expect(rows).toHaveLength(1);
      const first = rows[0]!;
      expect(first).not.toHaveProperty("passwordHash");
      expect(first.createdAt).toBe("2026-05-01T00:00:00.000Z");
    });
  });

  describe("create", () => {
    it("hashes the password and returns the public projection", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.create.mockResolvedValue(ROW({ email: "new@x.com" }));

      const result = await svc.create({
        email: "new@x.com",
        displayName: "X",
        role: "user",
        password: "long-enough-pw",
      });

      expect(result.email).toBe("new@x.com");
      const args = fake.user.create.mock.calls[0][0];
      // The hash must be an argon2id string; never echo plaintext.
      expect(args.data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(args.data.passwordHash).not.toContain("long-enough-pw");
    });

    it("turns a Prisma unique-violation into a 409 ConflictException", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      await expect(
        svc.create({
          email: "dup@x.com",
          displayName: "X",
          role: "user",
          password: "long-enough-pw",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("update", () => {
    it("refuses to let an admin disable themselves", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue(ROW({ id: "self", role: "admin" }));

      await expect(
        svc.update("self", "self", { disabled: true }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(fake.user.update).not.toHaveBeenCalled();
    });

    it("refuses to demote the last admin", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue(
        ROW({ id: "admin1", role: "admin" }),
      );
      // No OTHER enabled admin in the system.
      fake.user.count.mockResolvedValue(0);

      await expect(
        svc.update("other-admin", "admin1", { role: "user" }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(fake.user.update).not.toHaveBeenCalled();
    });

    it("allows demotion when at least one other enabled admin remains", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue(
        ROW({ id: "admin1", role: "admin" }),
      );
      fake.user.count.mockResolvedValue(1);
      fake.user.update.mockResolvedValue(
        ROW({ id: "admin1", role: "user" }),
      );

      const out = await svc.update("admin2", "admin1", { role: "user" });
      expect(out.role).toBe("user");
    });

    it("kills sessions when an admin disables another user", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue(ROW({ id: "u2", role: "user" }));
      fake.user.update.mockResolvedValue(ROW({ id: "u2", disabled: true }));

      await svc.update("admin1", "u2", { disabled: true });

      expect(fake.session.updateMany).toHaveBeenCalledTimes(1);
      const where = fake.session.updateMany.mock.calls[0][0].where;
      expect(where.userId).toBe("u2");
      // Full revoke — no NOT clause to keep any session alive.
      expect(where.NOT).toBeUndefined();
    });
  });

  describe("resetPassword", () => {
    it("404s when the target user doesn't exist", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue(null);

      await expect(
        svc.resetPassword("ghost", "long-enough-pw"),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(fake.user.update).not.toHaveBeenCalled();
    });

    it("hashes the new password and revokes ALL of the target's sessions", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue({ id: "u2" });
      fake.user.update.mockResolvedValue(ROW({ id: "u2" }));
      fake.session.updateMany.mockResolvedValue({ count: 7 });

      const out = await svc.resetPassword("u2", "long-enough-pw");

      expect(out.revokedSessions).toBe(7);
      const updateData = fake.user.update.mock.calls[0][0].data;
      expect(updateData.passwordHash).toMatch(/^\$argon2id\$/);
      const sessWhere = fake.session.updateMany.mock.calls[0][0].where;
      expect(sessWhere.userId).toBe("u2");
      expect(sessWhere.NOT).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("refuses to let the actor delete themselves", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));

      await expect(svc.delete("self", "self")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(fake.user.delete).not.toHaveBeenCalled();
    });

    it("404s when the target doesn't exist", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue(null);

      await expect(svc.delete("admin1", "ghost")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fake.user.delete).not.toHaveBeenCalled();
    });

    it("refuses to delete the last enabled admin", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue({ id: "admin1", role: "admin" });
      fake.user.count.mockResolvedValue(0);

      await expect(
        svc.delete("other-admin", "admin1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fake.user.delete).not.toHaveBeenCalled();
    });

    it("deletes a regular user without consulting the last-admin guard", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue({ id: "u2", role: "user" });
      fake.user.delete.mockResolvedValue(undefined);

      await svc.delete("admin1", "u2");

      expect(fake.user.count).not.toHaveBeenCalled();
      expect(fake.user.delete).toHaveBeenCalledWith({ where: { id: "u2" } });
    });
  });

  describe("approve (M17)", () => {
    it("404s when the target user doesn't exist", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue(null);

      await expect(svc.approve("ghost")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fake.user.update).not.toHaveBeenCalled();
    });

    it("sets approvedAt = NOW for a pending user", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      fake.user.findUnique.mockResolvedValue({ id: "u3", approvedAt: null });
      fake.user.update.mockResolvedValue(
        ROW({ id: "u3", approvedAt: new Date("2026-05-23T10:00:00Z") }),
      );

      const out = await svc.approve("u3");
      expect(out.approvedAt).toBe("2026-05-23T10:00:00.000Z");

      const updateData = fake.user.update.mock.calls[0][0].data;
      expect(updateData.approvedAt).toBeInstanceOf(Date);
    });

    it("is a no-op (no second write) when the user is already approved", async () => {
      const fake = makeFakePrisma();
      const svc = new UsersService(fake.api, makeAuth(fake.api));
      const already = new Date("2026-05-20T08:00:00Z");
      // First findUnique = approve() pre-check.
      // Second findUnique = the get() re-read for the canonical row.
      fake.user.findUnique
        .mockResolvedValueOnce({ id: "u3", approvedAt: already })
        .mockResolvedValueOnce(ROW({ id: "u3", approvedAt: already }));

      const out = await svc.approve("u3");
      expect(out.approvedAt).toBe("2026-05-20T08:00:00.000Z");
      // Critical: NO update call — the canonical approval time isn't
      // re-bumped on re-approve. Audit trail keeps the original.
      expect(fake.user.update).not.toHaveBeenCalled();
    });
  });
});
