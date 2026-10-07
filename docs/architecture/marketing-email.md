# Marketing email and email preferences

Owner decisions, 2026-10-06:

- Email registered gym owners and demo-request leads.
- Leads only with consent, given through an unticked box on the demo form.
- Every recipient can stop **marketing** and **product and security updates** separately, on `/unsubscribe`.

Code: `src/features/mailing/`. Consent capture: `src/features/leads/`.

## Sending

- **From:** `Metric Gym OS <hello@updates.metricgymos.com>`.
- **Reply-To:** `hello@metricgymos.com`, an alias of the admin@capitalistone.co Google Workspace mailbox.
- **Domain:** `updates.metricgymos.com`, verified in Resend on 2026-10-06 (region us-east-1). It has open and click tracking, with links on `links.updates.metricgymos.com`.

**Why a subdomain:** sign-up confirmations and password resets go out as `noreply@metricgymos.com` through Gmail. If they land in spam, nobody can register. Sending marketing from a subdomain keeps a campaign's complaints off that reputation.

**DNS:** the five records sit in Cloudflare (zone `metricgymos.com`), each with a comment naming Resend. Both CNAMEs are DNS-only, and none of the records touch the apex Google Workspace MX or SPF.

## Model in Resend

**Segment = eligibility, topic = choice.** A segment says who MAY receive a kind of email; a topic records what each person CHOSE. Leaving a segment never touches a topic.

| Resend object    | Name                         | What it is                                                                                                              |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Topic            | Marketing                    | Product news, offers and tips. `opt_in` by default                                                                      |
| Topic            | Product and security updates | New versions, changes, security notices. `opt_in` by default                                                            |
| Segment          | Marketing                    | Every gym, whatever its status, and every demo lead with `leads.marketing_consent_at` set. Marketing broadcasts go here |
| Segment          | Product updates              | Gyms with a current subscription: `trialing`, `active`, `past_due` (`audiencesForGym`). Update broadcasts go here       |
| Segment          | Test                         | Trial broadcasts only                                                                                                   |
| Contact property | `gym_name`                   | `{{{contact.gym_name\|your gym}}}`                                                                                      |
| Contact property | `gym_id`                     | On gym contacts: lets the sync find a gym's old address after an email change                                           |
| Contact property | `unsubscribe_token`          | HMAC for the footer link (below)                                                                                        |

The segments were renamed on 2026-10-06 (from "Demo leads" and "Gym owners", both still empty). **A cancelled or suspended gym gets marketing only** (owner decision, 2026-10-06): it leaves "Product updates" and stays in "Marketing" until it opts out. If it reactivates it rejoins "Product updates", and its own topic choices still apply.

The ids live in `features/mailing/config/MailingConfig.ts`, the single owner of the topics and audiences.

**`opt_in` means subscribed unless the contact opts out.** Resend's own wording is "All Contacts will receive the email unless they have explicitly unsubscribed from that Topic."

## Opting out is per topic, never global

`/unsubscribe` writes topic subscriptions only (`contacts.topics.update`, `opt_out`). It never sets the contact's `unsubscribed` flag.

Resend's global flag blocks **every** email the account sends: "The Contact will not receive any emails from your account, even if they are subscribed to individual Topics." Setting it would stop updates for someone who only wanted to stop marketing.

**What keeps arriving after opting out of both** is `ALWAYS_SENT_EMAILS`:

- emails the person asks for (sign-up confirmation, password reset, email change);
- billing and payment notices;
- notices the law requires.

The page and the privacy policy (§5 Email Communications) both render that one list, so they cannot drift apart. A test pins the policy to it.

**Every broadcast must be sent with a topic.** A broadcast without `topicId` goes to everyone in the segment, whatever they chose.

**Where a topic can be set:** in the Resend dashboard's broadcast editor, or through the API or SDK (`resend.broadcasts.create({ …, topicId })`). The Resend MCP's `create-broadcast` and `update-broadcast` have **no topic field** (plugin 1.0.5, checked 2026-10-06), so a broadcast made through the MCP reaches people who opted out. Do not send one that way.

## The unsubscribe link

Every broadcast's footer carries the link built by `unsubscribeLinkTemplate(topic)`.

Marketing:

```html
<a
  href="https://www.metricgymos.com/unsubscribe?email={{{contact.email}}}&token={{{contact.unsubscribe_token}}}&topic=marketing"
  >Unsubscribe or manage your email preferences</a
>
```

Product and security updates: the same link, ending `&topic=updates`.

**Verified 2026-10-06:** the test broadcast (Test segment, Marketing topic) rendered `{{{contact.email}}}`, `{{{contact.unsubscribe_token}}}` and `{{{contact.gym_name|your gym}}}` with the contact's stored values. Custom properties use the same `contact.` prefix as the built-in fields.

**The token.** It is `HMAC-SHA256(lowercased email, MARKETING_UNSUBSCRIBE_SECRET)` in base64url. It is stored on the contact when the contact is added, and checked in constant time when the form is submitted, so nobody can change another person's preferences by typing their email.

**Rendering the page makes no call.** A mail scanner opening the link changes nothing.

**A `+` arrives as a space.** `{{{contact.email}}}` is not URL-encoded, so `a+b@x.lk` reaches the page as `a b@x.lk`. The page and the API turn the space back into `+`, since an address cannot contain one.

**Case.** Resend matches contact emails case-sensitively (measured 2026-10-06): a contact stored with capitals is `not_found` under its lowercased address. The token is signed and checked over the lowercased address, so case never breaks a link. The write to Resend uses the address exactly as the link delivered it (`deliveredMailingEmail`), which is the stored form. **Never import contacts in the Resend dashboard**: the app and the sync create them lowercased, and a hand-imported mixed-case contact would be duplicated by the next sync.

**Confirmed, not assumed.** A topic write takes 1–2.5 s to read back. `optOut` polls the topics (10 reads, 800 ms apart) and throws if they never read `opt_out`, so the visitor is told to write to hello@ instead of seeing a false "Done". Every Resend request also carries an 8 s timeout, because the SDK applies none.

**Analytics.** The link carries `email` and `token`, both in `SENSITIVE_QUERY_PARAMS`, so Google Analytics never loads on the page.

**The secret must be the same everywhere.** The sync never overwrites an existing contact's token. A mismatch means this machine's `MARKETING_UNSUBSCRIBE_SECRET` differs from the one that signed the contact, so the contact is left alone and reported as `token_mismatch`. **Rotating the secret** is deliberate: put the new value in Vercel and `.env.local`, then run the sync with `--apply --rotate-tokens`. Until then, links signed with the old secret fail.

## Who is on the list: the nightly reconcile

**Demo leads.** Consent is the unticked box on the demo form. A ticked box is stored as `leads.marketing_consent_at`; the timestamp is the consent record. `SubmitLead` then adds the lead to "Marketing" straight away. That step is best-effort, like the lead email: the lead is stored whatever Resend answers, and the nightly reconcile adds anyone it missed.

**Gyms.** The legal basis is our legitimate interest in writing to our own customers, stated in the privacy policy (§3, §5).

**`SyncMarketingContacts` reconciles the lists with the app.** It runs every night at 01:00 UTC (`/api/cron/sync-marketing-contacts`, logged to `cron_logs`), after the status crons that write `gyms.subscription_status`. `scripts/sync-marketing-contacts.ts` runs the same use-case by hand (dry run by default). Against the prefetched membership of both segments, it:

1. **Moves** a gym whose email changed. A contact at the old address carries the gym's `gym_id`, and that gym now has another address. The sync puts a contact at the new address in the gym's segments, copies every opted-out topic onto it (confirmed by read-back), and only then deletes the old contact. Opt-outs therefore survive an email change.
2. **Removes** an address that is nobody's any more, such as a deleted gym or a newly excluded one, from both segments. It does not delete the contact, so its opt-outs are kept.
3. **Takes out of "Product updates"** a gym that is cancelled or suspended.
4. **Adds** anyone missing from a segment they belong in. `addContact` never writes topics and never overwrites a stored token.

Steady state costs two list calls. Each step is recorded, and one failure does not stop the rest. Verified against the live API on 2026-10-06 with test addresses:

- the move carried a Marketing opt-out and deleted the old contact;
- a cancelled gym left "Product updates" with its topic untouched;
- a stale address was taken off both lists and kept.

**Exclusions:**

- `SMS_DISABLED_GYM_IDS`: the E2E gyms;
- `MARKETING_EXCLUDED_GYM_IDS`: the owner's own and test accounts, i.e. Throwaway, Titan Fitness, Demo Gym and Throwaway2 (2026-10-06);
- `--exclude-gym` / `--exclude` on the script;
- always, reserved TLDs (`.test`, `.example`, `.invalid`, `.localhost`, `.local`), whose hard bounces would cost the new sending domain reputation.

An excluded address already on a list is taken off it.

## Announcements: release and policy-change emails

Two emails go out by themselves (owner request, 2026-10-06):

- **A release email** when a new version reaches production, whatever the bump (major, minor or patch). It is compiled from that version's `CHANGELOG.md` section, which the owner's release writes (`npm run version:gui` → `scripts/generate-changelog.js`).
- **A policy notice** when `/privacy`, `/terms` or `/refund-policy` changes materially. It is compiled from the page's entry in `features/marketing/config/legalChanges.ts`.

Both go to the **"Product updates"** segment: gyms that are trialing, active or past_due. Owner decisions, 2026-10-06:

- **Releases carry the Updates topic**, so an Updates opt-out stops them.
- **Policy notices carry no topic**, so they reach every current gym, whatever its choices. `ALWAYS_SENT_EMAILS` lists them, and so do /unsubscribe and privacy §5. The mail app's one-click button (the global flag) still stops them.

### The pipeline

`/api/cron/send-announcements` runs daily at 04:00 UTC (09:30 SLT), after the 01:00 sync, so the segment is current. Its use case is `SendAnnouncements`. For each thing to announce, it does this:

1. **Checks `mailing_announcements`.** This holds one row per `(kind, ref)`, enforced by a unique constraint (RLS on, no policies, service role only). A row that already exists means the thing was announced, or another run holds it.
2. **Fetches the Resend template** by alias, `release-announcement` or `policy-update`. If it is missing or not published, the run sends nothing and holds nothing, so the next day tries again.
3. **Fills it.** Broadcasts take finished HTML, not a template id; templates work only with single sends. The pipeline therefore fills the template's `{{{VARIABLE}}}`s itself and leaves `{{{contact.*}}}` for Resend. **A placeholder left with no value and no fallback stops the send.**
4. **Claims the row**, before Resend sees anything.
5. **Previews** to the **Test** segment at once (playershyan@gmail.com), with "[Preview]" in the subject and a banner naming the send time and the broadcast to cancel. If the preview fails, nothing reaches a gym, and the claim is released.
6. **Schedules the real broadcast 24 hours later**, moved to 09:30 the next morning if that falls outside 09:00–19:00 Sri Lanka time (`nextSendTime`). That is the owner's veto: cancel it at resend.com/broadcasts before then. **The preview must reach someone:** if no contact in the Test segment can receive it (empty, or every contact unsubscribed, as one tap on Gmail's unsubscribe button does), nothing is sent to the gyms.

**Never twice.**

- A failed real send is ambiguous: Resend may have created it before the timeout. The claim therefore stays `pending`.
- After 15 minutes the claim is reconciled by broadcast **name** (`release-1.2.0`, `policy-privacy-2026-10-06`). It is created again only if Resend has no broadcast of that name, and the preview is never sent twice.
- Once a scheduled send's time has passed, the job records what Resend did: `sent`, or `canceled`. A cancelled broadcast reads back as `draft`.

**Which release.**

- Every changelog section above the last announced version, up to and including the deployed `APP_VERSION`, becomes **one** email (a digest).
- If the deployed version has no section, nothing is sent: the changelog was not written for this release.
- A version whose lines are all internal records `skipped`. Internal lines are headings other than Breaking, Added, Changed, Removed, Fixed, Performance and Security, and scopes `ci`, `test`, `docs`, `deps`, `build`, `dev`, `e2e`, `arch` and `lint`.
- Before the first announcement, only the deployed version is considered, never the whole history.

**Which policy change.** `legal-text-fingerprints.test.tsx` fingerprints each legal page's text under its date, so changed wording without a new date fails the tests instead of reaching nobody.

**Which policy notice is sent.**

- Only entries marked `notify: true` whose date has arrived in Sri Lanka are sent.
- Only the newest such entry per page is sent. Its summary must cover the older ones it replaces.
- `legalChanges.test.ts` fails when a legal page's `lastModified` has no entry, so a policy edit cannot ship without deciding whether to notify.

### The template contract

`config/AnnouncementConfig.ts` (`ANNOUNCEMENT_VARIABLES`) is the contract. `scripts/send-announcements.ts` checks each published template against it.

| Template               | Variables                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release-announcement` | `VERSION`, `RELEASE_DATE` ("20 October 2026"), `RELEASE_TYPE` ("Major update" \| "New features" \| "Fixes and improvements"), `SUMMARY` ("2 new features, 1 improvement and 3 fixes"), `CHANGES_HTML`, `IMPORTANT_HTML`/`NEW_HTML`/`IMPROVED_HTML`/`FIXED_HTML`/`SECURITY_HTML` with a `*_COUNT` each, `APP_URL`, `UNSUBSCRIBE_URL` |
| `policy-update`        | `DOCUMENT_NAME`, `DOCUMENT_URL`, `UPDATED_DATE`, `SUMMARY_HTML`, `SUMMARY_TEXT`, `PREFERENCES_URL`                                                                                                                                                                                                                                  |

Text values are HTML-escaped, braces included, so nothing from the changelog can become markup or a placeholder.

**`*_HTML` values.**

- They are lists that carry spacing but no colour or font. Wrap `{{{CHANGES_HTML}}}` in a styled cell and they inherit its style.
- `CHANGES_HTML` holds only the groups that have changes, each with its heading. Templates have no conditionals, so this is the way to avoid an empty "Security" heading.

**Links.**

- `UNSUBSCRIBE_URL` stops Updates.
- `PREFERENCES_URL` opens /unsubscribe with nothing pre-ticked. A policy notice cannot honestly offer "stop these".

**The designs live in the repo.** `config/announcementTemplates.ts` holds both emails, written for gym owners: what changed in plain words, "nothing to install", a button, and a person to reply to or WhatsApp. The version number sits only in the footer. `scripts/publish-email-templates.ts` creates or updates them in Resend under their aliases and publishes them; `--check` reports drift and changes nothing. The Release workflow runs it whenever that file changes, so **editing the file is how the design changes**. An edit made in the Resend editor is overwritten by the next change to the file. `announcementTemplates.test.ts` holds the designs to the contract: only filled variables, a full render, an opt-out link, the postal address, and nothing fixed-width. Text variables are declared with **no** fallback, so an unfilled one stops the send instead of going out blank. Published 2026-10-06; rendered at 320, 390 and 1200 px with no overflow.

**Template requirements**, measured 2026-10-06:

- A template **may** use `{{{contact.gym_name|there}}}`; Resend keeps it as written.
- Size the main table `width="100%"` with `max-width:560px`. A fixed `width="560"` widened a 390 px phone to 592 px.
- `templates.get` returns the **published** version even while an edit is unsaved (`has_unpublished_versions: true`). A template mid-edit is therefore never what gets sent; only publishing changes the email.

### Releases are automatic

`.github/workflows/release.yml` runs on every push to master. Nobody tags, bumps or writes the changelog by hand.

1. **`scripts/release.js` reads the commit types** since the last version tag: breaking (`feat!:`, `fix(api)!:`, `BREAKING CHANGE:`) → major, `feat` → minor, `fix`/`perf` → patch, anything else → no release. It bumps `package.json`, writes the version's `CHANGELOG.md` section (dated in Sri Lanka), regenerates the PWA version files, commits `chore(release): vX.Y.Z` and tags it.
2. **The commit and tag are pushed together.** A push made with `GITHUB_TOKEN` starts no workflow, so the job never triggers itself. Release commits are authored as the repository owner, like every other commit here, so Vercel attributes the deployment to a project member.
3. **Changed designs are published** to Resend.
4. **Once the final commit is live in production** (`scripts/wait-for-deployment.js` watches GitHub's record of Vercel's "Production – gym-management-saas" deployment), the job calls `/api/cron/send-announcements` with `CRON_SECRET`. The preview arrives within minutes of the deploy, and the gyms get the email 24 hours later. A timeout only warns, because the daily 09:30 SLT run still announces it.

**What gyms read.** Each `feat`, `fix`, `perf` or breaking commit becomes a line, under "New features", "Improvements", "Fixes" or "Please note". By default the line is the commit's subject without its scope. A **`Release-Note:` line** in the commit body replaces it word for word. Write it for a gym owner, e.g. `Release-Note: Members can now pay part of a fee and settle the rest later.` **`Release-Note: none`** keeps an internal change out of the changelog and the email; the release still happens. A GitHub squash puts every inner commit's message in the body: each real note there becomes a line, and an inner `none` never hides the squashed change. A note wrapped onto indented following lines is joined back together. The `commit-msg` hook suggests a note on every `feat`/`fix`/`perf` commit without one, and never blocks. A release whose changes are all internal gets the line "Behind-the-scenes improvements only", and no email.

**The baseline** is the tag `v1.0.0` on `c144d1f`, master before announcements shipped (created 2026-10-06). "Since the last release" needs a tag to count from, and the whole history is not a release note.

**Secrets** (GitHub → Settings → Secrets and variables → Actions): `CRON_SECRET`, production's value, and `RESEND_API_KEY`, the full-access key. Set by the owner on 2026-10-06, and verified from Actions the same day: production answered 200 to the secret and 401 to a wrong one, and the key read both published designs. Either secret missing skips its step with a warning.

**Checked, not trusted.** `scripts/trigger-announcements.js` reads the cron's answer:

- an answer from an older deployment (the release entry names the version that ran) or a 5xx is asked again every 20 s, for up to 3 minutes;
- any failed email fails the run.

The run checks out the newest master. If master moves while a release is cut, it warns and steps aside, and the queued run releases everything.

**The old local flow is retired.** The `post-merge` hook that drafted the Unreleased section on every pull is removed (the installer deletes an installed copy): its uncommitted edits would collide with the workflow's changelog commits on the next pull. The Version Manager GUI still works for a deliberate manual release; the workflow then finds nothing new since that tag.

**Commands** (`npx tsx scripts/send-announcements.ts`):

- The **dry run** is the default. It renders what today's run would send, writes each email to an HTML file, and reports each template's status, the variables it uses, and any that would block the send.
- `--apply` does the cron's run by hand.
- **Re-sending after a cancel:** `--apply --force release 1.2.0` (or `--force policy privacy@2026-10-06`) forgets that row and announces again.
- **Trials:**
  - `--test-only`, with optional `--changelog <file>`, `--app-version <x.y.z>` and `--legal <file.json>`;
  - fixture data is refused without `--test-only`;
  - use a version below every real one (`0.0.1`) and an old date, and delete the trial rows afterwards: a trial row at `9.9.0` would stop every real release below it from being announced.

**Verified live on 2026-10-06**, on the Test segment, with throwaway templates (since deleted):

- the preview was queued at once;
- the real send was scheduled 24 hours on, with the Updates topic for the release and no topic for the policy notice, and no placeholder left;
- a second run sent nothing;
- lookup by name found the broadcast;
- a cancel read back as `draft` and was recorded `canceled`.

## Outreach: introducing Metric to gyms that have not heard of it

A four-email introduction series, one email a week, to gyms whose contact email is on a public page such as the gym's website or a business listing (owner request, 2026-10-06).

**The four emails.** All are in `config/outreachCampaign.ts`, and every address gets them in order:

1. "Tired of chasing payments?", the SMS that brought in calls.
2. **The reminders:** what members are sent and when, as `ReminderConfig` sends them. Monthly members get them 3 days before and on the due day, longer plans 7 days before as well, and an overdue reminder follows once.
3. **The money:** what members owe this month against what was collected.
4. **Getting started:** sign-up, bulk import, the QR poster. It says it is the last.

**What every email holds:**

- **Figures** from `pricing.ts` and `site.ts`.
- **Claims** only the product backs. Metric does not collect money, and the homepage tests ban that claim.
- **Sample figures** labelled "(example)".
- **WhatsApp:** the phone number, and the button where there is one, open WhatsApp with the demo request typed.
- **A plain-text part.**
- **A footer** that says where the address came from and which email of four it is, gives the company's postal address, and carries the recipient's own signed **Unsubscribe** link (Marketing topic).

`outreachCampaign.test.ts` holds all four to this.

**Stopping them works two ways, both on the backend:**

- the footer link opens /unsubscribe;
- every email carries one-click `List-Unsubscribe` and `List-Unsubscribe-Post` headers (RFC 8058). Gmail's, Yahoo's and Outlook's own "Unsubscribe" button POSTs to `/api/public/email-preferences/one-click`, which verifies the signed token and opts the address out of Marketing at once. A GET (a person opening the link) is sent to /unsubscribe and changes nothing.

Either way Resend's `contact.topics.updated` webhook marks the address `unsubscribed` at once (the next run would also find it), and it is never written to again. A third way, for mail apps that unsubscribe by sending an email (Apple Mail among them): the header's `mailto:` is `unsubscribe@go.metricgymos.com`, which Resend receives; see "Looking after itself" below.

**Its own sending domain.** The series comes from `Metric Gym OS <hello@go.metricgymos.com>`, and replies go to `hello@metricgymos.com`.

- The domain was verified 2026-10-06, with tracking off: tracked links are a spam signal on cold email.
- Its DNS sits in Cloudflare.
- A cold list's spam complaints cannot touch `updates.metricgymos.com`, the customer email domain.
- It also receives mail (enabled 2026-10-07: MX `go.metricgymos.com` → `inbound-smtp.us-east-1.amazonaws.com`, priority 10), for `unsubscribe@` and anyone who writes to the From address. The root domain's own mail (Google) is untouched.

**The daily run.** `/api/cron/send-outreach` runs daily at 04:30 UTC, 10:00 SLT (`SendOutreach.runWeek`), starting on `OUTREACH_STARTS_AT` (13 Oct 2026):

- **Who is due:** every `active` address with emails left that has not been written to for 6 days gets its next one. Each address therefore hears once a week.
- **Why daily:** individual emails count against Resend's **100-a-day** limit, so each run sends at most `OUTREACH_DAILY_LIMIT` (80), and a longer list simply takes more days.
- **Claimed before sending:** the step is claimed in `outreach_recipients`, and Resend gets an idempotency key per address and step, so nothing goes twice.
- **Before every send:**
  - an address that has since become a gym or a demo request ends its series (`done`);
  - one that has unsubscribed, or whose Resend contact was deleted, is marked `unsubscribed`.
- **Failures:** one address's trouble never stops the rest of the run. A failed send is undone and retried a week later; three in a row stop the address.
- **Time limit:** no new send starts after 180 s of the function's 300 s, so a run is never cut off between claim and send.
- **Logs:** every email is **tagged in Resend** (`kind=outreach`, `campaign`, `email` = 1 to 4), so Resend → Emails can be filtered to the series. Each run's counts go to `cron_logs`, as a failure when any email failed.
- **One-click:** unsubscribes are rate-limited per address, not per IP, because Gmail sends everyone's from a handful of servers.
- **The brake:** nothing is sent while the campaign is paused. The run checks the safety brake before it starts and again before every send.
- **Mail replies:** a person's reply goes to hello@ and is read by a person. Someone who writes "please remove me" there still needs `--remove`; the footer link and the mail app's button are automatic.

### Looking after itself

The two owner tasks the series started with — removing whoever unsubscribed by email, and checking Resend for bounces and spam complaints after each send — are automated (owner request, 2026-10-06). One webhook, `POST /api/webhooks/resend` (`HandleMailingEvent`), receives `email.bounced`, `email.complained`, `email.suppressed`, `email.received` and `contact.topics.updated`:

| What happened                                                | What it does                                                                                                                                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An outreach email hard-bounced (`bounce.type` = `Permanent`) | The address becomes `bounced` in every campaign. A `Transient` or `Undetermined` bounce is left alone: Resend retries it.                                                                           |
| It was marked as spam                                        | `complained`, and the address is opted out of Marketing.                                                                                                                                            |
| Resend refused to send it (`email.suppressed`)               | `bounced`, or `complained` when `suppressed.reason` names a complaint (`type` is always `"Suppressed"`), recorded as a `suppressed` event, which the brake does not count: no mail provider saw it. |
| Mail arrived for `unsubscribe@go.metricgymos.com`            | The sender is opted out of Marketing and marked `unsubscribed`.                                                                                                                                     |
| Any other mail arrived on `go.metricgymos.com`               | Forwarded to hello@ as text, with Reply-To set to the writer (`ResendOwnerMailer`). Their HTML is never passed on: it would arrive under our own address.                                           |
| A contact opted out of Marketing anywhere                    | `unsubscribed` at once.                                                                                                                                                                             |

Only email sent **from** `go.metricgymos.com` counts as outreach; bounces and complaints on gym email are ignored here. The signature (`RESEND_WEBHOOK_SECRET`, Standard Webhooks via the SDK, five-minute replay window) is the only credential: unsigned or forged gets 401, an event not acted on or a malformed one gets 200, and a fault gets 500 so Resend retries. Every step is safe to repeat: a status only moves to a stronger one (active, done, failed < unsubscribed < bounced < complained), and an event is written only when a status changes, so a webhook delivered twice counts once.

**`outreach_events`** records each send and each stop (`sent`, `unsubscribed`, `bounced`, `complained`, `suppressed`). **`outreach_campaigns`** holds the pause and the weekly summary's claim. Both have RLS on and no policies.

The ledger is written before Resend is told of an opt-out, because every opt-out makes Resend send its own `contact.topics.updated`, which must find the complaint already recorded.

**The safety brake** (`OutreachBrake`, thresholds in `OUTREACH_BRAKE`) pauses a campaign at **2 spam complaints**, or when **more than 5%** of its sends bounce once there are **40 sends** to judge by. It counts from the start, or from the owner's last `--resume`, so an old spike cannot pause a resumed campaign again. The webhook checks it as each bounce or complaint arrives, and the run before every send, so a spike mid-run stops it at the next address. The pause is owned by the one caller whose conditional write set it. The owner's alert ("Outreach paused: …", to hello@ from `updates.metricgymos.com`, so it arrives even if `go` is in trouble) is at-least-once: a failed send leaves it owed, and the next check sends it. A paused run is logged to `cron_logs` as a failure. Only the owner resumes. **It cannot see Gmail's spam reports:** Gmail does not report complaints per message, so for Gmail and Google-hosted addresses (most of the list) a spam report reaches the brake only as an unsubscribe, via "Report spam & unsubscribe" (`outreach-inverted-check.md`, "The automations").

**The weekly summary** (`SendOutreachSummary`) goes to hello@ on Mondays at 10:00 SLT, from the daily run. It holds the last 7 days (sent, bounced, complaints, unsubscribed), where every address stands, and whether the campaign is running, paused (with the resume command) or finished. The week is claimed in `outreach_campaigns` before the send, so it goes at most once. A failed summary is logged and never stops the day's emails. Once the series has finished and a week passes with nothing to report, it stops.

Inverted check of the series: `outreach-inverted-check.md`.

**Who is taken in.**

- `--import` reads the list whatever its headers. A `website` column is recorded as each address's `source`.
- It leaves out every gym's and every demo request's address (`listKnownEmails`, consent or not), compared by **inbox** (`mailboxKey`): `owner+promo@gmail.com` and `o.w.n.e.r@googlemail.com` are the owner's own inbox. Each run re-checks the same way.
- It records the rest and adds each to **Resend's contacts** (with its unsubscribe token, in no segment), so the nightly sync never touches them.
- A gym that later signs up keeps its contact and its opt-outs.

**The first list (2026-10-06).** From 149 websites the owner collected, 82 businesses were taken in, with one address each: Sri Lankan gyms and fitness, martial-arts, yoga and dance studios. 67 were left out:

- Wix error-reporting addresses and placeholders;
- universities, schools, hotels, a monastery, retailers, directories, media and tour operators;
- businesses outside Sri Lanka;
- a page listing ~50 private individuals worldwide;
- the access-control hardware vendor.

The included and excluded lists, with reasons, were given to the owner and are kept out of the repo.

**Commands** (`npx tsx scripts/send-outreach.ts`):

- `--import list.csv` (`--apply` to record);
- `--test you@x --email 1-4`;
- `--run` (the weekly run by hand; `--apply` to send);
- `--remove someone@x`;
- `--status` (including whether the campaign is paused);
- `--pause "why"` and `--resume`;
- `--summary` (writes this week's summary to a file; `--apply` sends it to hello@ now).

**Privacy.** Policy §5 describes the series: where the address comes from, up to four emails a week apart, how to stop them (the link or the mail app's button), and what is kept and why.

## Configuration

| Variable                       | Where                                      | Notes                                                                                      |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`               | Vercel (Production, Preview), `.env.local` | Full-access key "metric-website". A sending-only key gets 401 on contacts                  |
| `MARKETING_UNSUBSCRIBE_SECRET` | Same                                       | At least 32 characters; `openssl rand -hex 32`                                             |
| `MARKETING_EXCLUDED_GYM_IDS`   | Vercel (Production, Preview), `.env.local` | Comma-separated gym ids never put on the lists (owner and test accounts)                   |
| `RESEND_WEBHOOK_SECRET`        | Vercel (Production), `.env.local`          | Signing secret of Resend webhook `774cc897`; `/api/webhooks/resend` answers 500 without it |

**If either is unset:**

- `/unsubscribe` answers 503 and asks people to write to hello@metricgymos.com;
- consenting leads are stored, but not added to Resend;
- the sync refuses to run;
- `send-announcements` fails without `RESEND_API_KEY`, logged as a failure in `cron_logs`. It does not need the secret: the footer link reads each contact's stored token.

**Tests:** `tests/setup.ts` deletes both variables, so no unit test can reach the live account.

## Not built (yet)

- **Resubscribing** is by email to hello@. Resend's hosted preference page (`{{{RESEND_UNSUBSCRIBE_URL}}}`) is not used, because it also offers the global unsubscribe.
- **Gmail's one-click unsubscribe sets the account-wide flag** (measured 2026-10-06). Resend adds `List-Unsubscribe: <https://unsubscribe.resend.com/?token=…>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` to every broadcast. The token names the contact, the segment and the broadcast, but not the topic. Posting the one-click returned 204 and set `unsubscribed: true` with both topics still `opt_in`, which blocks every broadcast. Broadcasts take no custom headers, so this cannot be pointed at `/unsubscribe`. Privacy §5 states it: the mail app's button stops both kinds, and the footer link stops one. The reconcile never clears the flag; that is the person's choice.

## Inverted check

The falsifying check of 2026-10-06 (`marketing-email-inverted-check.md`) found and fixed:

- the missing timeouts;
- the case-sensitive opt-out that reported success;
- the token overwrite;
- the referrer leak to the next page;
- the undeliverable-TLD import;
- two privacy-policy statements the product did not back.

It left two holes for the owner: topic filtering of broadcasts, and the `List-Unsubscribe` header.
