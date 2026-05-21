import { SetMetadata } from "@nestjs/common";
import type { Role } from "@prisma/client";

export const ROLES_METADATA_KEY = "ci-train:roles";

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_METADATA_KEY, roles);
