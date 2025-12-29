/**
 * Mixpanel 분석 라이브러리
 * 사용자 이벤트 추적 및 분석을 위한 유틸리티
 */

import mixpanel from "mixpanel-browser";

// 환경 변수에서 Mixpanel 토큰 가져오기
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

// Mixpanel 초기화
if (MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: true,
    record_sessions_percent: 100,
  });
} else {
  console.warn(
    "Mixpanel token이 설정되지 않았습니다. .env.local 파일에 VITE_MIXPANEL_TOKEN을 추가해주세요."
  );
}

/**
 * 이벤트 트래킹
 * @param {string} eventName - 이벤트 이름
 * @param {Object} properties - 이벤트 속성 (선택사항)
 */
export const trackEvent = (eventName, properties = {}) => {
  if (!MIXPANEL_TOKEN) return;

  try {
    mixpanel.track(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Mixpanel 트래킹 오류:", error);
  }
};

/**
 * 사용자 식별 설정
 * @param {string} userId - 사용자 ID
 */
export const identifyUser = (userId) => {
  if (!MIXPANEL_TOKEN) return;

  try {
    mixpanel.identify(userId);
  } catch (error) {
    console.error("Mixpanel 사용자 식별 오류:", error);
  }
};

/**
 * 사용자 속성 설정
 * @param {Object} properties - 사용자 속성
 */
export const setUserProperties = (properties) => {
  if (!MIXPANEL_TOKEN) return;

  try {
    mixpanel.people.set(properties);
  } catch (error) {
    console.error("Mixpanel 사용자 속성 설정 오류:", error);
  }
};

/**
 * 페이지 뷰 트래킹
 * @param {string} pageName - 페이지 이름
 * @param {Object} additionalProperties - 추가 속성 (선택사항)
 */
export const trackPageView = (pageName, additionalProperties = {}) => {
  trackEvent("페이지 뷰", {
    page: pageName,
    ...additionalProperties,
  });
};

export default mixpanel;
