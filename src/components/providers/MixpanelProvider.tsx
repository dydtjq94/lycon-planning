"use client";

import { initMixpanel } from "@/lib/analytics/mixpanel";

// 모듈 로드 시 즉시 초기화 (자식 useEffect보다 먼저 실행되도록)
if (typeof window !== "undefined") {
  initMixpanel();
}

export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
