import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { BffForwardedThrottlerGuard } from "./bff-forwarded-throttler.guard";

// Exposes the protected `getTracker` for direct testing — the alternative
// (spinning up a real Nest app and hitting throttled endpoints) is over-
// kill for what's effectively a header-validation function.
class ExposedGuard extends BffForwardedThrottlerGuard {
  publicGetTracker(req: Record<string, unknown>): Promise<string> {
    return (this as unknown as {
      getTracker: (r: Record<string, unknown>) => Promise<string>;
    }).getTracker(req);
  }
}

async function makeGuard(): Promise<ExposedGuard> {
  const mod = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([{ name: "default", limit: 1, ttl: 1000 }]),
    ],
    providers: [ExposedGuard],
  }).compile();
  return mod.get(ExposedGuard);
}

// A fake Express-style request with the headers and `ip` we need.
function fakeReq(opts: {
  ip?: string;
  headers?: Record<string, string>;
}): Record<string, unknown> {
  return { ip: opts.ip ?? "10.0.0.1", headers: opts.headers ?? {} };
}

const VALID_SECRET = "this-is-a-test-secret-32-bytes-x";

describe("BffForwardedThrottlerGuard", () => {
  const originalSecret = process.env["BFF_FORWARD_SECRET"];

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env["BFF_FORWARD_SECRET"];
    } else {
      process.env["BFF_FORWARD_SECRET"] = originalSecret;
    }
  });

  it("falls back to req.ip when BFF_FORWARD_SECRET is unset", async () => {
    delete process.env["BFF_FORWARD_SECRET"];
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "1.2.3.4",
        headers: {
          "x-ci-train-client-ip": "9.9.9.9",
          "x-ci-train-bff-secret": "any",
        },
      }),
    );
    expect(t).toBe("1.2.3.4");
  });

  it("falls back to req.ip when BFF_FORWARD_SECRET is too short (< 16)", async () => {
    process.env["BFF_FORWARD_SECRET"] = "tooshort";
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "1.2.3.4",
        headers: {
          "x-ci-train-client-ip": "9.9.9.9",
          "x-ci-train-bff-secret": "tooshort",
        },
      }),
    );
    expect(t).toBe("1.2.3.4");
  });

  it("returns the forwarded IP when secret matches", async () => {
    process.env["BFF_FORWARD_SECRET"] = VALID_SECRET;
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: {
          "x-ci-train-client-ip": "203.0.113.42",
          "x-ci-train-bff-secret": VALID_SECRET,
        },
      }),
    );
    expect(t).toBe("203.0.113.42");
  });

  it("returns the forwarded IP for valid IPv6", async () => {
    process.env["BFF_FORWARD_SECRET"] = VALID_SECRET;
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: {
          "x-ci-train-client-ip": "2001:db8::1",
          "x-ci-train-bff-secret": VALID_SECRET,
        },
      }),
    );
    expect(t).toBe("2001:db8::1");
  });

  it("falls back when the secret does not match", async () => {
    process.env["BFF_FORWARD_SECRET"] = VALID_SECRET;
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: {
          "x-ci-train-client-ip": "203.0.113.42",
          "x-ci-train-bff-secret": "wrong-secret-but-same-length-xx",
        },
      }),
    );
    expect(t).toBe("10.0.0.1");
  });

  it("falls back when the secret is the right prefix but wrong length", async () => {
    process.env["BFF_FORWARD_SECRET"] = VALID_SECRET;
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: {
          "x-ci-train-client-ip": "203.0.113.42",
          "x-ci-train-bff-secret": VALID_SECRET.slice(0, 8),
        },
      }),
    );
    expect(t).toBe("10.0.0.1");
  });

  it("falls back when the forwarded IP is malformed", async () => {
    process.env["BFF_FORWARD_SECRET"] = VALID_SECRET;
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: {
          "x-ci-train-client-ip": "not-an-ip-at-all",
          "x-ci-train-bff-secret": VALID_SECRET,
        },
      }),
    );
    expect(t).toBe("10.0.0.1");
  });

  it("falls back when only the client-IP header is present (no secret header)", async () => {
    process.env["BFF_FORWARD_SECRET"] = VALID_SECRET;
    const g = await makeGuard();
    const t = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: { "x-ci-train-client-ip": "203.0.113.42" },
      }),
    );
    expect(t).toBe("10.0.0.1");
  });

  it("two different forwarded IPs land on different tracker keys", async () => {
    process.env["BFF_FORWARD_SECRET"] = VALID_SECRET;
    const g = await makeGuard();
    const a = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: {
          "x-ci-train-client-ip": "203.0.113.42",
          "x-ci-train-bff-secret": VALID_SECRET,
        },
      }),
    );
    const b = await g.publicGetTracker(
      fakeReq({
        ip: "10.0.0.1",
        headers: {
          "x-ci-train-client-ip": "198.51.100.7",
          "x-ci-train-bff-secret": VALID_SECRET,
        },
      }),
    );
    expect(a).not.toEqual(b);
  });
});
