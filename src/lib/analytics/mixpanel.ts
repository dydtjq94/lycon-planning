import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "";

let initialized = false;

export function initMixpanel() {
  if (initialized || typeof window === "undefined") return;
  if (!MIXPANEL_TOKEN) {
    console.warn("[Mixpanel] Token not found");
    return;
  }

  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: false,
  });

  initialized = true;
}

// 사용자 식별
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.identify(userId);
  if (properties) {
    mixpanel.people.set(properties);
  }
}

// 사용자 속성 설정
export function setUserProperties(properties: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.people.set(properties);
}

// 이벤트 트래킹
export function track(eventName: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.track(eventName, properties);
}

// 로그아웃 시 리셋
export function resetUser() {
  if (!initialized) return;
  mixpanel.reset();
}

// ============================================
// 페이지뷰 이벤트
// ============================================

export function trackPageView(pageName: string, properties?: Record<string, unknown>) {
  track("Page Viewed", { page: pageName, ...properties });
}

// ============================================
// 온보딩 퍼널 이벤트
// ============================================

export const OnboardingEvents = {
  // 회원가입
  signUpStarted: () => track("Sign Up Started"),
  signUpCompleted: (userId: string) => {
    track("Sign Up Completed", { user_id: userId });
  },

  // 로그인
  loginCompleted: (userId: string) => {
    track("Login Completed", { user_id: userId });
  },

  // 온보딩 시작
  onboardingStarted: () => track("Onboarding Started"),

  // 온보딩 각 단계
  onboardingStepViewed: (step: number, stepName: string) => {
    track("Onboarding Step Viewed", { step, step_name: stepName });
  },

  onboardingStepCompleted: (step: number, stepName: string) => {
    track("Onboarding Step Completed", { step, step_name: stepName });
  },

  // 예약 완료 (최종 목표)
  bookingCompleted: (data: { date: string; time: string; expertName: string }) => {
    track("Booking Completed", {
      booking_date: data.date,
      booking_time: data.time,
      expert_name: data.expertName,
    });
  },
};
