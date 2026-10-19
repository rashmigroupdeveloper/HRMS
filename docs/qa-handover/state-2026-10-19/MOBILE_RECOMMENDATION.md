# Rashmi HRMS: mobile approach recommendation

Prepared Mon 19 Oct 2026, 02:00 IST (guides job). Docs only; no app code was changed.
Sources were checked on 19 Oct 2026 and are linked inline.

## TL;DR

**Ship a PWA now, then wrap the same React build with Capacitor 8 for an Android app (and iOS later). Do not build a separate React Native or Flutter app.**

- **Phase 1, PWA hardening (about 2 weeks):** web push, offline drafts, passkeys, an install prompt. This covers office staff, managers and HR straight away, with no store involved.
- **Phase 2, Capacitor Android app (about 4 to 5 weeks):** the same code and screens, plus native pieces where the web is weak. Those are geo check-in with mock-location checks, reliable push, a fingerprint unlock, an offline punch queue, and distribution through Managed Google Play or the Play Store.
- **Phase 3, home-screen widgets and iOS (about 3 to 4 weeks):** today's in and out times, leave balance, the pending approvals count and a check-in shortcut, plus a TestFlight build and then Apple Business Manager or App Store release.
- A native rewrite would take 4 to 6 months and duplicate about 80 screens. It would add nothing these users need that Capacitor plus a few native widget files can't do.

## 1. What the repo already has (main @ ee78307)

| Item | Status | Where |
|---|---|---|
| Web app manifest | **Yes.** Standalone display, `en-IN`, maskable icons, 4 shortcuts (Attendance, Apply leave, Approvals, Payslip) | `frontend/public/manifest.webmanifest`, linked from `index.html` |
| Service worker | **Yes, hand-written.** App-shell only. It never caches `/api`, uses network-first for pages, and cache-first for hashed assets. Registered only in production builds | `frontend/public/sw.js`, `frontend/src/main.tsx` |
| iOS meta | `apple-touch-icon`, `apple-mobile-web-app-*`, `viewport-fit=cover` with safe-area padding | `frontend/index.html` |
| vite-plugin-pwa | **No.** It isn't needed; the hand-written SW is fine. Add Workbox only if offline forms grow | – |
| Capacitor config | **No.** No `capacitor.config.*` and no `@capacitor/*` packages | – |
| Camera bill capture | **Yes, on the web.** `ReceiptCapture` uses a file input with `capture`, which opens the phone camera | `frontend/src/ui/ReceiptCapture.tsx` |
| Mobile shell | **Yes.** Role-based bottom bar (Home / Punch / + / Leave / Pay / More), a quick-action sheet, and actions reachable in two taps or fewer | `frontend/src/app/BottomBar.tsx`, `bottom-tabs.ts`, `quick-actions.ts` |
| Web push | **No.** No PushManager or VAPID, and no backend sender | – |
| Offline queue | **No.** No IndexedDB or background sync | – |
| Geo check-in | **No.** RQ-ATT-025 is still Missing, with no geolocation code | – |
| Biometric / passkey login | **No.** No WebAuthn | – |

## 2. Users and what they need from a phone

| Group | Device reality | Daily phone jobs | Critical need |
|---|---|---|---|
| Plant workers | Mid- and low-end Android, patchy data, shared phones, Hindi/Bengali preference | See today's in and out times, leave balance, payslip, apply leave or regularisation | Light and fast on 2 to 3 GB RAM, works on poor data, simple install. **Their punches come from Kent face terminals, not the phone.** |
| Field staff / sales | Android, on the move | Geo check-in and out, official duty, claims with bill photos | Accurate location at the moment of check-in, mock-GPS detection, offline queue |
| Managers / HODs / plant heads | Android, with some iPhones | Approve leave, regularisation, OT (48h window!), claims | Push notifications that actually arrive, one-tap approve, biometric unlock |
| HR / payroll / IT | Windows desktop at 1366/1920, 125–150% scaling | Everything else | Desktop browser. No app needed |
| CEO cell | iPhone likely | Group dashboard glance | Widget or push summary, iOS support |

## 3. Option comparison

| Capability | **PWA only** | **PWA + Capacitor 8** (same React build) | **Dedicated native** (React Native / Flutter) |
|---|---|---|---|
| Reuse of existing React 19 code | 100% | ~95% (the same `dist/` in a WebView, plus small native plugins) | ~10–20% (logic and API types only; every screen rebuilt) |
| Geo check-in accuracy | Good on Android Chrome (fused GPS) **in the foreground only**. Mock GPS can't be detected | Good. The native fused provider plus `isMock()` detection ([Android](https://developer.android.com/develop/sensors-and-location/location/geofencing)), and optionally [Play Integrity](https://developer.android.com/google/play/integrity/overview) | Same as Capacitor |
| Background location / geofence auto-punch | **Not possible** ([no background execution on iOS web apps](https://progressivewebapps.com/platforms/ios-safari/)) | Possible with [@capgo/background-geolocation v8](https://github.com/Cap-go/capacitor-background-geolocation) or [Capawesome](https://capawesome.io/docs/sdks/capacitor/background-geolocation/). **Not recommended**: it triggers Play's [background-location declaration + video review](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en) | Possible, same policy cost |
| Camera bill capture | Works today (`<input capture>`) | Works today; optionally the native Camera plugin with crop and compression | Native |
| Push notifications | Android: yes. **iOS: only after "Add to Home Screen"**, permission only from a tap, and every push must show a notification ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [limits](https://progressivewebapps.com/background/ios-web-push/)) | Full FCM / APNs, reliable on both | Full |
| Offline punches and forms | IndexedDB drafts. Sync on reopen only (no Background Sync on iOS) | SQLite queue plus native retry | Full |
| Biometric login | WebAuthn passkeys (fingerprint or face) work on modern Android and iOS | Passkeys, or a native biometric unlock of a stored refresh token | Native |
| Home-screen widgets | **No** (manifest `shortcuts` give long-press shortcuts on Android only; iOS ignores them) | **Yes**, with native widget extensions fed by a plugin (§6) | Yes |
| Play Store | Possible as a [TWA via Bubblewrap](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start) (no native features) | Yes | Yes |
| App Store | No (web only) | Yes. Must clear [Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/), so bundle assets locally and use native push, biometrics and camera | Yes |
| MDM (Intune, etc.) | Push a URL or web clip | [Managed Google Play private app](https://support.google.com/work/android/answer/9495634?hl=en) / [Apple Custom App](https://support.apple.com/guide/business/learn-about-custom-apps-axm58ba3112a/web) | Same as Capacitor |
| Updates | Instant (deploy the web app) | Web layer: ship with each store release, or OTA live updates ([Capgo](https://capgo.app/docs/live-updates/); Ionic Appflow is closed to new customers). Native changes go through store review | Every UI change goes through store review (or an OTA tool such as Expo Updates or Shorebird) |
| Effort | ~2 weeks | +4–5 weeks Android, +3–4 weeks widgets and iOS | 4–6 months for parity, then two codebases forever |
| Ongoing cost | Hosting only | $25 Play (one-time) + $99/yr Apple + a Mac or cloud build for iOS | Same fees + a mobile team |

**Why not native:** the app is form- and table-heavy, with ~80 routes and strict payroll parity. A rewrite risks regressions in exactly the areas the owner cares about most (no mock data, 44/44 reconciliation). The users' devices also do better with one small WebView app than with two parallel UIs. Capacitor 8 ([announcement](https://ionic.io/blog/announcing-capacitor-8), Dec 2025) handles Android 16 edge-to-edge through its built-in SystemBars plugin, and the app already pads for safe areas.

## 4. Recommendation and phased plan

### Phase 1: PWA hardening (≈ 2 dev-weeks; start now, no store needed)
1. **Web push (VAPID)** for approvals waiting, OT expiring in under 12h, leave decided and payslip published. Backend: a `push_subscriptions` table and a sender. Ask permission from a button tap, after the first approval or leave. On iOS, show "Add to Home Screen" coaching first.
2. **Install prompt:** `beforeinstallprompt` on Android, plus a one-screen iOS "Share, then Add to Home Screen" guide.
3. **Offline drafts:** queue leave, regularisation and claim forms in IndexedDB, and send them when the app is back online or reopened. Show a clear "Waiting to send" state. Never cache payroll or attendance API data (keep the current SW rule).
4. **Passkeys (WebAuthn)** as an optional second sign-in method after the password. Keep the password and lockout rules.
5. **Low-end performance budget:** JS under 200 KB gzipped on the ESS route, Lighthouse mobile at 90 or above on a throttled Moto-class profile.

### Phase 2: Capacitor Android app (≈ 4–5 dev-weeks)
1. `npx cap init` in `frontend/` (app id e.g. `com.rashmigroup.hrms`). Bundle `dist/` locally; don't point at a live URL.
2. **Geo check-in for field staff (RQ-ATT-025):** foreground only, started by a tap. Take one high-accuracy fix with accuracy ≤ 50 m and drop anything older than 30 s. Check the geofence on the server per site master, and record `isMock`, the accuracy and the device id. A punch from outside the fence becomes an exception for HR to review (never a silent reject). It writes into the same swipe pipeline as Kent with `source = 'mobile_geo'`. **Skip background location**: one tap is enough for attendance, and it avoids the Play declaration and video review and the battery complaints.
3. **Native push** (FCM) through `@capacitor/push-notifications`, reusing the Phase-1 sender with an FCM transport.
4. **Biometric unlock:** keep the refresh token in Android Keystore and unlock it with fingerprint. The server still enforces session expiry.
5. **Offline punch queue:** SQLite, with the device timestamp **plus** the server receive time. The server flags any punch more than 15 min late for review.
6. **Distribution:** Managed Google Play private app if RML has MDM (Intune, etc.), otherwise the Play Store internal track, then closed, then production.

### Phase 3: widgets and iOS (≈ 3–4 dev-weeks) – see §6 and §7

### Who gets what
- Plant workers: PWA link or Play app, whichever installs easier. No geo (Kent covers them).
- Field staff: Capacitor app (required for geo and mock checks).
- Managers and HODs: Capacitor app (push plus biometrics). The PWA is acceptable until it ships.
- HR, payroll and IT: desktop browser.

## 5. Risks and mitigations
- **Shared and low-end phones:** keep sessions short, with "Sign out on this device" in Account (Sessions view exists for it_admin). Biometric unlock is off by default on shared devices.
- **Location privacy:** take location only at check-in, never continuously. State this in the privacy policy and in an in-app disclosure before the permission prompt.
- **iOS push in the PWA:** works only from the home-screen app. Managers on iPhone should use the native app once Phase 3 ships.
- **OTA updates:** only for web-layer changes within the approved purpose. Native or permission changes need a store release.

## 6. Home-screen widgets (owner request)

**Feasible with Capacitor; no native rewrite needed.** Widgets never run inside the WebView. They are always small native views: **WidgetKit/SwiftUI** on iOS, and **Jetpack Glance / AppWidgetProvider** on Android. That holds for React Native and Flutter too, so a native app has no real advantage here. The Capacitor app writes a small JSON snapshot that the widget reads ([how it works](https://hybridmob.com/tutorials/ionic-widgets-live-activities-capacitor)):
- **iOS:** an **App Group** (`group.com.rashmigroup.hrms`) enabled on both the app and the widget extension target, using `UserDefaults(suiteName:)`, then `WidgetCenter.reloadTimelines`.
- **Android:** SharedPreferences or DataStore, then a Glance update, plus a WorkManager periodic refresh (15-minute minimum).
- **Plugins:** [@capgo/capacitor-widget-kit](https://github.com/Cap-go/capacitor-widget-kit) (shared state, SVG-template or fully native widgets, Live Activities) or [capacitor-native-widgets](https://github.com/alesmraz/capacitor-native-widgets) (simple key-value bridge). Either way, plan to write ~150–300 lines of Swift and Kotlin per widget.

| Widget | Data (snapshot) | Refresh | Notes |
|---|---|---|---|
| **Today** (small) | First in / last out, status glyph (P, A:P, UAB), shift | App open, push "punch processed", 30-min timeline | Kent data lands after device sync, so show an "as of 09:42" time |
| **Leave balance** (small/medium) | CL / SL / EL ready-to-take | App open, after leave decisions | Tapping opens `/my/leave?action=apply` |
| **Approvals** (small, managers) | **Count only** + the oldest SLA deadline | Push on new item | No names or reasons on the lock screen (privacy) |
| **Quick check-in** (field staff) | Button | – | Opens the app at `/my/attendance?action=geo`. The fix and mock check must run in the app, so the widget can't punch silently. On iOS 17+ an App Intent can open the app directly |

- **No PWA equivalent:** the closest is Android manifest shortcuts, which exist today.
- **Effort:** ~1.5 weeks for both platforms (4 widgets), plus 0.5 week for snapshot APIs (`GET /api/me/widget-snapshot`, read-only, with a short-lived token stored in Keychain or Keystore).

## 7. Store launches and enterprise distribution

### Accounts (start now; these are the long poles)
| Item | Requirement | Time / cost |
|---|---|---|
| **D-U-N-S number** for the legal entity that will be the seller (e.g. Rashmi Metaliks Ltd) | Free from Dun & Bradstreet. Needed by both Apple and Google org accounts | Apple says up to 5 business days + 2 days to sync ([Apple](https://developer.apple.com/help/account/membership/D-U-N-S/)). Google warns up to 30 days ([Google](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)) |
| **Google Play Console, organization account** | D-U-N-S, org website, verified contacts and documents | **$25 one-time** ([Google](https://support.google.com/android-developer-console/answer/16604405?hl=en)). Org accounts are **exempt** from the 12-tester / 14-day closed-test rule that applies to new personal accounts ([Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)) |
| **Apple Developer Program, organization** | D-U-N-S, legal entity (no trade names), someone with signing authority, domain email, live website | **$99/yr** ([Apple](https://developer.apple.com/help/account/membership/program-enrollment/)). The Enterprise Program ($299/yr) is **not needed**; use Custom Apps instead |

### Store requirements checklist
- **Privacy policy URL** (in the app and on both listings). It must cover attendance, location (at check-in only), camera (bills), biometrics (on-device only), PII (PAN, Aadhaar, bank, masked), retention, and DPDP Act 2023 grievance contact.
- **Play Data safety form:** declare precise location, photos, personal info, financial info (salary), and device IDs. Say whether data is encrypted in transit (yes) and whether it can be deleted (via HR).
- **Play target SDK:** new apps and updates must target **Android 16 / API 36 from 31 Aug 2026** ([Google](https://support.google.com/googleplay/android-developer/answer/11926878)). Capacitor 8 supports this.
- **Location permission justification:** use foreground-only `ACCESS_FINE_LOCATION` with a prominent in-app disclosure before the prompt. If background location is ever added, it needs the Permissions Declaration Form plus a ≤30 s video ([Google](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en)), which is the main reason to stay foreground-only.
- **App Review demo account** (Apple requires one): a sanitised demo tenant login. Never real employee data.
- **Review risks:**
  - Apple 4.2 "minimum functionality" for web wrappers ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). Mitigate with locally bundled assets, native push, biometrics, camera, widgets, and no browser chrome or external links.
  - Apple 5.1.1 asks for an account-deletion path. For an employer-provisioned account, explain in review notes that accounts are managed by the employer.
  - Play's policy on login-only apps: provide test credentials.

### Testing tracks
- **Android:** Internal testing (≤100 testers, builds live in minutes), then **Closed testing** (pilot: one plant plus managers), then Production or private.
- **iOS:** **TestFlight** internal (up to 100 team members, no review), then external (up to 10,000, light beta review), then release.

### Enterprise and private distribution (recommended for an internal HR app)
- **Android: Managed Google Play private app**, published to RML's organisation only. MDM (Intune, Workspace ONE, Google endpoint management) can force-install it on company phones, or users install it from the work profile ([Google](https://support.google.com/work/android/answer/9495634?hl=en)). Personal phones without MDM: use a public Play listing, which is harmless because login is required, or an unlisted closed track.
- **iOS: Apple Business Manager Custom App** (private to RML, MDM-assignable) ([Apple](https://support.apple.com/guide/business/learn-about-custom-apps-axm58ba3112a/web)). For staff on personal iPhones without MDM, use an **Unlisted App** link ([Apple](https://developer.apple.com/support/unlisted-app-distribution/)). Private and public can't be switched later without a new app record, so decide up front. **Suggestion: Unlisted**, because it covers both managed and personal devices.

### Timeline and cost (indicative)
| Week | Work | Gate |
|---|---|---|
| 0 | Request D-U-N-S; create Play and Apple org accounts; draft privacy policy | Legal and IT sign-off |
| 0–2 | Phase 1 PWA (push, offline drafts, passkeys, install guide) | Lighthouse ≥ 90 mobile, e2e green |
| 2–6 | Phase 2 Capacitor Android: geo check-in, FCM, biometrics, offline queue | Internal track, then a closed pilot at one plant |
| 6–8 | Widgets (Android and iOS) + iOS build: APNs, Face ID, App Group | TestFlight |
| 8–10 | Store listings, data safety, review; Managed Play / ABM or Unlisted release | Go-live |

**Effort:** about 9–11 dev-weeks for one experienced web plus mobile developer (or 6–7 weeks with two).
**Fixed fees:** $25 one-time (Play) + $99/yr (Apple); D-U-N-S is free.
**Variable costs:**
- A Mac (or a cloud macOS build, ~$20–50/month) for iOS.
- Optional Capgo OTA (paid tiers).
- FCM is free; Web Push and APNs are free.

## 8. Decisions the owner needs to make
1. Which legal entity is the store "seller" (this drives the D-U-N-S)?
2. Does RML have MDM? (This decides Managed Play / ABM versus public or unlisted listings.)
3. Who does geo check-in apply to (which grades or departments), and what are the site geofence radii?
4. Do iPhone users matter at launch, or is Android-first fine? (Recommended: Android first.)
