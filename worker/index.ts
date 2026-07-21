/** Cloudflare Worker entry point for the vinext-starter template. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  type ImageHandlers,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const assets = env.ASSETS;

      // The local Vite worker does not always receive Cloudflare's production
      // ASSETS binding. Fail this optional endpoint cleanly instead of throwing
      // and covering the whole app with the HMR error overlay.
      if (!assets) {
        return new Response("Image optimization is unavailable in this environment.", {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        });
      }

      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageHandlers: ImageHandlers = {
        fetchAsset: (path) => assets.fetch(new Request(new URL(path, request.url))),
      };
      const images = env.IMAGES;

      if (images) {
        imageHandlers.transformImage = async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        };
      }

      return handleImageOptimization(request, imageHandlers, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
