import { AccessCodesService } from "./access-codes.service";
import type { PrismaService } from "../database/prisma.service";

// validate-and-consume covers all the rejection paths the
// registration flow collapses into a single 400.

function makeFakeTx() {
  const accessCode = {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  return { accessCode };
}

function makeService(): AccessCodesService {
  // We never call list/create/disable in this suite; null is fine.
  return new AccessCodesService(null as unknown as PrismaService);
}

describe("AccessCodesService.validateAndConsume", () => {
  it("returns null when the code does not exist", async () => {
    const tx = makeFakeTx();
    tx.accessCode.findUnique.mockResolvedValue(null);
    const result = await makeService().validateAndConsume(tx as never, "MISSING");
    expect(result).toBeNull();
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });

  it("returns null when the code is disabled", async () => {
    const tx = makeFakeTx();
    tx.accessCode.findUnique.mockResolvedValue({
      id: "c1",
      disabledAt: new Date(),
      expiresAt: null,
      usesCount: 0,
      usesLimit: null,
      autoApprove: true,
    });
    const result = await makeService().validateAndConsume(tx as never, "OLD-CODE");
    expect(result).toBeNull();
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });

  it("returns null when the code has expired", async () => {
    const tx = makeFakeTx();
    tx.accessCode.findUnique.mockResolvedValue({
      id: "c1",
      disabledAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      usesCount: 0,
      usesLimit: null,
      autoApprove: true,
    });
    const result = await makeService().validateAndConsume(tx as never, "EXP-CODE");
    expect(result).toBeNull();
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });

  it("returns null when usesLimit is exhausted", async () => {
    const tx = makeFakeTx();
    tx.accessCode.findUnique.mockResolvedValue({
      id: "c1",
      disabledAt: null,
      expiresAt: null,
      usesCount: 5,
      usesLimit: 5,
      autoApprove: true,
    });
    const result = await makeService().validateAndConsume(tx as never, "FULL");
    expect(result).toBeNull();
    expect(tx.accessCode.updateMany).not.toHaveBeenCalled();
  });

  it("increments and returns { autoApprove: true } when the code is valid and auto-approves", async () => {
    const tx = makeFakeTx();
    tx.accessCode.findUnique.mockResolvedValue({
      id: "c1",
      disabledAt: null,
      expiresAt: null,
      usesCount: 2,
      usesLimit: 5,
      autoApprove: true,
    });
    tx.accessCode.updateMany.mockResolvedValue({ count: 1 });

    const result = await makeService().validateAndConsume(tx as never, "  OK  ");
    expect(result).toEqual({ autoApprove: true });
    expect(tx.accessCode.updateMany).toHaveBeenCalledTimes(1);
    const args = tx.accessCode.updateMany.mock.calls[0][0];
    expect(args.where.id).toBe("c1");
    expect(args.where.disabledAt).toBeNull();
    expect(args.data.usesCount).toEqual({ increment: 1 });
  });

  it("increments and returns { autoApprove: false } when the code requires approval", async () => {
    const tx = makeFakeTx();
    tx.accessCode.findUnique.mockResolvedValue({
      id: "c2",
      disabledAt: null,
      expiresAt: null,
      usesCount: 0,
      usesLimit: null,
      autoApprove: false,
    });
    tx.accessCode.updateMany.mockResolvedValue({ count: 1 });

    const result = await makeService().validateAndConsume(tx as never, "PENDING-CODE");
    expect(result).toEqual({ autoApprove: false });
  });

  it("returns null when the concurrent-safe update guard finds 0 rows (race lost)", async () => {
    const tx = makeFakeTx();
    tx.accessCode.findUnique.mockResolvedValue({
      id: "c1",
      disabledAt: null,
      expiresAt: null,
      usesCount: 4,
      usesLimit: 5,
      autoApprove: true,
    });
    // A concurrent registration drained the last slot between the
    // read and the conditional update; updateMany hits 0 rows.
    tx.accessCode.updateMany.mockResolvedValue({ count: 0 });

    const result = await makeService().validateAndConsume(tx as never, "RACE");
    expect(result).toBeNull();
  });

  it("returns null on empty/whitespace input without hitting the DB", async () => {
    const tx = makeFakeTx();
    const result = await makeService().validateAndConsume(tx as never, "   ");
    expect(result).toBeNull();
    expect(tx.accessCode.findUnique).not.toHaveBeenCalled();
  });
});
