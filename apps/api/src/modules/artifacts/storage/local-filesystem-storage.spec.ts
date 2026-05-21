import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileSystemStorage } from "./local-filesystem-storage";
import { ArtifactPathError } from "./artifact-storage";

let tmpRoot: string;
let storage: LocalFileSystemStorage;
let prevEnv: string | undefined;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "citrain-storage-"));
  prevEnv = process.env.ARTIFACT_STORAGE_ROOT;
  process.env.ARTIFACT_STORAGE_ROOT = tmpRoot;
  storage = new LocalFileSystemStorage();
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  if (prevEnv === undefined) {
    delete process.env.ARTIFACT_STORAGE_ROOT;
  } else {
    process.env.ARTIFACT_STORAGE_ROOT = prevEnv;
  }
});

describe("LocalFileSystemStorage — path safety", () => {
  it("rejects absolute paths", async () => {
    await expect(storage.read("/etc/passwd")).rejects.toBeInstanceOf(ArtifactPathError);
  });

  it("rejects parent-traversal escapes (../../etc/passwd)", async () => {
    await expect(storage.read("../../etc/passwd")).rejects.toBeInstanceOf(ArtifactPathError);
  });

  it("rejects mixed traversal (a/../../../etc/passwd)", async () => {
    await expect(storage.read("a/../../../etc/passwd")).rejects.toBeInstanceOf(
      ArtifactPathError,
    );
  });

  it("rejects an empty path", async () => {
    await expect(storage.read("")).rejects.toBeInstanceOf(ArtifactPathError);
  });

  it("allows a normal relative path under root", async () => {
    writeFileSync(join(tmpRoot, "scenarios.txt"), "ok");
    expect(await storage.exists("scenarios.txt")).toBe(true);
    expect(await storage.size("scenarios.txt")).toBe(2);
  });

  it("allows nested paths and round-trips writes", async () => {
    await storage.write("nested/dir/file.txt", Buffer.from("hello"));
    expect(await storage.exists("nested/dir/file.txt")).toBe(true);
    expect(await storage.size("nested/dir/file.txt")).toBe(5);
  });

  it("rejects writes that escape the root", async () => {
    await expect(
      storage.write("../escape.txt", Buffer.from("nope")),
    ).rejects.toBeInstanceOf(ArtifactPathError);
  });

  it("rejects paths whose normalized form equals the root with a sibling collision", async () => {
    // A path like `../citrain-storage-XX-evil/file.txt` that *normalizes*
    // into a sibling directory must be rejected even though it shares the
    // root's prefix textually.
    await expect(
      storage.read(`../foo/file.txt`),
    ).rejects.toBeInstanceOf(ArtifactPathError);
  });
});
