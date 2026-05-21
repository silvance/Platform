import { SetMetadata } from "@nestjs/common";

export const PUBLIC_METADATA_KEY = "ci-train:public";

// Marks a route as bypassing the global AuthGuard (e.g. /healthz, /login).
export const Public = () => SetMetadata(PUBLIC_METADATA_KEY, true);
