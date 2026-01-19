"use client";

import { useEffect } from "react";
import { initMixpanel } from "@/lib/analytics/mixpanel";

export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initMixpanel();
  }, []);

  return <>{children}</>;
}
