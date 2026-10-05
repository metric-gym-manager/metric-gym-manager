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

| Resend object    | Name                         | What it is                                                           |
| ---------------- | ---------------------------- | -------------------------------------------------------------------- |
| Topic            | Marketing                    | Product news, offers and tips. `opt_in` by default                   |
| Topic            | Product and security updates | New versions, changes, security notices. `opt_in` by default         |
| Segment          | Gym owners                   | Every registered gym (`gyms.email`). Receives both topics            |
| Segment          | Demo leads                   | Leads with `leads.marketing_consent_at` set. Receives marketing only |
| Segment          | Test                         | Trial broadcasts only                                                |
| Contact property | `gym_name`                   | `{{{contact.gym_name\|your gym}}}`                                   |
| Contact property | `unsubscribe_token`          | HMAC for the footer link (below)                                     |

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

**The token.** It is `HMAC-SHA256(lowercased email, MARKETING_UNSUBSCRIBE_SECRET)` in base64url. It is stored on the contact when the contact is added, and checked in constant time when the form is submitted, so nobody can change another person's preferences by typing their email.

**Rendering the page makes no call.** A mail scanner opening the link changes nothing.

**A `+` arrives as a space.** `{{{contact.email}}}` is not URL-encoded, so `a+b@x.lk` reaches the page as `a b@x.lk`. `normalizeMailingEmail` turns the space back into `+`, since an address cannot contain one.

**Analytics.** The link carries `email` and `token`, both in `SENSITIVE_QUERY_PARAMS`, so Google Analytics never loads on the page.

**Rotating the secret** breaks every link already sent. After a rotation, re-run the sync: it rewrites a contact's token when it no longer matches.

## Who is on the list

**Demo leads.** Consent is the unticked box on the demo form. A ticked box is stored as `leads.marketing_consent_at`; the timestamp is the consent record. `SubmitLead` then adds the lead to Demo leads. That step is best-effort, like the lead email: the lead is stored whatever Resend answers.

**Gym owners.** `scripts/sync-marketing-contacts.ts` adds every gym to Gym owners. The legal basis is our legitimate interest in writing to our own customers, stated in the privacy policy (§3, §5).

**The sync is additive only.** For an existing contact it may add a segment and rewrite a stale token. It never writes topics or the `unsubscribed` flag, so an opt-out survives every re-run.

**Running it:**

- It is a dry run by default; `--apply` writes.
- It skips the E2E gyms (`SMS_DISABLED_GYM_IDS`, or `--exclude-gym <id>`) and anything passed with `--exclude <email>`.
- Run it before each broadcast to Gym owners. New gyms are not added at registration.

## Configuration

| Variable                       | Where                                      | Notes                                                                     |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------- |
| `RESEND_API_KEY`               | Vercel (Production, Preview), `.env.local` | Full-access key "metric-website". A sending-only key gets 401 on contacts |
| `MARKETING_UNSUBSCRIBE_SECRET` | Same                                       | At least 32 characters; `openssl rand -hex 32`                            |

**If either is unset:**

- `/unsubscribe` answers 503 and asks people to write to hello@metricgymos.com;
- consenting leads are stored, but not added to Resend;
- the sync refuses to run.

**Tests:** `tests/setup.ts` deletes both variables, so no unit test can reach the live account.

## Not built (yet)

- **Resubscribing** is by email to hello@. Resend's hosted preference page (`{{{RESEND_UNSUBSCRIBE_URL}}}`) is not used, because it also offers the global unsubscribe.
- **New gyms** join Gym owners only when the sync runs, not at registration.
- **List-Unsubscribe headers:** whether Resend adds them to broadcasts sent with a custom footer link is unverified. Check a received broadcast's headers before the first send to more than the Test segment.
