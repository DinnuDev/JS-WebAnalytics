/**
 * UniversalTracking Library
 *
 * Description:
 * This IIFE (Immediately Invoked Function Expression) defines a lightweight, flexible event tracking utility
 * for attaching analytics or custom tracking logic to DOM elements using `data-*` attributes.
 *
 * Usage:
 * - Call `UniversalTracking.init(callback)` with a tracking function to initialize the library.
 * - Use `UniversalTracking.attach([rootElement])` to bind tracking to DOM elements with `data-track-event`.
 * - Call `UniversalTracking.trackEvent(eventName, data)` manually to trigger custom tracking events.
 *
 * DOM-based Tracking:
 * - Add `data-track-event="eventName"` to any HTML element to identify it as trackable.
 * - Optionally, add `data-track-on="eventType"` (e.g., click, mouseover) to specify the event (default is "click").
 * - Optionally, add `data-track-props='{"key": "value"}'` to include metadata with the tracking event.
 *
 * Features:
 * - Handles custom events and props.
 * - Prevents double-binding of event listeners.
 * - Parses JSON safely for props.
 * - Gracefully handles uninitialized states and input errors.
 *
 * Structure:
 * - `init(callback)`: Registers the tracking function to be used for sending tracking data.
 * - `trackEvent(eventName, trackingData)`: Manually tracks a named event with optional data.
 * - `attach(root)`: Binds event listeners to all children of `root` with `data-track-event`.
 * - `parseProps(str)`: Parses JSON from `data-track-props` safely.
 * - `handleTrackedElement(e)`: Internal event handler for DOM-bound tracking.
 *
 * Export:
 * - Works in both Node (CommonJS) and browser environments.
 */

(function setupUniversalTracking(global) {
  const UniversalTracking = (function createUniversalTrackingLib() {
    let trackerFn = null;

    function init(callback) {
      if (typeof callback !== "function") {
        console.warn("UniversalTracking: init() requires a function.");
        return;
      }
      trackerFn = callback;
    }

    function trackEvent(eventName, trackingData = {}) {
      if (!eventName || typeof eventName !== "string") {
        console.warn(
          "UniversalTracking: trackEvent() requires a valid event name."
        );
        return;
      }
      if (!trackingData.API_KEY || typeof trackingData.API_KEY !== "string") {
        console.error(
          "UniversalTracking: trackingData requires valid API_KEY."
        );
        return;
      }
      if (!trackerFn) {
        console.warn("UniversalTracking: Tracker not initialized.");
        return;
      }
      try {
        trackerFn({ event: eventName, ...trackingData });
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

    return {
      init,
      attach,
      trackEvent,
    };
  })();

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = UniversalTracking;
  } else {
    global.UniversalTracking = UniversalTracking;
  }
})(typeof window !== "undefined" ? window : this);
