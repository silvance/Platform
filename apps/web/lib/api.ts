import { z, ZodError } from "zod";
import {
  AdminScenarioDetail,
  AdminScenarioListResponse,
  AdminScenarioSummary,
  AuthoredQuestion,
  CreateQuestionRequest,
  CreateScenarioRequest,
  HelloResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  ParsedEmlPayload,
  ScenarioDetail,
  ScenarioListQuery,
  ScenarioListResponse,
  ScenarioProgressPayload,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  UpdateQuestionRequest,
  UpdateScenarioRequest,
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

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
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
  scenarios: {
    list: async (token: string, query: ScenarioListQuery = {}): Promise<ScenarioListResponse> =>
      parse(
        ScenarioListResponse,
        await request(`/scenarios${buildQuery(query)}`, { token }),
      ),
    getBySlug: async (token: string, slug: string): Promise<ScenarioDetail> =>
      parse(ScenarioDetail, await request(`/scenarios/${encodeURIComponent(slug)}`, { token })),
    getParsedEml: async (
      token: string,
      slug: string,
      artifactId: string,
    ): Promise<ParsedEmlPayload> =>
      parse(
        ParsedEmlPayload,
        await request(
          `/scenarios/${encodeURIComponent(slug)}/artifacts/${encodeURIComponent(artifactId)}/parsed`,
          { token },
        ),
      ),
  },
  authoring: {
    list: async (token: string): Promise<AdminScenarioListResponse> =>
      parse(AdminScenarioListResponse, await request("/admin/challenges", { token })),
    get: async (token: string, slug: string): Promise<AdminScenarioDetail> =>
      parse(
        AdminScenarioDetail,
        await request(`/admin/challenges/${encodeURIComponent(slug)}`, { token }),
      ),
    create: async (
      token: string,
      body: CreateScenarioRequest,
    ): Promise<AdminScenarioSummary> =>
      parse(
        AdminScenarioSummary,
        await request("/admin/challenges", { method: "POST", body, token }),
      ),
    update: async (
      token: string,
      slug: string,
      body: UpdateScenarioRequest,
    ): Promise<AdminScenarioSummary> =>
      parse(
        AdminScenarioSummary,
        await request(`/admin/challenges/${encodeURIComponent(slug)}`, {
          method: "PATCH",
          body,
          token,
        }),
      ),
    remove: async (token: string, slug: string): Promise<void> => {
      await request(`/admin/challenges/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        token,
        expect: "empty",
      });
    },
    addQuestion: async (
      token: string,
      slug: string,
      body: CreateQuestionRequest,
    ): Promise<AuthoredQuestion> =>
      parse(
        AuthoredQuestion,
        await request(`/admin/challenges/${encodeURIComponent(slug)}/questions`, {
          method: "POST",
          body,
          token,
        }),
      ),
    updateQuestion: async (
      token: string,
      slug: string,
      questionId: string,
      body: UpdateQuestionRequest,
    ): Promise<AuthoredQuestion> =>
      parse(
        AuthoredQuestion,
        await request(
          `/admin/challenges/${encodeURIComponent(slug)}/questions/${encodeURIComponent(questionId)}`,
          { method: "PATCH", body, token },
        ),
      ),
    removeQuestion: async (
      token: string,
      slug: string,
      questionId: string,
    ): Promise<void> => {
      await request(
        `/admin/challenges/${encodeURIComponent(slug)}/questions/${encodeURIComponent(questionId)}`,
        { method: "DELETE", token, expect: "empty" },
      );
    },
  },
  progress: {
    get: async (token: string, slug: string): Promise<ScenarioProgressPayload> =>
      parse(
        ScenarioProgressPayload,
        await request(`/scenarios/${encodeURIComponent(slug)}/progress`, { token }),
      ),
    submit: async (
      token: string,
      slug: string,
      questionId: string,
      body: SubmitAnswerRequest,
    ): Promise<SubmitAnswerResponse> =>
      parse(
        SubmitAnswerResponse,
        await request(
          `/scenarios/${encodeURIComponent(slug)}/questions/${encodeURIComponent(questionId)}/submit`,
          { method: "POST", body, token },
        ),
      ),
  },
};

// Back-compat for the M0 home page until it's refactored.
export const fetchHello = api.hello;
