import { z, ZodError } from "zod";
import {
  AccessCodeListResponse,
  AnalyticsResponse,
  CompletionListResponse,
  CreateAccessCodeRequest,
  CreateAccessCodeResponse,
  DisableAccessCodeResponse,
  AdminCreateUserRequest,
  AdminResetPasswordRequest,
  AdminReviewListResponse,
  AdminScenarioDetail,
  AdminScenarioListQuery,
  AdminScenarioListResponse,
  AdminScenarioSummary,
  AdminStatsResponse,
  AdminUpdateUserRequest,
  AdminUserListResponse,
  AdminUserResponse,
  AuthoredArtifact,
  AuthoredIndicatorSet,
  AuthoredQuestion,
  ChangePasswordRequest,
  SetQuestionReviewRequest,
  SetScenarioReviewRequest,
  CreateIndicatorSetRequest,
  CreateQuestionRequest,
  CreateScenarioRequest,
  HelloResponse,
  HealthResponse,
  ImportPackResponse,
  LaneOverviewResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  LoginResponse,
  MeProgressResponse,
  MeResponse,
  ParsedEmlPayload,
  ScenarioDetail,
  ScenarioListQuery,
  ScenarioListResponse,
  ScenarioProgressPayload,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  UpdateArtifactRequest,
  UpdateIndicatorSetRequest,
  UpdateQuestionRequest,
  UpdateScenarioRequest,
} from "@ci-train/contracts";
import { bffForwardHeaders } from "./forwarded-ip";

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
  // Multipart form data. When set, body is ignored. The fetch call
  // sends the FormData directly (no JSON serialization, no
  // content-type header — browser/runtime sets it with the boundary).
  formData?: FormData;
  token?: string | null;
  expect?: "json" | "empty";
}

async function request(path: string, opts: RequestOpts = {}): Promise<unknown> {
  const url = `${API_INTERNAL_URL}/v1${path}`;
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (opts.body !== undefined && !opts.formData) {
    headers["content-type"] = "application/json";
  }
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;

  // Stamp the BFF-forwarded-IP headers when we're in a request scope
  // and the shared secret is configured. The API throttler uses these
  // to key per-real-client-IP for browser-driven traffic; without
  // them it keys on the BFF container's IP (safe but coarse).
  Object.assign(headers, await bffForwardHeaders());

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.formData ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
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
  register: async (body: RegisterRequest): Promise<RegisterResponse> =>
    parse(
      RegisterResponse,
      await request("/auth/register", { method: "POST", body }),
    ),
  logout: async (token: string): Promise<void> => {
    await request("/auth/logout", { method: "POST", token, expect: "empty" });
  },
  me: async (token: string): Promise<MeResponse> =>
    parse(MeResponse, await request("/auth/me", { token })),
  changePassword: async (
    token: string,
    body: ChangePasswordRequest,
  ): Promise<void> => {
    await request("/auth/change-password", {
      method: "POST",
      body,
      token,
      expect: "empty",
    });
  },
  users: {
    list: async (token: string): Promise<AdminUserListResponse> =>
      parse(AdminUserListResponse, await request("/admin/users", { token })),
    create: async (
      token: string,
      body: AdminCreateUserRequest,
    ): Promise<AdminUserResponse> =>
      parse(
        AdminUserResponse,
        await request("/admin/users", { method: "POST", body, token }),
      ),
    update: async (
      token: string,
      id: string,
      body: AdminUpdateUserRequest,
    ): Promise<AdminUserResponse> =>
      parse(
        AdminUserResponse,
        await request(`/admin/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body,
          token,
        }),
      ),
    resetPassword: async (
      token: string,
      id: string,
      body: AdminResetPasswordRequest,
    ): Promise<AdminUserResponse> =>
      parse(
        AdminUserResponse,
        await request(`/admin/users/${encodeURIComponent(id)}/password`, {
          method: "POST",
          body,
          token,
        }),
      ),
    approve: async (
      token: string,
      id: string,
    ): Promise<AdminUserResponse> =>
      parse(
        AdminUserResponse,
        await request(`/admin/users/${encodeURIComponent(id)}/approve`, {
          method: "POST",
          token,
        }),
      ),
  },
  scenarios: {
    list: async (token: string, query: ScenarioListQuery = {}): Promise<ScenarioListResponse> =>
      parse(
        ScenarioListResponse,
        await request(`/scenarios${buildQuery(query)}`, { token }),
      ),
    lanes: async (token: string): Promise<LaneOverviewResponse> =>
      parse(LaneOverviewResponse, await request("/scenarios/lanes", { token })),
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
  stats: {
    get: async (token: string): Promise<AdminStatsResponse> =>
      parse(AdminStatsResponse, await request("/admin/stats", { token })),
  },
  analytics: {
    get: async (token: string): Promise<AnalyticsResponse> =>
      parse(AnalyticsResponse, await request("/admin/analytics", { token })),
  },
  completions: {
    listRecent: async (
      token: string,
      opts: { limit?: number } = {},
    ): Promise<CompletionListResponse> => {
      const qp = new URLSearchParams();
      if (opts.limit !== undefined) qp.set("limit", String(opts.limit));
      const path = qp.toString()
        ? `/admin/completions?${qp.toString()}`
        : "/admin/completions";
      return parse(CompletionListResponse, await request(path, { token }));
    },
  },
  accessCodes: {
    list: async (token: string): Promise<AccessCodeListResponse> =>
      parse(
        AccessCodeListResponse,
        await request("/admin/access-codes", { token }),
      ),
    create: async (
      token: string,
      body: CreateAccessCodeRequest,
    ): Promise<CreateAccessCodeResponse> =>
      parse(
        CreateAccessCodeResponse,
        await request("/admin/access-codes", {
          method: "POST",
          token,
          body,
        }),
      ),
    disable: async (
      token: string,
      id: string,
    ): Promise<DisableAccessCodeResponse> =>
      parse(
        DisableAccessCodeResponse,
        await request(`/admin/access-codes/${encodeURIComponent(id)}/disable`, {
          method: "PATCH",
          token,
        }),
      ),
  },
  authoring: {
    list: async (
      token: string,
      query: AdminScenarioListQuery = {},
    ): Promise<AdminScenarioListResponse> => {
      const qp = new URLSearchParams();
      if (query.status !== undefined) qp.set("status", query.status);
      if (query.difficulty !== undefined) qp.set("difficulty", String(query.difficulty));
      if (query.reviewStatus !== undefined) qp.set("reviewStatus", query.reviewStatus);
      if (query.tag !== undefined) qp.set("tag", query.tag);
      if (query.q !== undefined) qp.set("q", query.q);
      const qs = qp.toString();
      return parse(
        AdminScenarioListResponse,
        await request(`/admin/challenges${qs ? `?${qs}` : ""}`, { token }),
      );
    },
    get: async (token: string, slug: string): Promise<AdminScenarioDetail> =>
      parse(
        AdminScenarioDetail,
        await request(`/admin/challenges/${encodeURIComponent(slug)}`, { token }),
      ),
    listForReview: async (token: string): Promise<AdminReviewListResponse> =>
      parse(
        AdminReviewListResponse,
        await request("/admin/challenges/_review", { token }),
      ),
    setScenarioReview: async (
      token: string,
      slug: string,
      body: SetScenarioReviewRequest,
    ): Promise<{ scenario: AdminScenarioSummary }> => {
      const raw = await request(
        `/admin/challenges/${encodeURIComponent(slug)}/review`,
        { method: "PATCH", body, token },
      );
      // Inline wrapper validation. AdminScenarioSummary is the
      // contract schema; wrapping it in `{ scenario: ... }` is
      // a one-line z.object here rather than another exported
      // alias in the contract package.
      return z.object({ scenario: AdminScenarioSummary }).parse(raw);
    },
    setQuestionReview: async (
      token: string,
      slug: string,
      questionId: string,
      body: SetQuestionReviewRequest,
    ): Promise<{ question: AuthoredQuestion }> => {
      const raw = await request(
        `/admin/challenges/${encodeURIComponent(slug)}/questions/${encodeURIComponent(questionId)}/review`,
        { method: "PATCH", body, token },
      );
      return z.object({ question: AuthoredQuestion }).parse(raw);
    },
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
    addIndicatorSet: async (
      token: string,
      slug: string,
      body: CreateIndicatorSetRequest,
    ): Promise<AuthoredIndicatorSet> =>
      parse(
        AuthoredIndicatorSet,
        await request(
          `/admin/challenges/${encodeURIComponent(slug)}/indicator-sets`,
          { method: "POST", body, token },
        ),
      ),
    updateIndicatorSet: async (
      token: string,
      slug: string,
      setId: string,
      body: UpdateIndicatorSetRequest,
    ): Promise<AuthoredIndicatorSet> =>
      parse(
        AuthoredIndicatorSet,
        await request(
          `/admin/challenges/${encodeURIComponent(slug)}/indicator-sets/${encodeURIComponent(setId)}`,
          { method: "PATCH", body, token },
        ),
      ),
    removeIndicatorSet: async (
      token: string,
      slug: string,
      setId: string,
    ): Promise<void> => {
      await request(
        `/admin/challenges/${encodeURIComponent(slug)}/indicator-sets/${encodeURIComponent(setId)}`,
        { method: "DELETE", token, expect: "empty" },
      );
    },
    addArtifact: async (
      token: string,
      slug: string,
      fd: FormData,
    ): Promise<AuthoredArtifact> =>
      parse(
        AuthoredArtifact,
        await request(
          `/admin/challenges/${encodeURIComponent(slug)}/artifacts`,
          { method: "POST", formData: fd, token },
        ),
      ),
    updateArtifact: async (
      token: string,
      slug: string,
      artifactId: string,
      body: UpdateArtifactRequest,
    ): Promise<AuthoredArtifact> =>
      parse(
        AuthoredArtifact,
        await request(
          `/admin/challenges/${encodeURIComponent(slug)}/artifacts/${encodeURIComponent(artifactId)}`,
          { method: "PATCH", body, token },
        ),
      ),
    removeArtifact: async (
      token: string,
      slug: string,
      artifactId: string,
    ): Promise<void> => {
      await request(
        `/admin/challenges/${encodeURIComponent(slug)}/artifacts/${encodeURIComponent(artifactId)}`,
        { method: "DELETE", token, expect: "empty" },
      );
    },
    exportPack: async (
      token: string,
      slug: string,
    ): Promise<{ filename: string; bytes: ArrayBuffer }> => {
      const url = `${API_INTERNAL_URL}/v1/admin/challenges/${encodeURIComponent(slug)}/export`;
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new ApiError(res.status, `Export failed: ${res.status}`);
      }
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `${slug}.zip`;
      return { filename, bytes: await res.arrayBuffer() };
    },
    importPack: async (
      token: string,
      fd: FormData,
    ): Promise<ImportPackResponse> =>
      parse(
        ImportPackResponse,
        await request("/admin/challenges/_import", {
          method: "POST",
          formData: fd,
          token,
        }),
      ),
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
    me: async (token: string): Promise<MeProgressResponse> =>
      parse(MeProgressResponse, await request("/me/progress", { token })),
  },
};

// Back-compat for the M0 home page until it's refactored.
export const fetchHello = api.hello;
