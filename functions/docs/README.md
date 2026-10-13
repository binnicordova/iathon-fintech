# BRASPER Cloud Functions: how to use them

Project `aibrasper` · region `southamerica-east1` · Cloud Functions 2nd gen (Node 24) · 9 **callable** functions.

The app, the assistant and any other client (a WhatsApp bot, a script, Postman) use the same functions. Each one checks who is calling, validates the input, and is the only place that writes orders, quotes and hand-over tickets. These are **client** services only: validating payments, exporting orders and billing are done by the back office, outside this project's functions. Clients never write those collections directly (see `firestore.rules`).

- [1. Endpoints](#1-endpoints)
- [2. Calling a function](#2-calling-a-function)
- [3. Authentication](#3-authentication)
- [4. Errors](#4-errors)
- [5. Functions](#5-functions)
- [6. Typical flows](#6-typical-flows)
- [7. Reference values](#7-reference-values)

---

## 1. Endpoints

Every function is served at `https://<name-lowercase>-h5wenirx2q-rj.a.run.app`.

| Function | URL | Who can call it |
|---|---|---|
| [`getRates`](#getrates) | `https://getrates-h5wenirx2q-rj.a.run.app` | any signed-in user |
| [`createQuote`](#createquote) | `https://createquote-h5wenirx2q-rj.a.run.app` | any signed-in user |
| [`createOrder`](#createorder) | `https://createorder-h5wenirx2q-rj.a.run.app` | the quote's owner |
| [`submitProof`](#submitproof) | `https://submitproof-h5wenirx2q-rj.a.run.app` | the order's owner |
| [`cancelOrder`](#cancelorder) | `https://cancelorder-h5wenirx2q-rj.a.run.app` | the order's owner |
| [`requestHuman`](#requesthuman) | `https://requesthuman-h5wenirx2q-rj.a.run.app` | any signed-in user |
| [`getQueueInfo`](#getqueueinfo) | `https://getqueueinfo-h5wenirx2q-rj.a.run.app` | the ticket's owner |
| [`leaveQueue`](#leavequeue) | `https://leavequeue-h5wenirx2q-rj.a.run.app` | the ticket's owner |
| [`assistantGenerate`](#assistantgenerate) | `https://assistantgenerate-h5wenirx2q-rj.a.run.app` | any signed-in user |

Local emulator (`bun run emulators`): `http://localhost:5001/aibrasper/southamerica-east1/<functionName>`.

Instance limits: `maxInstances` is 10 for all of them and 5 for `assistantGenerate`, which has a 60 s timeout.

## 2. Calling a function

### From the Expo app (recommended)

`src/services/api.ts` wraps every function with typed requests and maps failures to an `ApiError`:

```ts
import {api} from "@/services/api";

const quote = await api.createQuote({sendCurrency: "BRL", receiveCurrency: "PEN", sendAmount: 500});
```

### Over HTTP (any other client)

Callable functions speak a small protocol on top of HTTPS:

- `POST` with `Content-Type: application/json`.
- Body: `{"data": { ...the request... }}`. The `data` wrapper is required, even when the request is empty (`{"data": {}}`).
- Header `Authorization: Bearer <Firebase ID token>` (see [section 3](#3-authentication)).
- Success: HTTP 200 with `{"result": { ...the response... }}`.
- Failure: a 4xx/5xx with `{"error": {"status": "INVALID_ARGUMENT", "message": "invalid-input", "details": ...}}`. `message` is the stable reason code listed in [section 4](#4-errors).

```bash
API_KEY=<Firebase web API key>          # src/constants/firebase.ts (public, not a secret)
BASE=https://createquote-h5wenirx2q-rj.a.run.app

# 1. an anonymous client session
TOKEN=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$API_KEY" \
  -H 'content-type: application/json' -d '{"returnSecureToken":true}' | jq -r .idToken)

# 2. call a function
curl -s "$BASE" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"data":{"sendCurrency":"BRL","receiveCurrency":"PEN","sendAmount":500}}'
```

The examples below use a shell helper so each call stays short:

```bash
call() {  # call <functionName> '<json data>'
  curl -s "https://$(echo "$1" | tr 'A-Z' 'a-z')-h5wenirx2q-rj.a.run.app" \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d "{\"data\":$2}"
}
```

## 3. Authentication

**Clients** are anonymous Firebase Auth users. The app signs them in silently; over HTTP you create one with `accounts:signUp` (above). The returned `idToken` lasts one hour; renew it with the `refreshToken` against `securetoken.googleapis.com/v1/token`. Everything a client owns is tied to its `uid`: it can only touch its own quotes, orders, proofs and tickets.

There are no staff users or roles in these functions: a request with a valid token is a client, and it only ever sees its own data.

## 4. Errors

Every function throws `HttpsError`s with a stable reason in `error.message`. The app turns these into messages in the client's language.

| HTTP | `error.status` | `error.message` (reason) | Meaning |
|---|---|---|---|
| 401 | `UNAUTHENTICATED` | `sign-in-required` | No or invalid token |
| 400 | `INVALID_ARGUMENT` | `invalid-input` | Body failed validation; `error.details` is `[{path, message}]` |
| 400 | `INVALID_ARGUMENT` | `invalid-amount`, `same-currency`, `amount-too-small` | `createQuote` input problems |
| 400 | `INVALID_ARGUMENT` | `invalid-operation-no`, `invalid-proof-path`, `proof-too-large` | `submitProof` input problems |
| 400 | `FAILED_PRECONDITION` | `requires-human` | Amount above the large-amount limit; `details` carries the computed quote |
| 400 | `FAILED_PRECONDITION` | `quote-already-used` | The quote already became an order |
| 400 | `FAILED_PRECONDITION` | `order-not-pending` | The order has already moved on |
| 400 | `FAILED_PRECONDITION` | `proof-not-uploaded` | No file at `proofPath` in Storage |
| 404 | `NOT_FOUND` | `quote-not-found`, `order-not-found`, `handoff-not-found` | Missing, or not yours |
| 409 | `ALREADY_EXISTS` | `operation-no-duplicate` | Same bank operation number on another live order |
| 504 | `DEADLINE_EXCEEDED` | `quote-expired` | The quote's rate guarantee ran out |
| 503 | `UNAVAILABLE` | `rates-unavailable` | No fresh market rate; try later or ask for a person |
| 503 | `UNAVAILABLE` | `model-unavailable` | Gemma could not answer (credits, outage) |
| 429 | `RESOURCE_EXHAUSTED` | `model-unavailable` | Gemma quota reached |

---

## 5. Functions

Amounts are plain numbers rounded to 2 decimals (rates to 4). Times are ISO-8601 UTC strings. Currencies: `BRL`, `PEN`, `USD`. Channels: `form`, `assistant`, `whatsapp`, `human`. Languages: `es`, `pt`, `en`.

### getRates

Market reference and BrasPer's pricing, so a client can price live while typing. The server re-prices in `createQuote`; never trust these numbers for money.

- **Request:** `{}`
- **Response:**

```json
{
  "market": {
    "base": "USD",
    "rates": {"USD": 1, "BRL": 5.31, "PEN": 3.74},
    "source": "open.er-api.com",
    "fetchedAt": "2026-10-12T19:57:43.073Z",
    "nextUpdateAt": "2026-10-12T20:57:43.073Z",
    "providerUpdatedAt": "2026-10-12T00:02:32.000Z"
  },
  "pricing": {
    "spreadBps": 200, "commissionBps": 240, "taxBps": 1800,
    "quoteTtlMinutes": 15, "rateLockMinutes": 30, "ratesRefreshMinutes": 60,
    "largeAmountUsd": 3000, "minSendUsd": 10
  },
  "minutesPerQueuedClient": 2.5
}
```

- **Errors:** `rates-unavailable`.
- Rates come from `open.er-api.com` (backup: fawazahmed0), cached in Firestore `config/rates` and refreshed after `ratesRefreshMinutes`.

### createQuote

"Continuar" on the calculator. Prices the transfer on the server and **freezes the rate** for `quoteTtlMinutes`.

- **Request:** give exactly one of `sendAmount` or `receiveAmount`.

| Field | Type | Notes |
|---|---|---|
| `sendCurrency`, `receiveCurrency` | currency | must differ |
| `sendAmount` / `receiveAmount` | number > 0, max 10,000,000 | one of the two is required |
| `channel` | channel | default `form` |

- **Response:**

```json
{
  "id": "9irEweAzk19PHE4YPQDx", "uid": "…", "channel": "form", "status": "open",
  "createdAt": "…", "expiresAt": "…",
  "sendCurrency": "BRL", "receiveCurrency": "PEN",
  "sendAmount": 800, "receiveAmount": 538.8,
  "marketRate": 0.6873, "rate": 0.6735,
  "commission": 19.2, "tax": 3.46, "total": 822.66,
  "requiresHuman": false
}
```

`total = sendAmount + commission + tax` is what the client actually transfers. `rate` is the BrasPer rate (market minus the spread).

- **Errors:** `invalid-input`, `invalid-amount`, `same-currency`, `amount-too-small`, `requires-human`, `rates-unavailable`.

```bash
call createQuote '{"sendCurrency":"BRL","receiveCurrency":"PEN","sendAmount":800}'
```

### createOrder

Creates the order (the "IV") from an open quote. Rate, fees and the payment account come from the quote and server settings, **never from the request**. Also saves the client's name, document and banks for next time. Order ids are sequential: `BR-0001`, `BR-0002`...

- **Request:**

| Field | Type | Rules |
|---|---|---|
| `quoteId` | string | an `open`, unexpired quote of the caller |
| `language` | language | default `es` |
| `clientName` | string | at least 3 characters and a space (first and last name) |
| `docType` | `DNI` \| `CE` \| `RUC` \| `CPF` | |
| `docNumber` | string | valid for the type: DNI 8 digits, CE 9-12 alphanumerics, RUC 11 digits starting 10/15/17/20 (checksum), CPF 11 digits (checksum) |
| `email` | string | valid email (lowercased) |
| `fundsSource` | `savings` \| `salary` \| `business` \| `asset_sale` \| `donation` \| `other` | |
| `sourceBank`, `sourceAccount` | string | account at least 4 characters |
| `destinationBank`, `destinationAccount` | string | account at least 4 characters |

- **Response:** the full order (`status: "pending"`), including `orderId`, the frozen `rate`, `commission`, `tax`, `total`, `rateLockedUntil` (now + `rateLockMinutes`) and `paymentAccount`: where the client must pay. Demo accounts are flagged `"demo": true`.
- **Errors:** `invalid-input` (see `details`), `quote-not-found`, `quote-already-used`, `quote-expired`.

```bash
call createOrder '{"quoteId":"<id>","language":"es","clientName":"Ana Paula Souza","docType":"CPF","docNumber":"52998224725","email":"ana@example.com","fundsSource":"salary","sourceBank":"Nubank","sourceAccount":"0001-12345678-9","destinationBank":"BCP","destinationAccount":"191-1234567890"}'
```

### submitProof

The client says "I paid": saves the bank operation number and the proof photo, and moves the order to `validating`. A person judges the proof; nothing here approves anything.

**Upload the photo first**, to Firebase Storage at exactly `proofs/<uid>/<orderId>/<file>` (image or PDF, at most 8 MB; the rules only let the owner write there):

```bash
UID=<uid from the token>; ORDER=BR-0012
curl -s -X POST \
  "https://firebasestorage.googleapis.com/v0/b/aibrasper.firebasestorage.app/o?name=$(printf 'proofs/%s/%s/proof-1.png' "$UID" "$ORDER" | jq -sRr @uri)" \
  -H "authorization: Firebase $TOKEN" -H 'content-type: image/png' --data-binary @proof.png
```

- **Request:**

| Field | Type | Rules |
|---|---|---|
| `orderId` | string | the caller's order, status `pending` |
| `operationNo` | string | 4-24 letters, digits or `-` (stored uppercase) |
| `proofPath` | string | must start with `proofs/<uid>/<orderId>/`; the file must exist |

- **Response:** `{"ok": true, "orderId": "BR-0012"}`
- **Errors:** `invalid-operation-no`, `invalid-proof-path`, `proof-not-uploaded`, `proof-too-large`, `operation-no-duplicate` (the same operation number on another order that is not cancelled or rejected), `order-not-found`, `order-not-pending`.

### cancelOrder

The client cancels an order that is still `pending`.

- **Request:** `{"orderId": "BR-0012"}`
- **Response:** `{"ok": true, "orderId": "BR-0012"}`
- **Errors:** `order-not-found`, `order-not-pending`.

### requestHuman

"Hablar con una persona": puts the client in the seller queue with a summary of what was gathered, so nothing has to be retyped. A client has **one live ticket**; asking again returns the original place.

- **Request:**

| Field | Type | Notes |
|---|---|---|
| `summary` | string, 1-1500 chars | context for the seller (required) |
| `orderId` | string \| null | must be the caller's order if given |
| `language` | language | default `es` |
| `channel` | channel | default `assistant` |

- **Response:** `{"handoffId": "…", "position": 2, "estimatedWaitMinutes": 5}` (wait = position × `minutesPerQueuedClient`, at least 1).
- **Errors:** `invalid-input`, `order-not-found`.

### getQueueInfo

Where the client is in line right now.

- **Request:** `{"handoffId": "…"}`
- **Response:** `{"handoffId": "…", "position": 1, "estimatedWaitMinutes": 3, "status": "waiting"}`. When the ticket is `assigned` or `closed`, `position` and `estimatedWaitMinutes` are `0`.
- **Errors:** `handoff-not-found`.

### leaveQueue

The client gives up the ticket (it becomes `closed`).

- **Request:** `{"handoffId": "…"}`
- **Response:** `{"ok": true}`
- **Errors:** `handoff-not-found`.

### assistantGenerate

Proxy to **Gemma 4** (`gemma-4-26b-a4b-it`) through the Gemini API. The API key (secret `GEMINI_API_KEY`) stays on the server. The LangGraph agent runs in the app and calls this once per model turn; it is a stateless request/response, not a chat session, so the caller sends the whole conversation each time.

- **Request:**

| Field | Type | Limits |
|---|---|---|
| `systemInstruction` | string | max 14,000 chars |
| `contents` | `[{role: "user"\|"model", parts: [...]}]` | 1-60 messages, 1-8 parts each |
| `functionDeclarations` | `[{name, description, parameters?}]` | max 16; `name` is `snake_case`; `parameters` is a Gemini-compatible JSON schema (the app allow-lists keys in `src/assistant/schema.ts`) |
| `temperature` | number 0-1 | default 0.3 |
| `maxOutputTokens` | integer 16-1024 | default 600 |

A part is `{"text"}`, `{"functionCall": {"name", "args"}}`, `{"functionResponse": {"name", "response"}}` (text max 8,000 chars) and may carry a `thoughtSignature` to echo back.

- **Response:**

```json
{
  "model": "gemma-4-26b-a4b-it",
  "parts": [{"text": "¿Cuánto quieres enviar?"}],
  "finishReason": "STOP",
  "usage": {"promptTokens": 812, "outputTokens": 9}
}
```

When the model wants a tool, `parts` holds a `functionCall`; run the tool, append a `functionResponse` part as a `user` message, and call again. Model "thinking" parts are dropped.

- **Errors:** `invalid-input`, `model-unavailable` (HTTP 503, or 429 when the Gemini quota is hit). The app then switches to its scripted **basic mode**.
- Override the model or point at a mock with `GEMMA_MODEL` / `GEMINI_BASE_URL` (see `functions/scripts/mock-gemma.mjs`).
- Status: the Gemini API returned `402 prepayment credits depleted` for this project when tested, so live replies need credits or a free-tier key in AI Studio.

---

## 6. Typical flows

### A client creates an order and pays

```
getRates          (optional, to price live in the UI)
createQuote       → quote.id, rate frozen 15 min
createOrder       → orderId, paymentAccount          status: pending
   client pays the paymentAccount by PIX / transfer
Storage upload    → proofs/<uid>/<orderId>/proof.png
submitProof       → status: validating
   the back office validates the payment and moves the order on
   (validating → approved → exported); the client follows it live
```

Status machine: `pending → validating → approved → exported`; `validating → rejected`; `pending → cancelled` (client). Statuses never go backwards; after `validating` only the back office changes them. The client can follow its order live by reading Firestore `orders/{orderId}` (read-only for clients).

### The client wants a person

```
requestHuman → position, estimatedWaitMinutes
getQueueInfo (poll)  → status waiting | assigned | closed
leaveQueue           → closed
```

Quotes above `pricing.largeAmountUsd` (default 3,000 USD) fail with `requires-human`, and the app routes the client to this flow.

### Try it end to end

Without touching production, use the emulator script, which runs quote → order → proof → human queue plus the access checks:

```bash
bun run emulators        # terminal 1
bun run e2e:emulator     # terminal 2
TARGET=prod FIREBASE_API_KEY=$API_KEY node functions/scripts/e2e-emulator.mjs   # the same checks against production
```

## 7. Reference values

| Setting | Default | Where to change it |
|---|---|---|
| Spread (market → BrasPer rate) | 200 bps (2%) | Firestore `config/public` → `pricing.spreadBps` |
| Commission | 240 bps (2.4%) on the send amount | `pricing.commissionBps` |
| Tax on commission | 1800 bps (18%) | `pricing.taxBps` |
| Quote guarantee | 15 min | `pricing.quoteTtlMinutes` |
| Rate lock after the order exists | 30 min | `pricing.rateLockMinutes` |
| Market rate refresh | 60 min | `pricing.ratesRefreshMinutes` |
| Large amount → a person | 3,000 USD | `pricing.largeAmountUsd` |
| Minimum send | 10 USD equivalent | `pricing.minSendUsd` |
| Minutes per queued client | 2.5 | `config/public` → `minutesPerQueuedClient` |
| Payment accounts shown to clients | **DEMO** accounts | `config/payment` → `accounts.BRL` / `accounts.PEN` |

All values above are placeholders until the business and the accountant confirm them. Pricing changes apply to the next quote with no redeploy.

Source: `functions/src/` (one file per area: `quotes`, `orders`, `handoff`, `assistant`, `rates`). The rules for pricing, validation and the status machine live once in `src/domain` and `src/models` and are copied into the functions at build.
