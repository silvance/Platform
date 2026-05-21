import { z, ZodError } from "zod";
import {
  HelloResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
} from "@ci-train/contracts";

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOpts {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  expect?: "json" | "empty";
}

async function request(path: string, opts: RequestOpts = {}): Promise<unknown> {
  const url = `${API_INTERNAL_URL}/v1${path}`;
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });

  if (opts.expect === "empty") {
    if (!res.ok) {
      throw new ApiError(res.status, `API ${path} returned ${res.status}`, await safeBody(res));
    }
    return undefined;
  }

  const body = await safeBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, `API ${path} returned ${res.status}`, body);
  }
  return body;
}

async function safeBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError(502, "API returned an unexpected payload shape", err.issues);
    }
    throw err;
  }
}

export const api = {
  hello: async (): Promise<HelloResponse> =>
    parse(HelloResponse, await request("/hello")),
  health: async (): Promise<HealthResponse> =>
    parse(HealthResponse, await request("/healthz")),
  login: async (body: LoginRequest): Promise<LoginResponse> =>
    parse(LoginResponse, await request("/auth/login", { method: "POST", body })),
  logout: async (token: string): Promise<void> => {
    await request("/auth/logout", { method: "POST", token, expect: "empty" });
  },
  me: async (token: string): Promise<MeResponse> =>
    parse(MeResponse, await request("/auth/me", { token })),
};

// Back-compat for the M0 home page until it's refactored.
export const fetchHello = api.hello;
