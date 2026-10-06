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

## Configuration

| Variable                       | Where                                      | Notes                                                                     |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------- |
| `RESEND_API_KEY`               | Vercel (Production, Preview), `.env.local` | Full-access key "metric-website". A sending-only key gets 401 on contacts |
| `MARKETING_UNSUBSCRIBE_SECRET` | Same                                       | At least 32 characters; `openssl rand -hex 32`                            |
| `MARKETING_EXCLUDED_GYM_IDS`   | Vercel (Production, Preview), `.env.local` | Comma-separated gym ids never put on the lists (owner and test accounts)  |

**If either is unset:**

- `/unsubscribe` answers 503 and asks people to write to hello@metricgymos.com;
- consenting leads are stored, but not added to Resend;
- the sync refuses to run.

**Tests:** `tests/setup.ts` deletes both variables, so no unit test can reach the live account.

## Not built (yet)

- **Resubscribing** is by email to hello@. Resend's hosted preference page (`{{{RESEND_UNSUBSCRIBE_URL}}}`) is not used, because it also offers the global unsubscribe.
- **Gmail's one-click unsubscribe:** Resend adds `List-Unsubscribe` and `List-Unsubscribe-Post` to broadcasts (confirmed on the test email, 2026-10-06). Whether that one click stops only the broadcast's topic, or sets the account-wide flag, is still unverified.

## Inverted check

The falsifying check of 2026-10-06 (`marketing-email-inverted-check.md`) found and fixed:

- the missing timeouts;
- the case-sensitive opt-out that reported success;
- the token overwrite;
- the referrer leak to the next page;
- the undeliverable-TLD import;
- two privacy-policy statements the product did not back.

It left two holes for the owner: topic filtering of broadcasts, and the `List-Unsubscribe` header.
