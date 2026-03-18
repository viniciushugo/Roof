import * as amplitude from '@amplitude/analytics-browser';

// Constants
export const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY;

// Event Names
export const EVENTS = {
  // Auth & Onboarding
  WELCOME_SCREEN_VIEWED: 'welcome_screen_viewed',
  LOGIN_STARTED: 'login_started',
  LOGIN_COMPLETED: 'login_completed',
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed', // property: step_name
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed', // property: step_name
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // Core App
  ROOMS_PAGE_VIEWED: 'rooms_page_viewed',
  PROPERTY_LIKED: 'property_liked', // properties: property_id, price, housing_type
  PROPERTY_PASSED: 'property_passed', // property: property_id
  PROPERTY_DETAILS_VIEWED: 'property_details_viewed', // property: property_id

  // Social & Account
  CHAT_OPENED: 'chat_opened', // property: match_id
  MESSAGE_SENT: 'message_sent', // property: match_id
  PROFILE_VIEWED: 'profile_viewed',
  PREFERENCES_UPDATED: 'preferences_updated',
} as const;

// Types
export type EventName = typeof EVENTS[keyof typeof EVENTS] | (string & {});

/**
 * Initializes Amplitude Analytics.
 * Should be called once at the start of the application.
 */
export const initAmplitude = () => {
  if (!AMPLITUDE_API_KEY) {
    console.warn('Amplitude API Key is missing. Analytics will not be tracked.');
    return;
  }

  amplitude.init(AMPLITUDE_API_KEY, undefined, {
    serverZone: 'EU',
    defaultTracking: {
      sessions: true,
      pageViews: false, // We'll track page views manually if needed or rely on specific screen views
      formInteractions: false,
      fileDownloads: false,
    },
  });
};

/**
 * Identify a user in Amplitude.
 * 
 * @param userId - The unique identifier for the user (e.g., from Supabase)
 * @param userProperties - Optional properties to attach to the user (email, name, etc)
 */
export const identifyUser = (userId: string, userProperties?: Record<string, any>) => {
  if (!AMPLITUDE_API_KEY) return;
  
  amplitude.setUserId(userId);
  
  if (userProperties) {
    const identifyObj = new amplitude.Identify();
    Object.entries(userProperties).forEach(([key, value]) => {
      identifyObj.set(key, value);
    });
    amplitude.identify(identifyObj);
  }
};

/**
 * Reset the user identity (e.g. on logout).
 */
export const resetUser = () => {
  if (!AMPLITUDE_API_KEY) return;
  amplitude.reset();
};

/**
 * Track an event in Amplitude.
 * 
 * @param eventName - The name of the event to track
 * @param eventProperties - Optional properties to attach to the event
 */
export const trackEvent = (eventName: EventName, eventProperties?: Record<string, any>) => {
  if (!AMPLITUDE_API_KEY) {
    // Optionally log to console in dev mode
    if (import.meta.env.DEV) {
      console.log(`[Amplitude Mock] ${eventName}`, eventProperties || '');
    }
    return;
  }
  
  amplitude.track(eventName, eventProperties);
};
