import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function renderHomePage() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the real DayWeave opening experience", async () => {
  const response = await renderHomePage();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang=["']en["']/i);
  assert.match(html, /<title>DayWeave[^<]*Make time for what matters<\/title>/i);
  assert.match(html, /Make time for what matters\./);
  assert.match(html, /You chose the places\. We make the most important ones fit\./);
  assert.match(html, /Powered by AURORA/);
  assert.match(html, /Try the Hong Kong demo/);
  assert.match(html, /Hong Kong demo ready offline/);
  assert.match(html, /src=["']\/og\.png["']/i);
  assert.doesNotMatch(html, /\/_vinext\/image/i);
  assert.match(html, /href=["']#dayweave-main["']/i);
  assert.match(html, /id=["']dayweave-main["']/i);

  assert.doesNotMatch(html, /codex-preview/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton|SkeletonPreview/i);
});

test("keeps starter preview code and dependencies out of the product", async () => {
  const [page, layout, packageJsonText] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonText);

  assert.match(page, /import DayWeaveApp from ["']\.\/dayweave-app["']/);
  assert.match(page, /<DayWeaveApp\s*\/>/);
  assert.match(layout, /DayWeave/);
  assert.doesNotMatch(
    layout,
    /Starter Project|codex-preview|SkeletonPreview|_sites-preview/,
  );
  assert.equal(packageJson.name, "dayweave");
  assert.equal(packageJson.scripts["test:e2e"], "playwright test");
  assert.equal(packageJson.dependencies?.["react-loading-skeleton"], undefined);
  assert.equal(packageJson.devDependencies?.["react-loading-skeleton"], undefined);

  const previewFiles = await readdir(
    new URL("../app/_sites-preview", import.meta.url),
  ).catch(() => []);
  assert.deepEqual(previewFiles, []);
  await assert.rejects(access(new URL("../public/_sites-preview", import.meta.url)));
});
