import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AiExtractionProviderError,
  AiExtractionUnavailableError,
  OpenAiExtractionAdapter,
} from "@/lib/adapters/openai-extraction.server";
import {
  LocalHongKongExtractionAdapter,
  LocalTextRequiredError,
} from "@/lib/adapters/local-hong-kong-extraction";
import {
  ExtractionRequestSchema,
  type ExtractionEnvelope,
  type ExtractionRequest,
} from "@/lib/schemas/extraction";

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

export async function GET() {
  const adapter = new OpenAiExtractionAdapter();
  const availability = adapter.availability();

  return NextResponse.json(
    {
      ...availability,
      localTextAvailable: true,
      localTextScope: "supported_hong_kong_places",
      screenshotAnalysisAvailable: availability.available,
      privacy:
        "Pasted text can be matched locally without upload. DayWeave does not write or retain uploaded screenshots; live requests use store:false.",
    },
    { headers: NO_STORE_HEADERS },
  );
}

function successfulExtraction(
  result: ExtractionEnvelope,
  options: { screenshotRead: boolean; usedFallback?: boolean },
) {
  return NextResponse.json(
    {
      ok: true,
      ...result,
      screenshotRead: options.screenshotRead,
      usedFallback: options.usedFallback ?? false,
      privacy: result.isLiveAnalysis
        ? "DayWeave did not write or retain the uploaded screenshot. This response is not cached."
        : "The pasted text was matched locally and was not sent to an AI provider. This response is not cached.",
    },
    { headers: NO_STORE_HEADERS },
  );
}

async function localExtraction(input: ExtractionRequest, usedFallback = false) {
  const adapter = new LocalHongKongExtractionAdapter();
  try {
    const result = await adapter.extract(input);
    return successfulExtraction(result, {
      screenshotRead: false,
      usedFallback,
    });
  } catch (error) {
    if (error instanceof LocalTextRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            retryable: false,
          },
          demoAvailable: true,
          localTextAvailable: true,
        },
        { status: 422, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }
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
          message: "Send wishlist input as a JSON request body.",
          retryable: false,
        },
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = ExtractionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_EXTRACTION_REQUEST",
          message: "Check the wishlist input and try again.",
          retryable: false,
          issues: safeIssues(parsed.error),
        },
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const adapter = new OpenAiExtractionAdapter();
  const availability = adapter.availability();
  if (!availability.available) {
    return localExtraction(parsed.data);
  }

  try {
    const result = await adapter.extract(parsed.data);
    return successfulExtraction(result, { screenshotRead: Boolean(parsed.data.imageDataUrl) });
  } catch (error) {
    if (
      parsed.data.text &&
      (error instanceof AiExtractionUnavailableError ||
        error instanceof AiExtractionProviderError)
    ) {
      return localExtraction(parsed.data, true);
    }

    const providerError =
      error instanceof AiExtractionProviderError
        ? error
        : new AiExtractionProviderError();
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: providerError.code,
          message: providerError.message,
          retryable: true,
        },
        demoAvailable: true,
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
