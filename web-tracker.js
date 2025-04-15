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

(function setupUniversalTracking(global) {
  const UniversalTracking = (function createUniversalTrackingLib() {
    let trackerFn = null;
    let isSending = false;
    const LOCAL_STORAGE_KEY = "UNSENT_TRACKING_EVENTS";
    let idleTimeout = null;
    let isUserIdle = false;
    let idleThreshold = 30000;
    let isIdleTrackingEnabled = true;
    const xhr = new XMLHttpRequest();
    const idleEvents = {
      IDLE_START: "idl-start",
      IDLE_END: "idl-end",
    };
    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    window.analyticsQueue = []; // Data Layer for storing events

    function setAuthDetails(apiKey, sessionId, userId = null) {
      if (typeof apiKey === "string" && typeof sessionId === "string") {
        document.cookie = `APP_TRACKING_API_KEY=${encodeURIComponent(
          apiKey
        )}; path=/;`;
        document.cookie = `APP_TRACKING_SESSION_ID=${encodeURIComponent(
          sessionId
        )}; path=/;`;
        document.cookie = `APP_TRACKING_USER_ID=${encodeURIComponent(
          userId
        )}; path=/;`;
      } else {
        console.error(
          "UniversalTracking: API Key and Session ID must be strings."
        );
      }
    }
    function getCookieValue(name) {
      const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
      return match ? decodeURIComponent(match[2]) : null;
    }
    function removeCookie(cookieName, path = "/", domain = "") {
      if (!cookieName) {
        console.warn(
          "UniversalTracking: removeCookie requires a valid cookie name."
        );
        return;
      }
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=${path};${
        domain ? ` domain=${domain};` : ""
      }`;
    }
    function isAuthorized() {
      const apiKey = getCookieValue("APP_TRACKING_API_KEY");
      const sessionId = getCookieValue("APP_TRACKING_SESSION_ID");
      return !!(apiKey && sessionId);
    }

    async function init(configObj, callback) {
      if (
        typeof configObj !== "object" ||
        Object.keys(configObj).length === 0
      ) {
        console.warn(
          "UniversalTracking: init() requires a valid configuration."
        );
        return;
      }
      trackerFn = callback;
      configureTracking(configObj);
      if (!isAuthorized()) {
        console.warn("UniversalTracking: User not registered for analytics.");
        return;
      }
      let clientDetails = {};
      try {
        clientDetails = await getClientDetails();
      } catch (err) {
        console.warn("UniversalTracking: Failed to get client details.", err);
      }
      const { agent, os, device, timeZone, location } = clientDetails;
      xhr.open("POST", "https://example.com/track", true);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.setRequestHeader(
        "Authorization",
        `ApiKey ${getCookieValue("APP_TRACKING_API_KEY")}`
      );
      xhr.setRequestHeader("Cross-Origin-Resource-Policy", "cross-origin");
      xhr.setRequestHeader(
        "X-User-Id",
        getCookieValue("APP_TRACKING_USER_ID") || "Unknown"
      );
      xhr.setRequestHeader("User-Agent", agent || "Unknown");
      xhr.setRequestHeader("Sec-CH-UA-Platform", os || "Unknown");
      xhr.setRequestHeader("X-Device", device || "Unknown");
      xhr.setRequestHeader("X-Timezone", timeZone || "Unknown");
      xhr.setRequestHeader(
        "Location",
        location ? JSON.stringify(location) : "Unknown"
      );
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => attach());
      } else {
        attach();
      }
    }

    async function trackEvent(eventName, trackingData = {}) {
      if (!isAuthorized()) {
        console.warn("UniversalTracking: User not registered for analytics.");
        return;
      }
      if (!eventName || typeof eventName !== "string") {
        console.warn(
          "UniversalTracking: trackEvent() requires a valid event name."
        );
        return;
      }
      if (!trackerFn) {
        console.warn("UniversalTracking: Tracker not initialized.");
        return;
      }
      try {
        const payload = { eventId: eventName, ...trackingData };
        trackerFn(payload);
        window.analyticsQueue.push(payload); // Data Layer
      } catch (err) {
        console.error("UniversalTracking: Error in tracker function", err);
      }
    }

    function parseProps(propString) {
      try {
        return propString ? JSON.parse(propString) : {};
      } catch {
        console.warn("UniversalTracking: Invalid JSON in data-track-props.");
        return {};
      }
    }
    function stringifyProps(propString) {
      try {
        return propString ? JSON.stringify(propString) : {};
      } catch {
        console.warn("UniversalTracking: Invalid JSON .");
        return {};
      }
    }

    function configureTracking(configObj) {
      if (configObj.API_KEY && configObj.SESSION_ID) {
        setAuthDetails(
          configObj.API_KEY,
          configObj.SESSION_ID,
          configObj.USER_ID ?? null
        );
      }
      if (configObj.periodicSend) {
        startPeriodicSend(configObj.periodicSend);
      }
      if (configObj.customIdleTimer) {
        setCustomIdleTimer(configObj.customIdleTimer);
      }
      if (configObj.retryCount) {
        retryUnsentEvents(configObj.retryCount);
      }
    }
    async function sendData(data) {
      if (!data || !data.length || isSending) return; // Prevent concurrent calls
      isSending = true;

      try {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            isSending = false; // Reset lock
            if (xhr.status >= 200 && xhr.status < 300) {
              window.analyticsQueue = window.analyticsQueue.filter(
                (item) => !data.includes(item)
              );
              clearUnsentEvents(data);
            } else {
              saveUnsentEvents(data);
              console.error("UniversalTracking: Failed to send tracking data");
            }
          }
        };
        xhr.onerror = () => {
          isSending = false; // Reset lock on error
          saveUnsentEvents(data);
          console.error("UniversalTracking: Request failed.");
        };

        xhr.send(stringifyProps(data));
      } catch (err) {
        isSending = false; // Reset lock on exception
        window.analyticsQueue = window.analyticsQueue.map((item) =>
          data.includes(item) ? { ...item, isTracked: false } : item
        );
        saveUnsentEvents(data);
        console.error("UniversalTracking: Error sending data", err);
      }
    }
    function handleTrackedElement(e) {
      const el = e.currentTarget;
      const eventName = el.getAttribute("data-track-event");
      if (!eventName) return;

      const props = parseProps(el.getAttribute("data-track-props"));
      trackEvent(eventName, props);
    }

    function attach(root = document) {
      if (!root || typeof root.querySelectorAll !== "function") {
        console.warn("UniversalTracking: attach() expects a valid DOM root.");
        return;
      }

      const elements = root.querySelectorAll("[data-track-event]");
      elements.forEach((el) => {
        const evt = el.getAttribute("data-track-on") || "click";
        el.removeEventListener(evt, handleTrackedElement);
        el.addEventListener(evt, handleTrackedElement);
      });
    }

    function startPeriodicSend(initSeconds = 60) {
      if (
        typeof initSeconds !== "number" ||
        initSeconds < 5 ||
        initSeconds > 60
      ) {
        console.warn(
          "UniversalTracking: initSeconds must be a number between 5 and 60."
        );
        return;
      }
      setInterval(() => {
        if (window.analyticsQueue.length > 0) {
          const batch = [
            ...window.analyticsQueue.filter((event) => !event.isTracked),
          ];
          if (batch.length > 0) {
            sendData(batch);
          }
        }
      }, initSeconds * 1000);
    }

    async function getClientDetails() {
      // To Get Metadata of the Client
      const ua = navigator.userAgent;
      const { timeZone } = Intl.DateTimeFormat().resolvedOptions();

      let os = "Unknown OS";
      if (ua.indexOf("Win") !== -1) os = "Windows";
      else if (ua.indexOf("Mac") !== -1) os = "MacOS";
      else if (ua.indexOf("Linux") !== -1) os = "Linux";
      else if (ua.indexOf("Android") !== -1) os = "Android";
      else if (ua.indexOf("like Mac") !== -1) os = "iOS";

      const device = /Mobi|Android/i.test(ua) ? "Mobile" : "Desktop";

      let uaDetails = {};
      if (navigator.userAgentData) {
        try {
          uaDetails = await navigator.userAgentData.getHighEntropyValues([
            "platform",
            "model",
          ]);
        } catch (e) {
          console.warn("UniversalTracking: Could not get userAgentData.");
        }
      }

      const getLocation = () =>
        new Promise((resolve) => {
          if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              () => resolve({ latitude: null, longitude: null }),
              { timeout: 5000 }
            );
          } else {
            resolve({ latitude: null, longitude: null });
          }
        });

      const location = await getLocation();

      return {
        agent: ua,
        os,
        device,
        timeZone,
        location,
        ...uaDetails,
      };
    }

    function saveUnsentEvents(events) {
      try {
        const existing =
          JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
        const existingStrSet = new Set(existing.map((e) => JSON.stringify(e)));
        const newEvents = events.filter(
          (e) => !existingStrSet.has(JSON.stringify(e))
        );
        const merged = [...existing, ...newEvents];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      } catch (err) {
        console.warn("UniversalTracking: Failed to save unsent events.", err);
      }
    }
    function getUnsentEvents() {
      try {
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
      } catch {
        return [];
      }
    }
    function clearUnsentEvents(eventsToRemove) {
      try {
        const existing = getUnsentEvents();
        const filtered = existing.filter(
          (e) =>
            !eventsToRemove.some((r) => JSON.stringify(r) === JSON.stringify(e))
        );
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.warn("UniversalTracking: Failed to clear unsent events.", err);
      }
    }
    async function retryUnsentEvents(retryCount = 3, intervalInSeconds = 5) {
      const unsent = getUnsentEvents();
      if (!unsent.length) return;
      let remaining = [...unsent];

      async function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      async function attemptSend(attempt) {
        if (attempt >= retryCount || remaining.length === 0) {
          if (remaining.length > 0) {
            console.warn(
              `UniversalTracking: Retry limit (${retryCount}) reached. Some events remain unsent.`
            );
          }
          return;
        }
        await sendData(remaining);
        remaining = getUnsentEvents();

        if (remaining.length > 0) {
          await delay(intervalInSeconds * 1000);
          await attemptSend(attempt + 1);
        }
      }

      await attemptSend(0);
    }

    function getPreviousPath() {
      const previousUrl = document.referrer;
      if (previousUrl) {
        return previousUrl;
      }
      return null;
    }
    function getCurrentPath() {
      const currentUrl = window.location.href;
      if (currentUrl) {
        return currentUrl;
      }
      return null;
    }
    // *********************************Timer*************************************

    function setCustomIdleTimer(threshold = 50) {
      idleThreshold = threshold * 1000;
      if (isIdleTrackingEnabled) {
        startIdleTimer();
        activityEvents.forEach((event) =>
          document.addEventListener(event, handleUserActivity, true)
        );
      }
    }
    function toggleIdleTracking(enable) {
      isIdleTrackingEnabled = enable;
      if (!enable) {
        clearTimeout(idleTimeout);
        activityEvents.forEach((event) =>
          document.removeEventListener(event, handleUserActivity, true)
        );
      } else {
        startIdleTimer();
        activityEvents.forEach((event) =>
          document.addEventListener(event, handleUserActivity, true)
        );
      }
    }

    function handleUserActivity() {
      if (isUserIdle) {
        isUserIdle = false;
        trackEvent(idleEvents.IDLE_END, {
          time: new Date().toISOString(),
          path: getCurrentPath(),
        });
      }
      startIdleTimer();
    }

    function startIdleTimer() {
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        isUserIdle = true;
        trackEvent(idleEvents.IDLE_START, {
          time: new Date().toISOString(),
          path: getCurrentPath(),
        });
      }, idleThreshold);
    }
    function resetStorage() {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      [
        "APP_TRACKING_API_KEY",
        "APP_TRACKING_SESSION_ID",
        "APP_TRACKING_USER_ID",
      ].forEach((cookieName) => removeCookie(cookieName));
    }
    return {
      init,
      trackEvent,
      toggleIdleTracking,
      getPreviousPath,
      getCurrentPath,
      resetStorage,
    };
  })();

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = UniversalTracking;
  } else {
    global.UniversalTracking = UniversalTracking;
  }
})(typeof window !== "undefined" ? window : this);
