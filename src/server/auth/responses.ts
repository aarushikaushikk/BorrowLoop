import "server-only";
import { accessDecisionToStatus, type AccessDecision } from "@/server/domain/access";

const DENIED_MESSAGES = {
  forbidden: "Forbidden",
  not_found: "Not found",
} as const satisfies Record<Exclude<AccessDecision, "allow">, string>;

/**
 * A generic denial response for route handlers: a real HTTP 403 or 404 that
 * needs no experimental framework settings.
 *
 * It takes only the decision, so it has no way to include community, user,
 * or role details in the body.
 */
export function accessDeniedResponse(decision: Exclude<AccessDecision, "allow">): Response {
  return Response.json(
    { error: DENIED_MESSAGES[decision] },
    {
      status: accessDecisionToStatus(decision),
      headers: { "Cache-Control": "no-store" },
    },
  );
}

const DENIED_PAGES = {
  forbidden: {
    title: "Access denied",
    message: "Only community admins can open this page.",
  },
  not_found: {
    title: "Page not found",
    message: "This page doesn't exist, or you don't have access to it.",
  },
} as const satisfies Record<Exclude<AccessDecision, "allow">, { title: string; message: string }>;

/**
 * A real HTTP 403 or 404 page, returned by the proxy before any streaming
 * starts (streamed pages always begin with 200).
 *
 * The body is fixed text: it takes only the decision, so it can't include the
 * community's name, members, or whether it exists. Not-found is identical for
 * nonexistent communities and communities the user doesn't belong to.
 */
export function accessDeniedPage(decision: Exclude<AccessDecision, "allow">): Response {
  const { title, message } = DENIED_PAGES[decision];
  const status = accessDecisionToStatus(decision);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · BorrowLoop</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#fafafa;color:#18181b;padding:16px}
main{max-width:28rem;text-align:center}
p.code{font-size:.875rem;font-weight:600;color:#047857;margin:0}
h1{font-size:1.5rem;margin:.5rem 0}
a{color:#047857;font-weight:500}
@media (prefers-color-scheme:dark){body{background:#09090b;color:#fafafa}p.code,a{color:#34d399}}
</style>
</head>
<body>
<main>
<p class="code">${status}</p>
<h1>${title}</h1>
<p>${message}</p>
<p><a href="/communities">Back to your communities</a></p>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
