# Task: [SEC-10] Constrain server-side image sources and bound remote fetches (id=25)

> Exported from Taskitty at `2026-10-10T16:13:59.570Z`.

- **State:** open
- **List:** Under Review (id=2)
- **Added:** 2026-10-08T20:12:08.027Z

## Description

Source-review recommendation (2026-10-08): server/src/services/llm/imageInputs.ts fetches arbitrary http(s) inputs and buffers response.arrayBuffer() without an explicit timeout, response byte cap, redirect policy, or destination-address policy. server/src/services/model3d/sourceImageStage.ts does the same. Both fall through to readFile() for arbitrary local paths. Request JSON caps do not limit downstream network responses or local reads.

Risk: a caller able to invoke these workflows may trigger requests to loopback/private services, memory exhaustion via large or slow responses, or reads of local image files. Browser-origin reachability is separately tracked by SEC-03.

Acceptance criteria:
- Define allowed source forms per caller while retaining supported data URLs and generated-image references.
- Validate remote destinations and redirect hops under an explicit SSRF policy; enforce image content types, connection/total timeouts, and a streaming byte cap before buffering.
- Restrict local file reads to authorized roots or remove arbitrary-path support where callers should provide upload/data URLs.
- Add regression coverage for private/loopback targets, redirect-to-private, timeout, oversized response, unsupported content type, and paths outside allowed roots.
- Document any intentional LAN/local-source exception and its scope.

## Comments (1)

> **rainer** — 2026-10-09T15:13:26.681Z
> Implemented a shared bounded remote-image fetch used by both cited call sites: only credential-free HTTP(S), preflight DNS/private-address rejection, redirects rejected, supported image MIME required, 30s timeout, and a 20 MiB streaming byte cap. Source limitations remain: arbitrary local paths are still accepted; DNS results are checked before fetch but not pinned to its connection, leaving DNS-rebinding exposure; tests/build could not run because the command runner failed to initialize. Documented partial status in docs/security-review-2026-10-08.md and moved Under Review pending path restrictions, address pinning, and regression tests.

