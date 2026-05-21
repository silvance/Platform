import { Readable } from "node:stream";
import { ArtifactsService } from "./artifacts.service";
import type { PrismaService } from "../database/prisma.service";
import type { ArtifactStorage } from "./storage/artifact-storage";

function makeFakeStorage(): ArtifactStorage {
  return {
    read: jest.fn(async () => Readable.from(Buffer.from("X"))),
    exists: jest.fn(async () => true),
    size: jest.fn(async () => 1),
    write: jest.fn(async () => undefined),
  };
}

function makeFakePrisma(rows: Array<Record<string, unknown>>): PrismaService {
  return {
    artifact: {
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        return rows.find((r) => r["id"] === args.where.id) ?? null;
      }),
    },
  } as unknown as PrismaService;
}

const BASE_ARTIFACT = {
  id: "11111111-1111-1111-1111-111111111111",
  scenarioId: "ssssssss-ssss-ssss-ssss-ssssssssssss",
  ordinal: 1,
  displayName: "log.csv",
  kind: "csv",
  relativePath: "scenarios/x/log.csv",
  sha256: "a".repeat(64),
  sizeBytes: 1,
  mimeType: "text/csv; charset=utf-8",
  viewerHint: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  scenario: { slug: "my-scenario", status: "published" },
};

describe("ArtifactsService (unit)", () => {
  it("returns the stream + metadata for a matching published scenario", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT }]),
      makeFakeStorage(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r).not.toBeNull();
    expect(r!.mimeType).toBe("text/csv; charset=utf-8");
    expect(r!.contentDisposition).toBe("attachment");
    expect(r!.sha256).toBe("a".repeat(64));
  });

  it("uses inline disposition for PDF and image kinds", async () => {
    const svcPdf = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT, kind: "pdf", mimeType: "application/pdf" }]),
      makeFakeStorage(),
    );
    const r1 = await svcPdf.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r1!.contentDisposition).toBe("inline");

    const svcImg = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT, kind: "image", mimeType: "image/png" }]),
      makeFakeStorage(),
    );
    const r2 = await svcImg.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r2!.contentDisposition).toBe("inline");
  });

  it("returns null when the slug in the URL does not match the artifact's parent (no leak across scenarios)", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT }]),
      makeFakeStorage(),
    );
    const r = await svc.streamArtifact("trainee", "wrong-scenario", BASE_ARTIFACT.id);
    expect(r).toBeNull();
  });

  it("returns null for a trainee accessing a draft scenario's artifact (404 not 403)", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([
        { ...BASE_ARTIFACT, scenario: { slug: "my-scenario", status: "draft" } },
      ]),
      makeFakeStorage(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r).toBeNull();
  });

  it("instructors can access draft-scenario artifacts", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([
        { ...BASE_ARTIFACT, scenario: { slug: "my-scenario", status: "draft" } },
      ]),
      makeFakeStorage(),
    );
    const r = await svc.streamArtifact("instructor", "my-scenario", BASE_ARTIFACT.id);
    expect(r).not.toBeNull();
  });

  it("returns null for an unknown artifact id", async () => {
    const svc = new ArtifactsService(makeFakePrisma([]), makeFakeStorage());
    const r = await svc.streamArtifact(
      "instructor",
      "my-scenario",
      "00000000-0000-0000-0000-000000000000",
    );
    expect(r).toBeNull();
  });
});
