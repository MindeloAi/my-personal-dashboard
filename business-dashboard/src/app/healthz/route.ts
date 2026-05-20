// Public health-check endpoint for Railway. Kept outside the proxy matcher so
// it is reachable while logged out. Returns 200 with a plain-text body.

export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
