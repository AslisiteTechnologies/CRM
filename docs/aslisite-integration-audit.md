# Aslisite CRM — integration audit and migration plan

Date: 2026-10-19  
Status: **planning only; no runtime changes**  
Repository: `AslisiteTechnologies/CRM` (Next.js + Supabase)

## Goal and boundaries

Use CRM as the system of record and operator dashboard for contacts, sales deals, WhatsApp conversations, opt-in/out, and automation status. Integrate the existing Aslisite Website Engine for site generation and previews. Replace the retired Google Apps Script trigger ownership with a single, observable scheduler/queue, without recreating working CRM capabilities.

**Do not** modify Meta phone/WABA IDs, webhooks, access tokens, live inbound handlers, production deployment settings, or enable outbound messaging as part of this audit. Keep existing Automations and Flows inactive.

## Verified CRM capabilities

| Capability | Evidence | Integration decision |
| --- | --- | --- |
| WhatsApp inbound handling and dispatch | `src/app/api/whatsapp/webhook/route.ts` | Keep as the sole Meta webhook receiver; avoid competing Meta consumers. |
| CRM contacts | `src/app/api/v1/contacts/route.ts`; `src/components/contacts/contact-form.tsx` | Reuse contact management and tags. |
| Deals and pipeline stages | `src/app/(dashboard)/pipelines/page.tsx`; `src/components/pipelines/deal-form.tsx` | Reuse for sales opportunities; separate fulfillment state. |
| Rules, steps, logs, delayed jobs | `src/lib/automations/engine.ts`; `src/app/api/automations/cron/route.ts` | Reuse only where trigger semantics fit. |
| Guided conversation flows | `src/app/(dashboard)/flows/page.tsx`; `src/app/api/flows/cron/route.ts` | Leave disabled until routing ownership is established. |
| AI drafting/configuration | `src/app/(dashboard)/agents/page.tsx`; `src/app/api/ai/draft/route.ts` | Optional; add only after deterministic workflows are proven. |
| Public scoped API | `docs/public-api.md`; `src/app/api/v1/*` | Preferred authenticated integration surface for supported operations. |

The CRM's documented API-key scopes include contacts read/write, messages send/read, conversations read, broadcasts send, and webhook management. It does **not** document a general deals/projects/job-management API.

## Confirmed gaps and constraints

1. **Email-only leads:** `POST /api/v1/contacts` rejects a missing phone, and the manual contact form also requires one. The old prospect-discovery criterion is **no website + phone OR email**. Do not create fake phone numbers or silently drop email-only leads. Decide on a separate prospect staging model or safely extend contact schema/API/UI after checking constraints, uniqueness, RLS, and WhatsApp identity handling.
2. **Project lifecycle:** CRM deals are sales opportunities, not website build jobs. Add structured project/job records with preview URL, project slug, package, deposit state, build/revision/launch status, and immutable external job IDs as needed.
3. **Scheduling:** The existing delayed-automation route requires `AUTOMATION_CRON_SECRET` and `x-cron-secret` header; the Flows timeout sweeper is independent. Neither is proof that a live scheduler is configured. Decide which host invokes each route and how retries/health alerts work.
4. **Inbound fan-out:** The WhatsApp webhook already invokes automation, Flow, and AI reply paths. Establish one reply-owner policy before enabling any autonomous response to prevent duplicates.
5. **Outbound compliance:** Track consent, opt-out, suppression, Meta template approval, and 24-hour service-window eligibility. Do not send unsolicited WhatsApp outreach to scraped numbers.
6. **Website Engine access:** The separate Website Engine repository was **not accessible under the attempted `AslisiteTechnologies/aslisite-website-engine` name** in this audit. Its actual repository, endpoints, auth, and deployment code must be verified before implementation; prior architectural discussion is not a substitute for code review.

## Target architecture

```text
Meta Ads / Google Places / inbound WhatsApp
                 |
       Lead intake + normalization
                 |
    Consent / suppression / dedupe
                 |
       CRM contacts + prospects
                 |
      Qualification + sales deal
                 |
   Idempotent website-preview job
                 |
      Existing Website Engine
                 |
      Preview URL + job events
                 |
   CRM project/deal updates + UI
                 |
   Approved follow-up / handoff
```

**Ownership boundaries**
- **CRM**: customer records, contact channels, WhatsApp webhook/inbox, deal stages, consent/suppression, operator controls, orchestration status.
- **Website Engine**: category-agnostic website specification, build/revision, preview generation, deploy/promotion, hosting-specific work.
- **Lead acquisition adapter**: Google Places/Meta ingestion, normalization, provenance, rate/usage limits, eligibility.
- **Scheduler/worker**: retries, delayed actions, concurrency, idempotency, health; one authoritative execution owner per job.

## Recommended implementation sequence

1. **Baseline and safety**: confirm existing production environment, current Meta receiver, migrations applied, deployment topology, scheduler ownership, and backup/rollback process. Capture baseline `npm run typecheck`, `npm test`, and `npm run build` in an executable checkout/CI. This audit did not execute those commands.
2. **Read-only intake design**: inspect the actual Website Engine repository and Apps Script source/archive; map current workflows and APIs. Produce a field map and migration matrix before moving customer data.
3. **Prospect model**: add phone-or-email intake without weakening WhatsApp contact identity guarantees; enforce tenant isolation, deduplication, provenance, and suppression. Add migration and tests.
4. **Job/project model**: implement CRM-visible preview jobs and project statuses with authenticated service-to-service callbacks or polling, idempotency keys, bounded retries, and audit history. Reuse existing website generation and preview hosting.
5. **Lead routing**: test deterministic tagging, qualification, and deal creation without sending messages; prevent duplicate deal creation and webhook loops.
6. **Outbound safety**: opt-in/opt-out, template eligibility, 24-hour window, approval gates, daily caps, and an emergency kill switch. Only then test messages to an owned number.
7. **Operational rollout**: staging → monitored pilot → production, with dashboard logs, queue visibility, retry/replay, and rollback. Retired Apps Script triggers must remain off to avoid double execution.

## Aslisite-specific operating decisions

- Category-agnostic businesses, not gym-only.
- Lead eligibility: no identified website and at least one contact method (phone or email).
- CRM currency: INR; existing packages START ₹7,500, GROW ₹15,000, PRO ₹25,000+; pricing is configurable, not hard-coded into routing.
- CRM pipeline configured by operator: New Lead, Qualified, Demo Ready, Contacted, Interested, Proposal Sent, Won, Lost.
- CRM tags configured by operator: source-google-places, source-meta-ads, no-website, demo-ready, outreach-pending, interested, human-required, do-not-contact.
- Maintain 99%-hands-free goal without eliminating safety controls for outbound messaging, billing, or destructive operations.
- Prefer low-cost hosting, but verify free-tier limitations before choosing an always-on worker or cron host.

## Open decisions before writing runtime code

- Exact Website Engine repository and service base URL, and whether the engine is currently deployed on Render or elsewhere.
- CRM deployment/scheduler constraints and whether a reliable background worker already exists.
- Whether Google Places acquisition remains in scope alongside Meta Ads.
- Whether to keep email-only prospects in a separate staging table or migrate to a broader CRM contact schema.
- Whether the first rollout is inbound-only or includes consented outbound prospecting.

## Acceptance gates

- No duplicate Meta webhook subscriptions or automatic responses.
- Existing live Inbox, contacts, deals, and WhatsApp configuration remain functional.
- No secrets in Git, logs, or client-side bundles.
- All integration APIs enforce account isolation and least privilege.
- Every lead/job can be safely retried without duplicate contacts, deals, sites, or outbound messages.
- Feature flags default off; rollback is documented; tests and migrations verified before merge.

This file is a planning deliverable. It does not assert that the live Website Engine, schedulers, or outbound integrations have been verified.
