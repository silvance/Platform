import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { AccessCodeRecord } from "@ci-train/contracts";

// admin CRUD + the registration-time validate-and-consume
// path for registration access codes.
//
// Codes are stored plaintext: the admin re-reads them to share
// with new cohorts. They never appear in any user-facing payload.

@Injectable()
export class AccessCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AccessCodeRecord[]> {
    const rows = await this.prisma.accessCode.findMany({
      orderBy: [{ disabledAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    });
    return rows.map(toRecord);
  }

  async create(actorUserId: string, input: {
    label: string;
    code?: string;
    usesLimit?: number;
    expiresAt?: string;
    autoApprove?: boolean;
  }): Promise<AccessCodeRecord> {
    const code = input.code?.trim() ? input.code.trim() : generateCode();
    try {
      const row = await this.prisma.accessCode.create({
        data: {
          code,
          label: input.label,
          createdByUserId: actorUserId,
          usesLimit: input.usesLimit ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          // Omit to take the DB default (true). Caller passes false to
          // mint a "register and wait for admin approval" code.
          ...(input.autoApprove !== undefined
            ? { autoApprove: input.autoApprove }
            : {}),
        },
      });
      return toRecord(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException(
          "That code is already in use. Pick a different value or omit `code` to have one generated.",
        );
      }
      throw err;
    }
  }

  async disable(id: string): Promise<AccessCodeRecord> {
    const existing = await this.prisma.accessCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Access code not found.");
    if (existing.disabledAt !== null) {
      // Idempotent: already disabled, return as-is rather than 409.
      return toRecord(existing);
    }
    const row = await this.prisma.accessCode.update({
      where: { id },
      data: { disabledAt: new Date() },
    });
    return toRecord(row);
  }

  // The registration-time entry point. Runs inside a transaction so
  // the validity check + uses-count increment can't race against a
  // concurrent registration attempt that would push us past
  // usesLimit.
  //
  // Returns `{ autoApprove }` on success so the caller can decide
  // whether to set the new user's approvedAt at create-time. Returns
  // null for ALL failure modes (missing, wrong, disabled, expired,
  // exhausted) so the caller can map to a single generic 400 message
  // without distinguishing why.
  async validateAndConsume(
    tx: Prisma.TransactionClient,
    rawCode: string,
  ): Promise<{ autoApprove: boolean } | null> {
    const code = rawCode.trim();
    if (!code) return null;
    const row = await tx.accessCode.findUnique({ where: { code } });
    if (!row) return null;
    if (row.disabledAt !== null) return null;
    if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    if (row.usesLimit !== null && row.usesCount >= row.usesLimit) {
      return null;
    }
    // Atomic conditional increment via a WHERE guard. If a concurrent
    // call drained the last available use between our read and this
    // update, the updateMany hits 0 rows and we report failure.
    const whereGuard: Prisma.AccessCodeWhereInput = {
      id: row.id,
      disabledAt: null,
      ...(row.expiresAt !== null ? { expiresAt: { gt: new Date() } } : {}),
      ...(row.usesLimit !== null
        ? { usesCount: { lt: row.usesLimit } }
        : {}),
    };
    const result = await tx.accessCode.updateMany({
      where: whereGuard,
      data: { usesCount: { increment: 1 } },
    });
    if (result.count !== 1) return null;
    return { autoApprove: row.autoApprove };
  }
}

function toRecord(row: {
  id: string;
  code: string;
  label: string;
  disabledAt: Date | null;
  expiresAt: Date | null;
  usesCount: number;
  usesLimit: number | null;
  autoApprove: boolean;
  createdAt: Date;
  createdByUserId: string | null;
}): AccessCodeRecord {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    disabledAt: row.disabledAt ? row.disabledAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    usesCount: row.usesCount,
    usesLimit: row.usesLimit,
    autoApprove: row.autoApprove,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
  };
}

// 10-char crockford-base32-ish alphabet (no I/L/O/0/1 to avoid
// dictation confusion). Generated codes are server-side; the admin
// can also choose their own via the `code` field on create.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateCode(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    const byte = bytes[i] ?? 0;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}
