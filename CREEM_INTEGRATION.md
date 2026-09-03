# Creem billing handoff

The complete current implementation request is [backend-handoff/README.md](backend-handoff/README.md). Its trusted grant and webhook requirements supersede the historical signup-SQL instructions below. No billing endpoints are implemented here.

Shoort Clips uses Creem's hosted checkout as a full-page redirect. Do not put the
Creem API key or product ID logic in the browser, and do not unlock a workspace
from success-page query parameters.

## Creem setup

Create one recurring product in Creem:

- Name: `Shoort Clips Monthly`
- Price: `$19.96 USD`
- Billing period: every month
- Success URL: `https://YOUR_DOMAIN/payment-success.html`

Keep these values on the Google Cloud server:

```text
CREEM_API_KEY=
CREEM_WEBHOOK_SECRET=
CREEM_MONTHLY_PRODUCT_ID=
CREEM_TEST_MODE=true
PUBLIC_APP_URL=https://YOUR_DOMAIN
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

## Frontend-ready API contract

### `POST /api/v1/billing/checkout`

Requires the signed-in user's Supabase bearer token. The server verifies the
user, selects `CREEM_MONTHLY_PRODUCT_ID`, pre-fills the verified account email,
and creates a Creem checkout session with:

```json
{
  "product_id": "CREEM_MONTHLY_PRODUCT_ID",
  "request_id": "unique-idempotency-key",
  "success_url": "https://YOUR_DOMAIN/payment-success.html",
  "metadata": {
    "userId": "SUPABASE_USER_ID",
    "planKey": "shoort_monthly"
  }
}
```

Return:

```json
{
  "checkout_url": "https://checkout.creem.io/ch_..."
}
```

The frontend redirects the current tab to `checkout_url`. Use an idempotency key
so repeated clicks do not create unrelated checkout attempts.

### `GET /api/v1/billing/status`

Requires the Supabase bearer token. Return only the current user's server-side
subscription state from `public.user_access`.

### `POST /api/v1/billing/portal`

Requires the Supabase bearer token. Use `creem_customer_id` to create a Creem
customer-portal link and return:

```json
{
  "portal_url": "https://creem.io/my-orders/login/..."
}
```

### `POST /api/v1/webhooks/creem`

This endpoint is public but must verify the raw request body against the
`creem-signature` header using `CREEM_WEBHOOK_SECRET`. Make webhook processing
idempotent by storing processed event IDs.

Use the Supabase secret key only on the server. Update `public.user_access` as
follows:

- `subscription.paid`: set `access_type = 'paid'`, `is_active = true`, save the
  Creem customer/subscription IDs, status, and period end in `paid_until`.
- `subscription.scheduled_cancel`: keep access active through `paid_until`.
- `subscription.past_due` or `subscription.expired`: record the status; keep or
  remove access according to the paid-through date while Creem retries.
- `subscription.canceled`: disable access when the paid-through period ends.
- Refunds or disputes: apply the business policy explicitly; do not trust the
  browser to decide access.

The payment success page polls Supabase and opens the dashboard only after this
webhook-controlled row is `paid` and active.

The Google Cloud processing API must also reject clip, analytics, and scheduling
requests when paid access is inactive or a free trial is past `trial_ends_at`.
Frontend gating is only the user experience; it is not the security boundary.

## Supabase access states

Do not run `SUPABASE_USER_ACCESS_SETUP.sql` unchanged for production: its
signup trigger trusts editable metadata. Implement the audited grant/payment
flow in `backend-handoff/cloud-setup.md`. Intended access states are:

| Signup path | `access_type` | `is_active` | Result |
| --- | --- | --- | --- |
| Server-approved private trial | `free_trial` | `true` | Dashboard opens for the approved 30-day trial |
| Public registration | `paid` | `false` | Checkout required |
| Verified Creem payment | `paid` | `true` | Dashboard unlocks |
| Trusted admin-granted test account | `test_user` | `true` | Dashboard opens |

`public.user_access` is server-controlled and readable only by its owner. Never
use editable `user_metadata` as the authorization decision.
