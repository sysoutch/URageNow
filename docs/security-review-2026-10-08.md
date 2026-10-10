# Security and reliability review — 2026-10-08

## Scope and result

Reviewed the current URageNow checkout's dashboard HTTP boundary, remote worker, shared request parser, companion authentication/pairing, generation dispatch, website archive imports and image overwrite handling. Latest inspected commit: `85323f5`. Existing modifications to `memory-bank/project-context.md` and `taskitty.json` predated this review and were preserved.

Recorded **11 initial source findings: 7 high and 4 medium**, as open remediation tasks **#10–#20** on the **General** board in the explicit URageNow Taskitty workspace. High findings are in High Priority; medium findings are in Normal Priority. Each task contains evidence, source references, remediation, acceptance criteria, a relevant existing tag and a factual review comment. These are risk priorities, not CVSS scores; exposure conditions matter.

This is a targeted source review, not an exhaustive penetration test or a clean security certification. Production configuration, firewall/proxy enforcement, browser exploit behavior, native dependencies, Android device security and every bot/tool were not comprehensively assessed. Tasks #12, #15, and #18 now have source changes for Host/origin checks, credential separation, and remote-worker request failure handling; their integration acceptance cases remain unverified. Task #19 has partial archive download/extraction guards; archive preflight and its failure-injection checks remain outstanding. The TypeScript TS2532 reported for the SEC-03 content-type parser was fixed by handling a missing split segment, but a fresh build could not run in the current environment.

## Verification

- Read project guidance, project memory-bank context and the production-readiness roadmap; checked recent Git history and the selected Taskitty board.
- Searched the dashboard/server/worker TypeScript paths for application rate-limit/concurrency enforcement and inspected the relevant dispatch/generation paths. No application-level limiter was found there. Existing provider or deployment-level limits were not verified.
- Harmless local Node URL/path probes confirmed encoded slash and backslash traversal from the tools URL prefix to repository `package.json`; no secret file or live HTTP endpoint was accessed.
- An isolated probe using the actual pairing function body and in-memory persistence/hash/audit dependencies accepted two concurrent requests with one pairing code. The first two probe attempts exposed harness omissions (newline handling and missing hash stub); after correcting the harness, both calls succeeded and created two in-memory devices. No real device was paired.
- A local URL-constructor probe confirmed malformed Host input throws. Worker process termination remains a code-based risk, not a live crash test.
- No destructive operations, real generation requests, paid-provider calls, secret reads or production load tests were performed.

## Existing protections

The dashboard gates remote access behind explicit exposure configuration, an optional client allowlist and credentials. Companion device tokens are hashed and checked using constant-time comparison; workflow permissions default off. Pairing has a five-failure, 30-second global lockout. Browser login caps its body at 4 KiB and sets HttpOnly/SameSite=Strict cookies. Companion binary uploads have a 100 MiB cap. Website imports restrict URL shape/host to HTTPS URage.net and reject redirects. These protections are useful but do not close the findings below.

## Findings

| Finding | Priority | Task | Issue |
| --- | --- | --- | --- |
| SEC-01 | High | #10 | Fail closed when the remote worker has no authentication secret |
| SEC-02 | High | #11 | Confine encoded /tools static paths to the tools directory |
| SEC-03 | High | #12 | Protect loopback dashboard mutations against cross-origin requests and DNS rebinding |
| SEC-04 | High | #13 | Bound JSON request bodies before parsing, including public pairing |
| SEC-05 | High | #14 | Add server-side request quotas and generation admission limits |
| SEC-06 | High | #15 | Separate remote-worker credentials from dashboard administrator access |
| SEC-07 | Medium | #16 | Replace raw dashboard-token cookies with revocable secure sessions |
| SEC-08 | Medium | #17 | Consume pairing credentials atomically and avoid global lockout abuse |
| REL-01 | High | #18 | Catch worker request failures before URL parsing and capability discovery |
| REL-02 | Medium | #19 | Enforce streaming and expanded archive budgets for website model imports |
| REL-03 | Medium | #20 | Make generated-image overwrite transactional to avoid losing the original |

### SEC-01: Fail closed when the remote worker has no authentication secret

- **Priority / task:** High; Taskitty #10.
- **Source:** `workers/remote-worker/src/remoteWorker.ts:441-457,1173-1178; server/src/config/appConfig.ts:164-167`.
- **Evidence and exposure:** hasValidWorkerSecret returns true when the configured secret is empty. The worker binds to 0.0.0.0 by default; no startup guard was found. This exposes generation, model operations and artifact reads if the optional worker is started without a stored/environment secret on a reachable host. Actual deployment configuration was not inspected.
- **Remediation:** Require a nonempty credential before listening; default to loopback, with explicit authenticated remote exposure. Keep liveness narrowly public.
- **Acceptance criteria:** Test unset/empty credentials, loopback and non-loopback binds, invalid/valid secrets, and protected read/write routes. A fresh worker must not accept unauthenticated operations.

### SEC-02: Confine encoded /tools static paths to the tools directory

- **Priority / task:** High; Taskitty #11.
- **Source:** `dashboard/src/server.ts:30-39,341-391`.
- **Evidence and exposure:** The /tools/ prefix is checked before decodeURIComponent, but the containment root is the repository. Local Node probes confirmed /tools/..%2fpackage.json and /tools/%2e%2e%5cpackage.json both resolve to repository package.json. The same construction can address other repository files. Dashboard auth still applies; this is not an unauthenticated remote read by itself. No secret files were requested.
- **Remediation:** Use the tools directory as the static root, validate the decoded relative path and realpath containment, and define dotfile/symlink policy. Avoid synchronous reads for large static files.
- **Acceptance criteria:** Harmless HTTP fixtures must reject encoded slash/backslash traversal, dotfiles, and symlink escapes while serving valid tools and vendor assets.

### SEC-03: Protect loopback dashboard mutations against cross-origin requests and DNS rebinding

- **Priority / task:** High; Taskitty #12.
- **Source:** `dashboard/src/server.ts:213-225; server/src/http/http.ts:18-25; dashboard/src/server/routes/messagingAndModelRoutes.ts:1628-1644`.
- **Evidence and exposure:** Loopback socket addresses bypass authentication. The request gate does not validate Host, Origin or Fetch Metadata, and parseJsonBody accepts JSON bytes regardless of Content-Type. Thus a browser-capable attacker has a route to unauthenticated local mutations on browsers/network configurations that permit such requests; DNS rebinding is another concern. Browser end-to-end exploitation was not tested. SameSite cookies do not protect a loopback bypass.
- **Remediation:** Validate allowed Host values and browser origins, enforce expected mutation content types and CSRF protection, and authenticate privileged loopback operations. Specify trusted-proxy handling rather than trusting forwarded headers.
- **Remediation status (2026-10-09):** `dashboard/src/server.ts` now rejects unrecognized Host authorities, cross-origin or `Sec-Fetch-Site: cross-site/none` mutations, and browser API mutations with unsafe content types. Accepted Host authorities come from loopback aliases, the configured bind host, and `DASHBOARD_PUBLIC_BASE_URL`; forwarded headers are not trusted. Native companion requests without browser origin metadata remain compatible.
- **Acceptance criteria:** Exercise cross-origin text/plain JSON POSTs with stubbed delete operations, unexpected Host values, legitimate local UI, remote authenticated UI, and companion requests. Rejected requests must cause no mutation. These live/integration cases have not yet been run.

### SEC-04: Bound JSON request bodies before parsing, including public pairing

- **Priority / task:** High; Taskitty #13.
- **Source:** `server/src/http/http.ts:18-25; dashboard/src/server/companion/companionRoutes.ts:300-305`.
- **Evidence and exposure:** parseJsonBody buffers every chunk without a byte ceiling, then concatenates and parses. The public companion pairing route reads the body before its credential lockout. With remote access enabled and an allowed client, no pairing token is required to reach that allocation. Large/chunked requests can exhaust memory. Login has a separate 4 KiB limit and binary companion uploads have a 100 MiB cap; these do not bound JSON.
- **Remediation:** Add route-specific byte ceilings checked while streaming, deadlines/abort handling, media type validation and typed 400/413/415 responses. Bound base64 decoded inputs too.
- **Acceptance criteria:** Test oversized Content-Length, missing/false lengths, chunked over-limit bodies, invalid JSON, arrays/null, and disconnects. Pairing must reject excess input before authentication work and without retaining the full body.

### SEC-05: Add server-side request quotas and generation admission limits

- **Priority / task:** High; Taskitty #14.
- **Source:** `dashboard/src/server.ts:processDashboardRequest; dashboard/src/server/routes/messagingAndModelRoutes.ts:1188-1314; dashboard/src/server/companion/companionRoutes.ts:508-548; workers/remote-worker/src/remoteWorker.ts:1126-1175; dashboard/src/server/dashboardInterrupts.ts:24-64`.
- **Evidence and exposure:** No application-level request rate limiter was found in the reviewed dashboard/worker dispatch and generation paths. Each accepted request reaches handlers directly; the active-request Map tracks cancellation, not bounded admission. Browser login attempts also have no throttle. Companion pairing does have five failures followed by a global 30-second lockout, so it is incorrect to say there are no limits anywhere.
- **Remediation:** Define configurable budgets per client/IP and authenticated device/principal, stricter authentication limits, global CPU/GPU concurrency and bounded waiting queues, request deadlines, cancellation and idempotency. Return 429 with Retry-After where appropriate; coordinate provider backoff without duplicating paid jobs.
- **Acceptance criteria:** Use fake generation providers and a controllable clock to verify burst/steady limits, queue saturation, fairness, bounded limiter storage, cleanup after failure/disconnect, forwarded-header spoof resistance and independent devices. Do not load-test real paid providers.

### SEC-06: Separate remote-worker credentials from dashboard administrator access

- **Priority / task:** High; Taskitty #15.
- **Source:** `dashboard/src/server.ts:126-147,185-225`.
- **Evidence and exposure:** getDashboardAccessTokens includes remoteWorkerSharedSecret. Both x-remote-worker-secret and that secret submitted through browser login grant the same dashboard access as the dashboard token, including admin/native-launch routes. A worker credential compromise therefore crosses the worker/dashboard privilege boundary when the dashboard is remotely exposed and the client is allowed.
- **Remediation:** Use separate credential audiences and least-privilege worker callbacks/routes. Dashboard administration must require a dashboard credential; document credential rotation and any migration.
- **Remediation status (2026-10-09):** Dashboard browser login and request authorization now accept only `DASHBOARD_ACCESS_TOKEN`; `REMOTE_WORKER_SHARED_SECRET` and `x-remote-worker-secret` no longer grant dashboard access. The remote worker still validates its own `x-remote-worker-secret` through the separate worker authentication module.
- **Acceptance criteria:** A worker-only credential must fail dashboard login and administrative routes but succeed only at explicitly authorized worker endpoints. Verify existing remote generation still works. These live/integration cases have not yet been run.

### SEC-07: Replace raw dashboard-token cookies with revocable secure sessions

- **Priority / task:** Medium; Taskitty #16.
- **Source:** `dashboard/src/server.ts:130-170,185-210`.
- **Evidence and exposure:** Both login paths put the long-lived access token itself into the cookie; Max-Age only controls browser retention and does not impose server-side expiry on replay. Cookies have HttpOnly/SameSite=Strict, but no Secure flag. A query-string accessToken login also exposes credentials to URL history/logging. HTTP LAN mode leaves the token vulnerable to network interception.
- **Remediation:** Exchange credentials through POST for opaque expiring server-side sessions with logout/revocation. Remove durable token query login; require TLS for remote production access and Secure cookies, with explicitly documented local-development behavior.
- **Acceptance criteria:** Test expiry using a captured cookie, logout revocation, secure attributes under supported TLS/proxy configuration, URL credential rejection, and no-store responses. Do not equate cookie Max-Age with server-enforced expiry.

### SEC-08: Consume pairing credentials atomically and avoid global lockout abuse

- **Priority / task:** Medium; Taskitty #17.
- **Source:** `dashboard/src/server/companion/companionAccessService.ts:148-172; dashboard/src/server/companion/companionRoutes.ts:300-305`.
- **Evidence and exposure:** Credential validation occurs before awaiting mutateDevices; invalidation happens afterward. A probe executing the real pairing function body with in-memory persistence/hash/audit stubs accepted two concurrent requests using the same credential and created two devices. Separately, five bad attempts lock every client out for 30 seconds, allowing repeated denial of pairing by one allowed network client.
- **Remediation:** Atomically validate/reserve/consume a pairing credential with device creation, with clear persistence-failure behavior. Add bounded per-source attempt budgets plus a global safety budget and return 429/Retry-After for throttling.
- **Acceptance criteria:** Concurrent requests using one code or QR token must produce at most one device. Test expired/replayed credentials, persistence failure, and one abusive source alongside a legitimate device.

### REL-01: Catch worker request failures before URL parsing and capability discovery

- **Priority / task:** High; Taskitty #18.
- **Source:** `workers/remote-worker/src/remoteWorker.ts:1126-1175`.
- **Evidence and exposure:** URL construction uses the untrusted Host header before the try/catch. Capability/readiness awaits also sit outside that handler guard, and the createServer callback discards the promise with void and no catch. A local URL probe confirms malformed Host '[' throws. Such failures can become unhandled rejections and terminate Node under its default rejection policy. The real worker was not crashed.
- **Remediation:** Wrap the entire request lifecycle or attach a top-level rejection handler; validate URL/Host and return 400 for malformed requests. Handle headers-sent and socket-aborted cases safely.
- **Remediation status (2026-10-09):** URL parsing, authorization, capability/readiness discovery, and route handling now run inside the request error boundary. Malformed request targets return 400; handler/discovery failures return bounded 500 responses, and the server callback has a final rejection guard.
- **Acceptance criteria:** A disposable server subprocess must survive malformed Host and injected capability errors, return bounded error responses and answer a subsequent health request without unhandledRejection. This subprocess check has not yet run.

### REL-02: Enforce streaming and expanded archive budgets for website model imports

- **Priority / task:** Medium; Taskitty #19.
- **Source:** `dashboard/src/server/model3d/websiteArchiveImport.ts:9,18-25,48-72`.
- **Evidence and exposure:** The importer validates an approved HTTPS URage.net URL and disallows redirects, which are useful controls. However it calls arrayBuffer before checking actual downloaded size when Content-Length is absent/inaccurate, tar extraction has no deadline or expanded-size/file-count budget, and all sidecars are read concurrently into memory. Large approved-source archives can exhaust RAM/disk or hang import processing. No claim is made that tar traversal was demonstrated.
- **Remediation:** Stream with an enforced byte ceiling and timeout; preflight entries and constrain expanded bytes/file counts/path types; bound extraction runtime and sidecar-read concurrency. Guarantee cleanup on abort.
- **Remediation status (2026-10-09, partial):** Downloads now stream to a temporary file with a 350 MiB actual-byte ceiling and a 120-second deadline. Extraction has a 120-second kill timeout; post-extraction traversal limits regular files to 5,000 and total expanded bytes to 1 GiB, and sidecar reads are sequential. This does not preflight ZIP entries, so it does not prevent disk expansion before the post-extraction check.
- **Acceptance criteria:** Use synthetic approved-source fixtures for chunked over-limit downloads, slow streams, excessive expansion/file counts and extraction timeout; assert bounded memory/disk and cleanup. These checks have not run; preflight limits are still needed before this task can be completed.

### REL-03: Make generated-image overwrite transactional to avoid losing the original

- **Priority / task:** Medium; Taskitty #20.
- **Source:** `dashboard/src/server/routes/messagingAndModelRoutes.ts:1277-1301`.
- **Evidence and exposure:** The overwrite branch reads the new image, deletes overwriteImageId, and only then imports the replacement under that ID. If import fails after deletion, the original asset is lost. This is a source-confirmed failure window; no real image was deleted in the review.
- **Remediation:** Stage the replacement, validate it and atomically swap metadata/files while retaining rollback data until success. Serialize conflicting overwrites and define recovery after a crash.
- **Acceptance criteria:** Inject failures at write/metadata/rename boundaries and verify original bytes and metadata remain accessible until commit. Concurrent replacements must not leave broken references.

## Approved dependency audit and additional source finding

The user approved the npm registry metadata transfer. On 2026-10-08, `npm audit --json --ignore-scripts` completed with exit code 1 because it found vulnerabilities: **3 affected packages (2 high, 1 low), covering 4 advisories**, out of 229 dependencies reported. This replaces the earlier blocked-audit status. No automatic fix or dependency update was performed.

`npm ls sharp dompurify source-map-js --all` confirmed the installed root tree. Package manifests in the existing desktop runtime bundle were inspected separately: the root audit does not certify the packaged application.

| Package | Root installed | Desktop bundle inspected | Advisory severity | Patched version | Task |
| --- | --- | --- | --- | --- | --- |
| sharp | 0.35.4 | 0.34.5 | High | 0.35.5 | #21 (High Priority) |
| source-map-js, through sass 1.101.0 | 1.2.1 | Not found at inspected top-level path | High | 1.2.2 | #22 (Normal Priority: build-tool exposure) |
| dompurify | 3.4.15 | 3.4.10 | Low | 3.4.16 | #23 (Normal Priority) |

### DEP-01: sharp native image processing

Sharp is a server runtime dependency despite also being listed in root devDependencies. Calls include image sanitization, tool transformations and companion thumbnails. The advisory describes a librsvg memory vulnerability, including possible code execution under specific glibc Linux/runtime conditions; Windows code execution is not established. Upgrade compatible resolutions and regenerate the desktop bundle, then validate native image processing on supported platforms. [Upstream advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

### DEP-02: source-map-js build tooling

The installed dependency comes through Sass. A runtime route accepting untrusted source maps was not identified in the reviewed code. Update the compatible transitive resolution and verify the stylesheet build; distinguish upstream severity from demonstrated dashboard exposure. [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

### DEP-03: DOMPurify

The observed dashboard call sanitizes a string without IN_PLACE or node-removing hooks, so the advisory prerequisites were not identified there. Upgrade and verify root, served assets and desktop bundle. The older packaged 3.4.10 version falls within the rawtext advisory range; it is outside the separate hook advisory's 3.4.13–3.4.15 range. [Rawtext advisory](https://github.com/advisories/GHSA-6688-9rhm-gjv2), [hook advisory](https://github.com/advisories/GHSA-p98j-92pf-mc4p).

### SEC-09: missing-sanitizer fallback — High Priority, task #24

`dashboard/src/client/modules/dashboard/shared/presentationHelpers.js:114-129` returns raw parser HTML when DOMPurify is unavailable. With marked loaded and attacker-controlled Markdown, this fails open if the sanitizer fails to load. It is independent of the dependency advisories and was confirmed by source inspection, not browser exploitation. Render escaped text or a safe error instead, and test missing/failing sanitizer behavior with hostile Markdown fixtures.

The original review had **10 open remediation tasks**: #12, #14–#16, #18–#23. SEC-01 (#10), SEC-02 (#11) and SEC-09 (#24) are implemented and marked done; three dependency tasks and one additional source finding were added after the original 11. On 2026-10-09, a supplemental source review added Task #25 for image-source validation and remote-fetch bounds; it is recorded as hardening because browser reachability and intended local-source workflows affect exploitability. Dependencies, lockfile and packaged artifacts remain unchanged. No advisory exploit was executed.

## Supplemental source review — 2026-10-09

### SEC-10: Constrain server-side image sources and bound remote fetches — Taskitty #25, Normal Priority

- **Evidence:** `server/src/services/llm/imageInputs.ts` fetches caller-provided HTTP(S) image URLs with `fetch()` and buffers `response.arrayBuffer()`; its fallback reads arbitrary path strings with `readFile()`. `server/src/services/model3d/sourceImageStage.ts` repeats the HTTP fetch/full-buffer behavior and accepts paths for `readFile()`. Dashboard model/image routes accept `imageInput` from JSON bodies. The JSON request cap limits only the submitted body, not the subsequent network response or file read.
- **Risk boundary:** These operations require invocation of the relevant workflow. Cross-origin access to loopback routes is separately tracked in SEC-03; intended local-file inputs and LAN image sources may be product requirements. Treat SSRF/path access as a source-validation hardening issue until supported caller contracts and deployment exposure are confirmed.
- **Remediation:** Define accepted source forms per caller; preserve data URLs and generated-image references; apply an explicit destination/redirect policy, streaming byte ceilings and timeouts to remote fetches; constrain filesystem reads to authorized roots where arbitrary paths are unnecessary.
- **Validation status:** Source inspection only. The command runner repeatedly failed to initialize during the 2026-10-09 retry, so no tests or runtime probes were run. Taskitty task #25 records regression criteria for private destinations, redirects, slow/oversized responses, content types and out-of-root paths.

## Remediation progress

- **SEC-07 / Taskitty #16:** Partially remediated in source. Remote browser login now exchanges the access token submitted by POST for a random 256-bit opaque session identifier; only its SHA-256 digest is stored server-side, with an eight-hour enforced expiry, lazy expiration cleanup, and a 4096-session cap. `/dashboard-logout` revokes the current session, URL-token requests are redirected to a clean URL, and login/logout responses are no-store. Cookies are Secure when the direct connection is TLS or `DASHBOARD_PUBLIC_BASE_URL` is HTTPS; local/LAN HTTP remains an explicit development/deployment exception. Sessions are process-local, so restart revokes all sessions. The 2026-10-09 dashboard build reported TS2552 because logout referenced a missing cookie reader; the helper has now been added and the focused build retry could not start for the same command-runner error. Acceptance remains: rerun the build and add session expiry/revocation/attributes and URL redaction regression tests, plus a clear TLS policy for production remote access. Card remains Under Review.

- **SEC-10 / Taskitty #25:** Partially remediated in source. `server/src/services/safeRemoteImage.ts` is now shared by the LLM image resolver and ComfyUI source-image staging. It accepts credential-free HTTP(S), rejects localhost/private IPv4 and IPv6 destinations after DNS lookup, rejects redirects, requires a supported image content type, enforces a 30-second total timeout, and streams at most 20 MiB before buffering. Acceptance remains incomplete: local filesystem inputs are still unrestricted, checked DNS addresses are not pinned to the socket connection (so DNS rebinding is not fully excluded), and no focused regression tests/build ran because the command runner failed to initialize. The card is Under Review until allowed local roots and connection-bound address validation are implemented and tests cover the stated cases.

- **REL-03 / Taskitty #20:** Partially remediated. Image overwrite now serializes requests per source image, stages the replacement under a fresh artifact ID, and preserves the original indexed record until the replacement import succeeds. A failed stage therefore leaves the old image available. The swap is not yet crash-atomic: process termination or a failure while deleting the old record can leave an orphan or a replacement-only index state, and no write/index/rename fault-injection or build/test run was possible on 2026-10-09 because the command runner failed to initialize. The card is Under Review pending durable rollback/recovery semantics and acceptance tests.

- **SEC-08 / Taskitty #17:** Implemented. A valid pairing code/QR token is consumed synchronously before the first await, so concurrent requests can create at most one device. Five failures lock out only that socket source address for 30 seconds; stale entries are pruned and the in-memory source map is capped at 256 clients. A regression test exercises concurrent credential reuse, attacker lockout and a second client's successful pairing. `scripts/check-companion-access-policy.ts`, dashboard TypeScript no-emit and `git diff --check` passed. This uses the TCP peer address; deployments behind a shared reverse proxy may need a trusted-proxy-aware client identity design.
- **SEC-04 / Taskitty #13:** Implemented. Shared JSON parsing now defaults to a 16 MiB streaming byte cap, with a 4 KiB cap on public device pairing and explicit 128 MiB caps on image/model data URL workflows to preserve current media transfer paths. Both declared Content-Length and actual streamed bytes are enforced; oversized bodies map to HTTP 413, including image generation's local error handler. Added parser checks for valid JSON, oversized declared and chunked bodies, and invalid JSON. `scripts/check-json-body-limits.ts`, all three relevant TypeScript no-emit checks and `git diff --check` passed. No live HTTP server was used. These byte caps do not bound simultaneous requests, slow uploads or total transfer bandwidth; admission limits remain tracked in SEC-05 (#14).
- **SEC-02 / Taskitty #11:** Implemented. `/tools/` now maps relative paths under the repository tools directory. Static paths are decoded before resolution, dotfile segments are rejected, and resolved real paths must remain inside their root, which blocks symlink escapes. Other dashboard asset roots receive the same realpath/regular-file containment checks. Focused traversal, backslash, dotfile and missing-file checks passed; dashboard and server TypeScript checks and `git diff --check` passed. No live HTTP request was sent.
- **SEC-09 / Taskitty #24:** Implemented. Markdown is sanitized when DOMPurify is available. When it is absent or throws, the helper renders the escaped Markdown source as text with preserved line breaks. Added missing/failing sanitizer regression cases; `npm run check:markdown-sanitizer`, dashboard TypeScript no-emit check and `git diff --check` passed. This prevents the sanitizer-missing path from returning raw parser HTML; the fallback intentionally displays Markdown syntax as text.
- **SEC-01 / Taskitty #10:** Implemented. The remote worker now requires a non-empty configured/native shared secret before it creates or binds its HTTP listener. The empty-secret bypass is removed, and credential checks use constant-time byte comparison. Public `/health` remains available when configured; capability, readiness and operation routes still require the secret. Worker startup still defaults to `0.0.0.0`, so a valid secret remains mandatory on that bind. README and project context document provisioning and the LAN/TLS boundary.
- Added focused checks for absent, whitespace-only, wrong, valid, and repeated header credentials. Focused check passed; `tsc --noEmit -p tsconfig.worker.json` and `tsc --noEmit -p server/tsconfig.json` passed.
- `npm run check:runtime` did **not** pass: its pre-existing `scripts/check-tauri-shell.mjs` assertion expected `URAGE_STUDIO_REPO_ROOT` in `src-tauri/src/lib.rs`, while the checked source contained a different `src-tauri/src/window.rs` implementation. The suite stopped at that check before reaching the newly added helper check. This appears unrelated to SEC-01; verify checkout state before treating the aggregate runtime suite as green. `git diff --check` passed.

## Follow-up order

Fix worker authentication, tools-path containment, browser-to-loopback authorization and bounded input parsing first. Then implement request/admission budgets, credential/session separation and the worker top-level error boundary. Address atomic pairing, import budgets and transactional overwrite with isolated failure tests. Keep remediation cards open until their acceptance criteria are met.

Taskitty's generated board snapshot is stored under `memory-bank/exports/1/`; refresh via MCP after task changes.
