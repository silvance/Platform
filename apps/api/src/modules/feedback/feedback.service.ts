import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
  FeedbackListItem,
  SubmitFeedbackResponse,
} from "@ci-train/contracts";

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  // Submit a feedback row against a scenario by slug. Any signed-in
  // user can submit; many rows per (user, scenario) are allowed.
  async submit(args: {
    scenarioSlug: string;
    userId: string;
    rating: number | null;
    body: string;
  }): Promise<SubmitFeedbackResponse> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { slug: args.scenarioSlug },
      select: { id: true },
    });
    if (!scenario) {
      throw new NotFoundException("Scenario not found.");
    }
    const row = await this.prisma.scenarioFeedback.create({
      data: {
        scenarioId: scenario.id,
        userId: args.userId,
        rating: args.rating,
        body: args.body,
      },
    });
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // Admin listing. Newest-first across the whole catalogue, with
  // a maximum page size so the admin page doesn't accidentally
  // pull thousands of rows on a long-running deployment.
  async listAll(args: { limit: number }): Promise<{
    feedback: FeedbackListItem[];
    totalCount: number;
  }> {
    const limit = Math.max(1, Math.min(args.limit, 500));
    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.scenarioFeedback.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          scenario: { select: { slug: true, title: true } },
          user: { select: { displayName: true, email: true } },
        },
      }),
      this.prisma.scenarioFeedback.count(),
    ]);
    return {
      feedback: rows.map((r) => ({
        id: r.id,
        scenarioId: r.scenarioId,
        scenarioSlug: r.scenario.slug,
        scenarioTitle: r.scenario.title,
        userId: r.userId,
        userDisplayName: r.user.displayName,
        userEmail: r.user.email,
        rating: r.rating,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
      })),
      totalCount,
    };
  }
}
