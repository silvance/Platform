import { Readable } from "node:stream";
import { ArtifactsService } from "./artifacts.service";
import type { PrismaService } from "../database/prisma.service";
import type { ArtifactStorage } from "./storage/artifact-storage";
import type { EmlParseService } from "./eml-parse.service";

function makeFakeStorage(): ArtifactStorage {
  return {
    read: jest.fn(async () => Readable.from(Buffer.from("X"))),
    exists: jest.fn(async () => true),
    size: jest.fn(async () => 1),
    write: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  };
}

// EML parsing isn't exercised by the streaming-side tests; pass an
// inert stub so the new constructor signature still satisfies DI.
function makeFakeEmlParse(): EmlParseService {
  return {
    parse: jest.fn(async () => {
      throw new Error("EML parsing not stubbed in this test");
    }),
  } as unknown as EmlParseService;
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

describe("ArtifactsService — canonical MIME (audit #1)", () => {
  it("ignores a stale/malicious text/html DB MIME and serves text/plain", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT, kind: "text", mimeType: "text/html" }]),
      makeFakeStorage(),
  makeFakeEmlParse(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r!.mimeType).toBe("text/plain; charset=utf-8");
    expect(r!.contentDisposition).toBe("attachment");
    // The DB-recorded MIME is still surfaced for audit but never used as Content-Type.
    expect(r!.storedMimeType).toBe("text/html");
  });

  it("ignores application/javascript on a JSON artifact and serves application/json", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([
        { ...BASE_ARTIFACT, kind: "json", mimeType: "application/javascript" },
      ]),
      makeFakeStorage(),
  makeFakeEmlParse(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r!.mimeType).toBe("application/json; charset=utf-8");
    expect(r!.contentDisposition).toBe("attachment");
  });

  it("forces application/pdf on kind=pdf regardless of DB MIME", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([
        { ...BASE_ARTIFACT, kind: "pdf", mimeType: "text/html" },
      ]),
      makeFakeStorage(),
  makeFakeEmlParse(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r!.mimeType).toBe("application/pdf");
    expect(r!.contentDisposition).toBe("inline");
  });

  it("allows image/png as inline", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([
        { ...BASE_ARTIFACT, kind: "image", mimeType: "image/png" },
      ]),
      makeFakeStorage(),
  makeFakeEmlParse(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r!.mimeType).toBe("image/png");
    expect(r!.contentDisposition).toBe("inline");
  });

  it("rejects image/svg+xml — downgrades to octet-stream + attachment (SVG can carry script)", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([
        { ...BASE_ARTIFACT, kind: "image", mimeType: "image/svg+xml" },
      ]),
      makeFakeStorage(),
  makeFakeEmlParse(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r!.mimeType).toBe("application/octet-stream");
    expect(r!.contentDisposition).toBe("attachment");
  });

  it("strips parameters and lower-cases when matching image MIME allowlist", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([
        { ...BASE_ARTIFACT, kind: "image", mimeType: "Image/JPEG; charset=binary" },
      ]),
      makeFakeStorage(),
  makeFakeEmlParse(),
    );
    const r = await svc.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r!.mimeType).toBe("image/jpeg");
    expect(r!.contentDisposition).toBe("inline");
  });
});

describe("ArtifactsService (unit)", () => {
  it("returns the stream + metadata for a matching published scenario", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT }]),
      makeFakeStorage(),
  makeFakeEmlParse(),
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
  makeFakeEmlParse(),
    );
    const r1 = await svcPdf.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r1!.contentDisposition).toBe("inline");

    const svcImg = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT, kind: "image", mimeType: "image/png" }]),
      makeFakeStorage(),
  makeFakeEmlParse(),
    );
    const r2 = await svcImg.streamArtifact("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r2!.contentDisposition).toBe("inline");
  });

  it("returns null when the slug in the URL does not match the artifact's parent (no leak across scenarios)", async () => {
    const svc = new ArtifactsService(
      makeFakePrisma([{ ...BASE_ARTIFACT }]),
      makeFakeStorage(),
  makeFakeEmlParse(),
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
  makeFakeEmlParse(),
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
  makeFakeEmlParse(),
    );
    const r = await svc.streamArtifact("instructor", "my-scenario", BASE_ARTIFACT.id);
    expect(r).not.toBeNull();
  });

  it("returns null for an unknown artifact id", async () => {
    const svc = new ArtifactsService(makeFakePrisma([]), makeFakeStorage(), makeFakeEmlParse());
    const r = await svc.streamArtifact(
      "instructor",
      "my-scenario",
      "00000000-0000-0000-0000-000000000000",
    );
    expect(r).toBeNull();
  });
});

describe("ArtifactsService.parseEml — size cap (audit #1)", () => {
  const EML_ROW = {
    ...BASE_ARTIFACT,
    kind: "eml",
    mimeType: "message/rfc822",
    scenario: { slug: "my-scenario", status: "published" },
  };

  it("throws PayloadTooLargeException when the EML exceeds MAX_PARSED_EML_BYTES", async () => {
    const oversized = { ...EML_ROW, sizeBytes: 10 * 1024 * 1024 };
    const svc = new ArtifactsService(
      makeFakePrisma([oversized]),
      makeFakeStorage(),
      makeFakeEmlParse(),
    );
    await expect(
      svc.parseEml("trainee", "my-scenario", BASE_ARTIFACT.id),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("permits an EML at the cap boundary", async () => {
    const onLimit = { ...EML_ROW, sizeBytes: 5 * 1024 * 1024 };
    const storage = makeFakeStorage();
    const emlStub = {
      parse: jest.fn(async () => ({
        subject: "ok", from: null, to: [], toTruncated: false,
        cc: [], ccTruncated: false, replyTo: null, returnPath: null,
        date: null, messageId: null,
        authResults: {
          spf: { result: "missing", detail: null },
          dkim: { result: "missing", detail: null },
          dmarc: { result: "missing", detail: null },
        },
        headers: [], headersTruncated: false,
        textBody: null, textBodyTruncated: false,
        htmlBodyBytes: null,
        attachments: [], attachmentsTruncated: false,
      })),
    } as unknown as import("./eml-parse.service").EmlParseService;
    const svc = new ArtifactsService(makeFakePrisma([onLimit]), storage, emlStub);
    const r = await svc.parseEml("trainee", "my-scenario", BASE_ARTIFACT.id);
    expect(r).not.toBeNull();
    expect(emlStub.parse).toHaveBeenCalledTimes(1);
  });

  it("returns null (→ 404) when the artifact doesn't belong to the requested slug — does NOT 413 first", async () => {
    const oversized = { ...EML_ROW, sizeBytes: 10 * 1024 * 1024 };
    const svc = new ArtifactsService(
      makeFakePrisma([oversized]),
      makeFakeStorage(),
      makeFakeEmlParse(),
    );
    const r = await svc.parseEml("trainee", "wrong-scenario", BASE_ARTIFACT.id);
    expect(r).toBeNull();
  });
});
