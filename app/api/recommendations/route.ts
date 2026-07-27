import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DayRecommendationService,
  RecommendationUnavailableError,
} from "@/lib/adapters/day-recommendations.server";
import { RecommendationRequestSchema } from "@/lib/schemas/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function safeIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_JSON",
          message: "Send the destination and wishlist as a JSON request body.",
          retryable: false,
        },
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = RecommendationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_RECOMMENDATION_REQUEST",
          message: "Check the destination and wishlist, then try again.",
          retryable: false,
          issues: safeIssues(parsed.error),
        },
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const bundle = await new DayRecommendationService().recommend(parsed.data);
    return NextResponse.json(
      { ok: true, bundle },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const recommendationError =
      error instanceof RecommendationUnavailableError
        ? error
        : new RecommendationUnavailableError(
            "The recommendation source is temporarily unavailable. Your wishlist was not changed.",
          );

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: recommendationError.code,
          message: recommendationError.message,
          retryable: true,
        },
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
