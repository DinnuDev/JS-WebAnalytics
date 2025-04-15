/**
 * UniversalTracking Library
 *
 *  Description:
 * A lightweight, browser-friendly event tracking library using `data-*` attributes and manual APIs.
 * Ideal for integrating custom analytics or behavior logging into web apps.
 *
 *  Core Capabilities:
 * - Manual tracking via `UniversalTracking.trackEvent(eventName, trackingData)`
 * - Auto DOM-based tracking via `data-track-event`, `data-track-on`, and `data-track-props`
 * - Periodic batch sending using `XMLHttpRequest`
 * - Offline/failed request recovery using `localStorage`
 * - Client metadata enrichment (OS, device, location, timezone, etc.)
 * - Cookie-based authentication (`apiKey`, `sessionId`)
 * - Built-in idle/active user tracking
 *
 *  How to Use:
 * 1. Initialize tracker with a callback:
 *    `UniversalTracking.init((data) => { ... })`
 *
 * 2. Set auth details via cookies:
 *    `UniversalTracking.setAuthDetails('API_KEY', 'SESSION_ID')`
 *
 * 3. Start periodic flushing of the event queue:
 *    `UniversalTracking.startPeriodicSend(30)` // every 30s
 *
 * 4. Enable idle tracking (optional):
 *    `UniversalTracking.setCustomIdleTimer(10)` // idle after 10s
 *
 * 5. Attach tracking to DOM:
 *    `UniversalTracking.attach()` // auto-binds all `[data-track-event]`
 *
 * 6. Track events manually:
 *    `UniversalTracking.trackEvent('eventName', { key: 'value' })`
 *
 *  Example Markup for DOM Auto-Tracking:
 * <button
 *   data-track-event="button_click"
 *   data-track-on="click"
 *   data-track-props='{"source": "header"}'>
 *   Click Me
 * </button>
 *
 *  Export Modes:
 * - Browser: Exposed as `window.UniversalTracking`
 * - Node/CommonJS: Exported via `module.exports`
 *
 *  Example Setup:
 * ```js
 * export const initTracking = () => {
 *   const tracking = window.UniversalTracking;
 *   if (!tracking) return;
 *
 *   tracking.setAuthDetails('your-api-key', 'your-session-id');
 *   tracking.init((data) => {
 *     console.log('Tracked from React:', data);
 *     return data;
 *   });
 *   tracking.startPeriodicSend(30);
 *   tracking.setCustomIdleTimer(10);
 *   tracking.attach();
 * };
 *
 * initTracking();
 */