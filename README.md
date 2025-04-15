/**
 * UniversalTracking Library
 *
 * Description:
 * A comprehensive, lightweight tracking library designed for web applications,
 * allowing easy integration of user event analytics and behavior tracking.
 *
 * Features:
 * - Manual event logging via `trackEvent()`.
 * - Automatic DOM-based event tracking using HTML attributes (`data-track-event`).
 * - Periodic batch transmission of tracking data using XMLHttpRequest.
 * - Offline support and retry mechanism leveraging `localStorage`.
 * - Enhanced client metadata collection (User-Agent, OS, device type, timezone, geolocation).
 * - Cookie-based authentication (`apiKey`, `sessionId`, optionally `userId`).
 * - Configurable idle/active user state tracking.
 *
 * Usage:
 * 1. Initialize the tracking system:
 *    ```js
 *    UniversalTracking.init({
 *      API_KEY: 'your-api-key',
 *      SESSION_ID: 'your-session-id',
 *      USER_ID: 'optional-user-id',
 *      periodicSend: 30,        // optional, defaults to 60s
 *      customIdleTimer: 10,     // optional, defaults to 50s
 *      retryCount: 3            // optional, number of retries for failed requests
 *    }, (data) => {
 *      console.log('Event tracked:', data);
 *    });
 *
 * 2. Automatic tracking for DOM elements:
 *    Add attributes to elements you wish to track automatically:
 *    ```html
 *    <button
 *      data-track-event="button_clicked"
 *      data-track-on="click"
 *      data-track-props='{"source":"header"}'>
 *      Click me
 *    </button>
 *    ```
 *
 * 3. Manual event tracking:
 *    ```js
 *    UniversalTracking.trackEvent('custom_event', { customKey: 'customValue' });
 *    ```
 *
 * 4. Resetting stored tracking data and authentication:
 *    ```js
 *    UniversalTracking.resetStorage();
 *    ```
 *
 * Implementation Notes:
 * - Events are queued and periodically sent to a server endpoint.
 * - Ensures only one concurrent request is active at a time.
 * - Stores failed events in `localStorage` and attempts automatic retries.
 * - Captures enriched metadata asynchronously to accompany tracked events.
 * - Idle tracking monitors user interactions to determine active/idle states.
 * - Provides functionality to manage and clear authentication cookies and stored events.
 *
 * Export Compatibility:
 * - Browser Global: accessible as `window.UniversalTracking`
 * - Node.js/CommonJS: accessible via `module.exports`
 */