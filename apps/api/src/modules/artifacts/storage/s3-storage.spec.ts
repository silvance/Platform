// The S3Storage class wires up an AWS SDK client at construction
// time; these tests exercise the path-safety + env-var validation
// logic without instantiating a live S3 client. The actual put /
// get / head / delete plumbing is straight SDK calls and is covered
// by integration tests against a real bucket (out of scope here).

describe("S3Storage env validation", () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  function requireFreshModule(): typeof import("./s3-storage") {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./s3-storage");
  }

  it("throws when S3_BUCKET is missing", () => {
    delete process.env.S3_BUCKET;
    process.env.S3_ACCESS_KEY_ID = "x";
    process.env.S3_SECRET_ACCESS_KEY = "y";
    const { S3Storage } = requireFreshModule();
    expect(() => new S3Storage()).toThrow(/S3_BUCKET/);
  });

  it("throws when credentials are missing", () => {
    process.env.S3_BUCKET = "b";
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    const { S3Storage } = requireFreshModule();
    expect(() => new S3Storage()).toThrow(/S3_ACCESS_KEY_ID/);
  });

  it("constructs successfully when all required env vars are present", () => {
    process.env.S3_BUCKET = "b";
    process.env.S3_ACCESS_KEY_ID = "x";
    process.env.S3_SECRET_ACCESS_KEY = "y";
    const { S3Storage } = requireFreshModule();
    expect(() => new S3Storage()).not.toThrow();
  });
});

describe("S3Storage path safety", () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeAll(() => {
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_ACCESS_KEY_ID = "test-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret";
  });
  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function getInstance(): {
    toKey: (p: string) => string;
    ArtifactPathError: new (...args: never[]) => Error;
  } {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Storage } = require("./s3-storage");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ArtifactPathError } = require("./artifact-storage");
    const inst = new S3Storage();
    return {
      toKey: (p: string) => (inst as never as { toKey: (p: string) => string }).toKey(p),
      ArtifactPathError,
    };
  }

  it("rejects empty path", () => {
    const s = getInstance();
    expect(() => s.toKey("")).toThrow(s.ArtifactPathError);
  });

  it("rejects absolute POSIX path", () => {
    const s = getInstance();
    expect(() => s.toKey("/etc/passwd")).toThrow(s.ArtifactPathError);
  });

  it("rejects path that escapes the root with ..", () => {
    const s = getInstance();
    expect(() => s.toKey("../etc/passwd")).toThrow(s.ArtifactPathError);
  });

  it("normalises backslashes to forward slashes", () => {
    const s = getInstance();
    expect(s.toKey("scenarios\\sub\\file.txt")).toBe(
      "scenarios/sub/file.txt",
    );
  });

  it("accepts a normal scenarios/<id>/<file> path", () => {
    const s = getInstance();
    expect(s.toKey("scenarios/abc-123/file.csv")).toBe(
      "scenarios/abc-123/file.csv",
    );
  });
});

describe("S3Storage key prefix handling", () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_ACCESS_KEY_ID = "test-key";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  function build(): { toKey: (p: string) => string } {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Storage } = require("./s3-storage");
    const inst = new S3Storage();
    return { toKey: (p: string) => (inst as never as { toKey: (p: string) => string }).toKey(p) };
  }

  it("prepends the configured prefix with trailing slash", () => {
    process.env.S3_KEY_PREFIX = "prod";
    expect(build().toKey("scenarios/x/a.txt")).toBe(
      "prod/scenarios/x/a.txt",
    );
  });

  it("normalises a prefix that the operator supplied with a slash", () => {
    process.env.S3_KEY_PREFIX = "/prod/";
    expect(build().toKey("scenarios/x/a.txt")).toBe(
      "prod/scenarios/x/a.txt",
    );
  });

  it("treats an empty prefix as none", () => {
    delete process.env.S3_KEY_PREFIX;
    expect(build().toKey("scenarios/x/a.txt")).toBe(
      "scenarios/x/a.txt",
    );
  });
});
