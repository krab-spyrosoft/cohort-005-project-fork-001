# In-app notification providers: comparison

**Date:** 2026-11-21

**Question:** Which third-party in-app notification providers (Knock, Novu, Courier, MagicBell, SuprSend) meet our hard requirements for a Node/React (React Router v7) web app? The hard requirements are: (1) EU data region and GDPR paperwork, (2) a self-serve free or dev tier, (3) a restylable React inbox or headless hooks, (4) a Node.js server-side trigger SDK, and (5) tests and local dev that can run without the real service.

**Method:** Only primary sources were used: vendor docs, pricing pages, trust/legal pages, official SDK repos and npm metadata. Every claim links to its source. npm versions were checked on 2026-11-21 with `npm view`. Pricing and plan contents change often, so re-check them before deciding. This is a draft and needs review.

---

## Summary table

Legend: **Pass** = met by a primary source; **Partial** = met only with conditions (paid plan, needs confirmation, or relies on our own adapter); **Fail** = not met / not offered.

| Provider      | 1. EU region + GDPR                                                                                                       | 2. Self-serve free/dev tier                                        | 3. React inbox (restylable) / headless                                         | 4. Node trigger SDK                         | 5. Tests/local dev without the service                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Knock**     | **Fail**: EU residency is "expected by the end of 2026", not live. DPA exists; all subprocessors are listed as US.        | **Pass**: Free, 10k messages/mo                                    | **Pass**: CSS vars (`--rnf-*`), `renderItem`, hooks                            | **Pass**: `@knocklabs/node`                 | **Partial**: dev environment + sandbox mode, but no self-host or emulator. Offline tests need our own adapter/fake |
| **Novu**      | **Pass**: EU (Frankfurt) on all plans incl. Free, chosen at signup. DPA + SCC available                                   | **Pass**: Free, 10k workflow runs/mo                               | **Pass**: `appearance` (variables/elements), dark theme, headless hooks        | **Pass**: `@novu/api`                       | **Pass**: MIT core can be self-hosted with Docker Compose (Inbox works); `npx novu dev` Local Studio       |
| **Courier**   | **Partial**: EU datacenter (Ireland) only on paid plans (Business, Enterprise). Free tier is US only. DPA listed under Enterprise | **Pass**: Developer plan free, 10k sends/mo (Business is self-serve pay-as-you-go) | **Pass**: theme object, custom renderers per slot, `useCourier` headless | **Pass**: `@trycourier/courier`             | **Partial**: separate Test env + custom envs, but no self-host or emulator. Offline tests need our own adapter/fake |
| **MagicBell** | **Fail**: no EU region documented anywhere. GDPR claim + DPA "provided", but no subprocessor list found                   | **Pass**: Builder free, 1,000 deliveries/mo                        | **Pass (components)** / **Partial (headless)**: CSS vars + `ItemComponent`. React headless pkg deprecated, so headless means `magicbell-js` | **Pass**: `magicbell-js` (project-client)   | **Fail (vendor)**: no self-host, dev env or mocking guidance found. Would rely on our own adapter/fake      |
| **SuprSend**  | **Partial**: docs say workspaces can have an EU data region, but pricing marks "Custom Data Center Region" as Enterprise-only. Free-tier EU unconfirmed. DPA + subprocessor list published | **Pass**: Free, 10k notifications/mo                               | **Pass**: `theme`/`themeType`, many `*Component` render props, headless option | **Pass**: `@suprsend/node-sdk`              | **Partial**: Sandbox/Staging workspaces + Test Mode (email/SMS/WhatsApp only). Self-host is Enterprise-only. Offline tests need our own adapter/fake |

---

## Knock

### 1. EU region / GDPR: Fail (as of 2026-11-21)

- Knock's plans doc says: "We expect to support EU data residency by the end of 2026." It is a roadmap item, and you can contact support to be told when it ships ([docs.knock.app/manage-your-account/knock-plans](https://docs.knock.app/manage-your-account/knock-plans)).
- The pricing page does not mention EU residency on any plan. It lists "GDPR certified" for all plans ([knock.app/pricing](https://knock.app/pricing)).
- DPA: published at [knock.app/legal/data-processing-addendum](https://knock.app/legal/data-processing-addendum). It authorizes subprocessors listed at [knock.app/legal/subprocessors](https://knock.app/legal/subprocessors), with a 30-day objection window.
- Subprocessors: all are listed as USA, including AWS (hosting), Cloudflare, Datadog and ClickHouse (analytics DB, "may store Customer Data") ([knock.app/legal/subprocessors](https://knock.app/legal/subprocessors)).
- The privacy policy relies on EU Standard Contractual Clauses for EEA-to-US transfers ([knock.app/legal/privacy-policy](https://knock.app/legal/privacy-policy)).

### 2. Free tier: Pass

- Free: $0, up to 10,000 messages/month. Starter: $250/month with 50,000 messages, then $0.005/message. Enterprise: custom (SAML SSO, HIPAA BAA) ([knock.app/pricing](https://knock.app/pricing)).

### 3. React inbox: Pass

- Package `@knocklabs/react` (npm 0.15.1, MIT). It provides `NotificationFeedPopover`, `NotificationFeed` and `NotificationIconButton`, plus "a complete set of React hooks that you can use to build your own UI" ([docs.knock.app/in-app-ui/react/overview](https://docs.knock.app/in-app-ui/react/overview)).
- Styling: `--rnf-*` CSS variables (see `theme.css`), full CSS replacement on `rnf-` classes, `colorMode` light/dark, and `renderItem` to replace notification cells ([docs.knock.app/in-app-ui/react/feed](https://docs.knock.app/in-app-ui/react/feed)).

### 4. Node SDK: Pass

- `@knocklabs/node` (npm 1.41.1, Apache-2.0): `client.workflows.trigger('key', { recipients: ['user-id'], data })` ([github.com/knocklabs/knock-node](https://github.com/knocklabs/knock-node)).

### 5. Tests / local dev: Partial

- Environments: a development environment kept separate from production ([docs.knock.app/manage-your-account/knock-plans](https://docs.knock.app/manage-your-account/knock-plans); [docs.knock.app/version-control/environments](https://docs.knock.app/version-control/environments)).
- Test runner with **sandbox mode**: "Knock generates and previews the messages without delivering them to the underlying providers". It can be set with `settings.sandbox_mode` in the API. There is also `skip_delay` ([docs.knock.app/send-notifications/testing-workflows](https://docs.knock.app/send-notifications/testing-workflows)).
- CLI for pulling, pushing and validating workflows ([docs.knock.app/developer-tools/knock-cli](https://docs.knock.app/developer-tools/knock-cli)).
- **No self-host, local emulator or official mocking guidance was found.** Offline automated tests would rely on our own adapter/fake behind a notification port.

### Other details

- **Real-time:** the feed uses a socket connection that reconnects when a tab becomes active. Optional BroadcastChannel keeps multiple tabs in sync ([docs.knock.app/in-app-ui/react/feed](https://docs.knock.app/in-app-ui/react/feed)).
- **Recipient identification:** an "identify a user" (upsert) endpoint, or inline identification when triggering a workflow ([docs.knock.app/concepts/users](https://docs.knock.app/concepts/users)).
- **Inbox client auth:** public API key plus a **signed user token (JWT, RS256)** signed with a private signing key (`KNOCK_SIGNING_KEY`). It is enforced by "enhanced security mode", which is off by default, and "Production environments should enable enhanced security mode" ([docs.knock.app/in-app-ui/security-and-authentication](https://docs.knock.app/in-app-ui/security-and-authentication)).

---

## Novu

### 1. EU region / GDPR: Pass

- "Novu provides separate data residency options in both the EU and the US". The region is chosen when the account is created. The EU region is Frankfurt, Germany, and EU is available on all plans. The EU dashboard is `eu.dashboard.novu.co` ([docs.novu.co/platform/additional-resources/security](https://docs.novu.co/platform/additional-resources/security)).
- EU endpoints: API `https://eu.api.novu.co`, WebSocket `wss://eu.socket.novu.co`. Keys are region-bound, and using the wrong region returns 401 (same source).
- Data cannot be moved between regions. Switching region means contacting sales (same source).
- Pricing lists "US + EU data residency" on the Free plan ([novu.co/pricing](https://novu.co/pricing)).
- DPA + SCC template: [novu.co/dpa](https://novu.co/dpa). SOC 2 Type II and GDPR, with live status at [trust.novu.co](https://trust.novu.co/) ([docs.novu.co/platform/additional-resources/security](https://docs.novu.co/platform/additional-resources/security)).
- The security doc does not name subprocessors. The DPA lets Novu keep already-identified subprocessors and requires notice for new ones ([novu.co/dpa](https://www.novu.co/dpa/)). The subprocessor list itself was not found and should be requested.

### 2. Free tier: Pass

- Free: $0, 10,000 workflow runs/month, up to 3 team members, 5 workflows, 2 environments, **24h feed retention**. Pro: from $30 (30k runs, 7-day retention). Team: from $250 (250k runs, 90-day retention, RBAC). Enterprise: custom (SSO, SCIM, HIPAA, self-hosted options) ([novu.co/pricing](https://novu.co/pricing)).

### 3. React inbox: Pass

- `@novu/react` (npm 3.20.0, ISC). `<Inbox />` is built from composable Bell, Notifications, InboxContent and Preferences parts. "headless hooks from @novu/react or @novu/js" support fully custom UIs ([docs.novu.co/platform/inbox/overview](https://docs.novu.co/platform/inbox/overview)).
- Styling: `appearance` prop with `variables` (global tokens), `elements` (per-component style objects or CSS/Tailwind classes) and `baseTheme` (built-in dark theme from `@novu/react/themes`) ([docs.novu.co/platform/inbox/configuration/styling](https://docs.novu.co/platform/inbox/configuration/styling)).

### 4. Node SDK: Pass

- `@novu/api` (npm 3.20.0): `novu.trigger({ workflowId, to: { subscriberId, ... }, payload })`. EU is set with `serverURL: "https://eu.api.novu.co"` ([docs.novu.co/platform/sdks/server/typescript](https://docs.novu.co/platform/sdks/server/typescript)).

### 5. Tests / local dev: Pass

- The core is MIT-licensed, and the `enterprise` folders are under a commercial licence ([github.com/novuhq/novu](https://github.com/novuhq/novu)).
- Docker Compose self-hosting runs api (3000), dashboard (4000), ws (3002), worker, MongoDB and Redis. The page includes a self-hosted `@novu/react` Inbox setup. Novu says the setup "may not be optimal for production" ([docs.novu.co/community/self-hosting-novu/deploy-with-docker](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker)).
- Self-hosted vs Cloud: Bell/Inbox/Preferences are supported self-hosted, but Snooze is not, and self-hosted has no DPA ([docs.novu.co/community/self-hosted-and-novu-cloud](https://docs.novu.co/community/self-hosted-and-novu-cloud)).
- Local Studio: `npx novu@latest dev` ([docs.novu.co/community/run-in-local-machine](https://docs.novu.co/community/run-in-local-machine)).
- Multiple environments (development/production) with separate keys ([docs.novu.co/platform/inbox/prepare-for-production](https://docs.novu.co/platform/inbox/prepare-for-production)).
- Caveat: the self-hosted stack is extra infra for CI. A thin adapter/fake is still the lighter option for unit tests.

### Other details

- **Real-time:** WebSocket (`wss://eu.socket.novu.co`; `ws` service on 3002 when self-hosted) ([docs.novu.co/platform/additional-resources/security](https://docs.novu.co/platform/additional-resources/security); [deploy-with-docker](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker)).
- **Recipient identification:** `subscriberId`, which should be your internal user ID. Inline `to` in a trigger creates or updates the subscriber. A Create Subscriber API and bulk create (500 per call) are also available ([docs.novu.co/platform/concepts/subscribers](https://docs.novu.co/platform/concepts/subscribers)).
- **Inbox client auth:** public `applicationIdentifier` + `subscriberId`, secured with an **HMAC-SHA256 `subscriberHash`** computed on the server with the secret key. If HMAC is on and no hash is sent, the Inbox won't load. A `contextHash` is required when the `context` prop is used ([docs.novu.co/platform/inbox/prepare-for-production](https://docs.novu.co/platform/inbox/prepare-for-production)).
- **EU Inbox props:** `apiUrl` / `socketUrl` per the production guide. The self-host page uses `backendUrl`. Check the prop name against the installed SDK version ([prepare-for-production](https://docs.novu.co/platform/inbox/prepare-for-production)).

---

## Courier

### 1. EU region / GDPR: Partial (paid plans only)

- "Courier has two datacenters: US and EU (Ireland)". "All data in the two datacenters is separate." "The EU datacenter is available on every paid plan: Business and Enterprise" ([courier.com/docs/security/data-residency](https://www.courier.com/docs/security/data-residency)).
- Setup: create a workspace at app.courier.com, then sign in to `app.eu.courier.com` with the same email and set up the EU workspace with its own keys, providers and templates. EU hosts are API `api.eu.courier.com`, Inbox `inbox.eu.courier.io` and real-time `wss://realtime.eu.courier.io`. Server SDKs read `COURIER_BASE_URL` (Node option `baseURL`) ([courier.com/docs/platform/workspaces/eu-datacenter](https://www.courier.com/docs/platform/workspaces/eu-datacenter)).
- Pricing lists "EU Data Residency" under Business, not Developer (free) ([courier.com/pricing](https://www.courier.com/pricing)).
- DPA: "MSA, DPA, BAA & legal review" appears under Enterprise on the pricing page ([courier.com/pricing](https://www.courier.com/pricing)). The trust center lists SOC 2, GDPR, CCPA, HIPAA and PCI DSS, and names AWS and GCP as infrastructure. It does not list subprocessors or a DPA ([security.courier.com](https://security.courier.com/)).

### 2. Free tier: Pass

- Developer: free, 10,000 sends/month. Business: $0.005/send pay-as-you-go, self-serve ("Add a credit card to move to Courier's Business plan"). Enterprise: custom ([courier.com/pricing](https://www.courier.com/pricing)).
- The pricing page does not explicitly list Inbox among Developer features (see open questions).

### 3. React inbox: Pass

- `@trycourier/courier-react` (npm 9.3.5, MIT) provides `<CourierInbox />` and `<CourierInboxPopupMenu />` ([courier.com/docs/in-app/add-an-inbox](https://www.courier.com/docs/in-app/add-an-inbox)). It also provides `CourierToast` and the `useCourier()` hook "for programmatic access and custom UIs" ([GitHub README](https://github.com/trycourier/courier-web/tree/main/@trycourier/courier-react)).
- Customization: theming first, then **custom renderers** for header, list item and empty/loading/error slots, or a fully **headless** UI with `useCourier` ([courier.com/docs/in-app/build-a-custom-inbox](https://www.courier.com/docs/in-app/build-a-custom-inbox)).

### 4. Node SDK: Pass

- `@trycourier/courier` (npm 10.1.0, Apache-2.0): `client.send.message({ message: { to: ..., ... } })` ([github.com/trycourier/courier-node](https://github.com/trycourier/courier-node)).

### 5. Tests / local dev: Partial

- "Every workspace starts with Production and Test environments", with up to 18 custom environments. Each API key belongs to one environment ([courier.com/docs/workspaces/overview](https://www.courier.com/docs/workspaces/overview)).
- **No self-host, local emulator or mocking guidance was found in primary docs.** Offline automated tests would rely on our own adapter/fake. (A secondary search result mentioned an Enterprise "Mock" key, but no primary page confirming it was found, so it is not counted.)

### Other details

- **Real-time:** WebSocket (`wss://realtime.eu.courier.io` / US equivalent) ([eu-datacenter](https://www.courier.com/docs/platform/workspaces/eu-datacenter); [add-an-inbox](https://www.courier.com/docs/in-app/add-an-inbox)).
- **Recipient identification:** `to: { user_id }` resolves a stored profile. `POST /profiles/{user_id}` is an upsert (merge), and sends do not create profiles. Inline contact details can override a profile for one message ([courier.com/docs/platform/users/users-overview](https://www.courier.com/docs/platform/users/users-overview)).
- **Inbox client auth:** the backend calls `POST /auth/issue-token` with the API key and a scope string such as `user_id:<id> inbox:read:messages inbox:write:events`. The client calls `signIn({ userId, jwt })`. Omitting `expires_in` creates a token that never expires. The SDKs don't refresh tokens. For EU, mint the token at `api.eu.courier.com` and pass EU `apiUrls` ([courier.com/docs/platform/inbox/authentication](https://courier.com/docs/platform/inbox/authentication)).

---

## MagicBell

### 1. EU region / GDPR: Fail

- No plan on the pricing page mentions EU or data residency ([magicbell.com/pricing](https://www.magicbell.com/pricing)).
- The trust page says "MagicBell is fully compliant with GDPR regulations" and "We provide data processing agreements". It does not name a hosting provider or region, list subprocessors, or mention SOC 2 ([magicbell.com/security](https://www.magicbell.com/security)).
- The API uses a single host, `api.magicbell.com` ([magicbell.com/docs/api/authentication](https://www.magicbell.com/docs/api/authentication)). No regional host was found.
- The privacy policy (updated 2 July 2024) says data is processed "at the Owner's operating offices and in any other places". It does not name a host or mention SCCs ([magicbell.com/privacy-policy](https://www.magicbell.com/privacy-policy)).

### 2. Free tier: Pass

- Builder: $0, 1,000 deliveries/month, 1 project. Startup: $249/month, 50,000 deliveries, then $0.0025/delivery. Enterprise: custom ([magicbell.com/pricing](https://www.magicbell.com/pricing)).

### 3. React inbox: Pass (components) / Partial (headless)

- `@magicbell/react` (npm 1.14.0): `Provider` takes a User JWT `token`. `Inbox` has `ItemComponent` for custom items. `FloatingInbox` has `ButtonComponent`/`InboxComponent`. Theming uses CSS variables such as `--magicbell-bg-default` ([magicbell.com/docs/libraries/magicbell-react](https://www.magicbell.com/docs/libraries/magicbell-react)).
- Headless: `@magicbell/react-headless` README says "This package is deprecated. Please use `@magicbell/react` or `magicbell-js` instead" (npm readme, checked 2026-11-21). The `@magicbell/react` README documents no hooks, so headless means using `magicbell-js/user-client` directly ([magicbell.com/docs/libraries/magicbell-js](https://www.magicbell.com/docs/libraries/magicbell-js)).

### 4. Node SDK: Pass

- `magicbell-js` (npm 1.8.0): `magicbell-js/project-client` provides `broadcasts.createBroadcast({ title, content, recipients: [{ externalId, email }] })` and `users.saveUser` (`PUT /users`, create or update) ([magicbell.com/docs/libraries/magicbell-js](https://www.magicbell.com/docs/libraries/magicbell-js)).

### 5. Tests / local dev: Fail (vendor offers nothing found)

- No self-hosting, dev/test environment or mocking guidance was found in primary docs. The free tier allows only 1 project ([pricing](https://www.magicbell.com/pricing)). Tests and local dev would rely entirely on our own adapter/fake.

### Other details

- **Real-time:** "Notifications update live via WebSockets. No polling" ([magicbell.com/inbox](https://www.magicbell.com/inbox)).
- **Recipient identification:** recipients by `externalId` and/or `email` in broadcasts. `saveUser` upserts. The docs don't state which field is the match key ([magicbell-js](https://www.magicbell.com/docs/libraries/magicbell-js)).
- **Inbox client auth:** **User JWT** generated on our backend "using the Secret Key and the API Key from your project", sent as `Authorization: Bearer <jwt>` ([magicbell.com/docs/api/authentication](https://www.magicbell.com/docs/api/authentication)).

---

## SuprSend

### 1. EU region / GDPR: Partial (sources conflict)

- Docs: "Each workspace has a data region, including the EU" ([docs.suprsend.com/docs/what-is-suprsend](https://docs.suprsend.com/docs/what-is-suprsend)). "We support EU-data residency options" ([docs.suprsend.com/docs/security](https://docs.suprsend.com/docs/security)).
- Enterprise page: SaaS "with US or EU data residency and a 99.9% uptime SLA" ([suprsend.com/enterprise](https://www.suprsend.com/enterprise)).
- Pricing: "Custom Data Center Region" is "Not included" on Free, Essentials and Business. It is "Included" only on Enterprise, along with "Multi-region data center" ([suprsend.com/pricing](https://www.suprsend.com/pricing)).
- Changelog, 12 Feb 2025: a "data centre field in account settings" shows which region you are in ([docs.suprsend.com/changelog/overview](https://docs.suprsend.com/changelog/overview)). **No primary source says whether EU can be picked at self-serve signup on Free.**
- No EU API host is documented. The trigger host shown is `https://hub.suprsend.com` ([what-is-suprsend](https://docs.suprsend.com/docs/what-is-suprsend)).
- DPA: [suprsend.com/data-processing-addendum](https://www.suprsend.com/data-processing-addendum). The subprocessor list is linked from docs ([suprsend.com/subprocessors](https://www.suprsend.com/subprocessors), which redirects to trust.suprsend.com and returned 403 to automated fetch). SOC 2 Type II and ISO 27001 are claimed ([docs.suprsend.com/docs/security](https://docs.suprsend.com/docs/security)).

### 2. Free tier: Pass

- Free: $0, 10,000 notifications/month. Essentials: $100/month (50k). Business: $250/month (50k). Overage is $2 or $5 per 1,000. Enterprise: custom ([suprsend.com/pricing](https://www.suprsend.com/pricing)).

### 3. React inbox: Pass

- `@suprsend/react` (npm 1.6.0, MIT) is current. `@suprsend/react-inbox` is end-of-support and deprecated on npm. Both drop-in and headless options are available ([docs.suprsend.com/docs/inbox-react](https://docs.suprsend.com/docs/inbox-react)).
- Drop-in `Inbox`: `theme` (CSS overrides), `themeType` (light/dark), and render props `notificationComponent`, `headerRightComponent`, `bellComponent`, `badgeComponent`, `noNotificationsComponent`, `loaderComponent`. `host` takes `socketHost`/`apiHost` ([docs.suprsend.com/docs/react-in-app-feed](https://docs.suprsend.com/docs/react-in-app-feed)). Headless guide: [react-sdk-headless-feed](https://docs.suprsend.com/docs/react-sdk-headless-feed).

### 4. Node SDK: Pass

- `@suprsend/node-sdk` (npm 1.15.1, MIT) triggers workflows with `recipients` (`distinct_id` or recipient objects, up to 100 per call) and `idempotency_key`. Requires Node SDK ≥ 1.10.0 ([docs.suprsend.com/docs/node-trigger-workflow-from-api](https://docs.suprsend.com/docs/node-trigger-workflow-from-api)).

### 5. Tests / local dev: Partial

- Default workspaces: Sandbox (demo, trial-limited), Staging and Production, which are fully isolated ([docs.suprsend.com/docs/sms-quick-start](https://docs.suprsend.com/docs/sms-quick-start)).
- Test Mode (Staging and other test workspaces) routes delivery to designated test channels or catch-alls. It currently supports **email, SMS and WhatsApp only**, not in-app ([docs.suprsend.com/docs/developer/test-mode](https://docs.suprsend.com/docs/developer/test-mode)).
- Self-hosting (Helm on Kubernetes) and BYOC (beta) require an **Enterprise licence** ([suprsend.com/self-host](https://www.suprsend.com/self-host); [pricing](https://www.suprsend.com/pricing)).
- No local emulator or mocking guidance was found. Offline tests would rely on our own adapter/fake.

### Other details

- **Real-time:** socket connection configured with `socketHost` ([react-in-app-feed](https://docs.suprsend.com/docs/react-in-app-feed)).
- **Recipient identification:** `distinct_id`. Inline recipients in a workflow trigger act as an UPSERT. Event-based triggers need the user to exist first ([node-trigger-workflow-from-api](https://docs.suprsend.com/docs/node-trigger-workflow-from-api); [guides/event-vs-workflow-api](https://docs.suprsend.com/docs/guides/event-vs-workflow-api)).
- **Inbox client auth:** public API key + **signed user token JWT (ES256)** with claims `entity_type: "subscriber"`, `entity_id`, `exp`, `iat` and an optional tenant `scope`. "Enhanced security mode" rejects requests without a token and is recommended for production ([docs.suprsend.com/docs/client-authentication](https://docs.suprsend.com/docs/client-authentication)). This replaced the older HMAC auth ([inbox-react](https://docs.suprsend.com/docs/inbox-react)).

---

## Which pass the hard requirements (neutral summary)

- **Pass all five:** **Novu**. EU region (Frankfurt) is available on Free and chosen at signup. It has a DPA/SCC, a free self-serve tier, a restylable `<Inbox />` plus headless hooks, the `@novu/api` Node SDK, and an MIT self-hostable core for local dev.
- **Partial:**
  - **Courier** meets 2–4. EU datacenter exists but only on paid plans (Business is self-serve pay-as-you-go, so no procurement is needed, but the free tier is US-only). Its DPA is listed under Enterprise. Tests need our own adapter.
  - **SuprSend** meets 2–4. Docs and the enterprise page say EU residency exists, but pricing puts "Custom Data Center Region" on Enterprise only, so whether EU is on Free is unconfirmed. Self-host is Enterprise-only. Test Mode doesn't cover in-app.
- **Fail the deciding requirement (EU region):**
  - **Knock**: EU residency is a roadmap item ("end of 2026"). It is otherwise strong on 2–4 and partial on 5.
  - **MagicBell**: no EU region documented. Headless React is deprecated, and the vendor offers nothing for local dev/testing.
- For **every provider except Novu**, offline tests/CI would rely on our own adapter/fake behind a notification interface. Even with Novu that is probably still the cheapest option for unit tests, with self-hosted Novu kept for integration tests.

## Open questions / caveats

1. **SuprSend:** can an EU-region workspace be created on the Free/Essentials plan at signup, or only on Enterprise? What is the EU API/socket host? Request the subprocessor list (trust page blocked automated fetch).
2. **Courier:** is the DPA available on Business (pricing lists it under Enterprise)? Does the Developer (free) plan include Inbox? Is there a usage minimum on Business? Does an EU workspace need its own Business subscription?
3. **Knock:** has EU residency shipped, or is there a firm date? (The docs said "by the end of 2026", and today is 2026-11-21.) Would it be available on Free/Starter or only Enterprise?
4. **Novu:** get the current subprocessor list (not in the security docs). Confirm that EU applies to Pro/Team too (the security doc says "all plans"). Note the Free plan's **24h feed retention**, which may be too short for a real inbox. Check the `apiUrl` vs `backendUrl` prop name in the installed `@novu/react` version. Check the self-hosted edition's production limits (no DPA, Snooze unsupported).
5. **MagicBell:** ask whether any EU hosting exists and for its subprocessor list, hosting region and SOC 2 status.
6. Pricing figures come from live pricing pages on 2026-11-21 and change often. Re-verify before any decision. Legal/privacy should review DPA terms before any client-facing commitment.
