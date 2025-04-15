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

(function setupUniversalTracking(global) {
  const UniversalTracking = (function createUniversalTrackingLib() {
    let trackerFn = null;
    window.analyticsQueue = []; // Data Layer for storing events
    function setAuthDetails(apiKey, sessionId) {
      if (typeof apiKey === "string" && typeof sessionId === "string") {
        document.cookie = `APP_TRACKING_API_KEY=${encodeURIComponent(
          apiKey
        )}; path=/;`;
        document.cookie = `APP_TRACKING_SESSION_ID=${encodeURIComponent(
          sessionId
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
    function isAuthorized() {
      const apiKey = getCookieValue("APP_TRACKING_API_KEY");
      const sessionId = getCookieValue("APP_TRACKING_SESSION_ID");
      return !!(apiKey && sessionId);
    }

    function init(callback) {
      if (typeof callback !== "function") {
        console.warn("UniversalTracking: init() requires a function.");
        return;
      }
      trackerFn = callback;
      startPeriodicSend();
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

    let isSending = false;

    async function sendData(data) {
      if (!data || !data.length || isSending) return; // Prevent concurrent calls
      isSending = true;

      try {
        const clientDetails = await getClientDetails();
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://example.com/track", true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.setRequestHeader(
          "Authorization",
          `ApiKey ${getCookieValue("APP_TRACKING_API_KEY")}`
        );
        xhr.setRequestHeader("X-User-Id", "null");
        xhr.setRequestHeader("X-Metadata", stringifyProps(clientDetails));

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

    const LOCAL_STORAGE_KEY = "UNSENT_TRACKING_EVENTS";

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

    let idleTimeout = null;
    let isUserIdle = false;
    let idleThreshold = 30000;
    let isIdleTrackingEnabled = true;
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

    return {
      init,
      attach,
      trackEvent,
      setAuthDetails,
      startPeriodicSend,
      setCustomIdleTimer,
      toggleIdleTracking,
      retryUnsentEvents,
      getPreviousPath,
      getCurrentPath,
    };
  })();

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = UniversalTracking;
  } else {
    global.UniversalTracking = UniversalTracking;
  }
})(typeof window !== "undefined" ? window : this);
