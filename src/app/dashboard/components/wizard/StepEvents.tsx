"use client";

import type { StepProps } from "./types";

export function StepEvents({ data, onChange }: StepProps) {
  return (
    <div>
      <p style={{ color: "var(--dashboard-text-muted)", textAlign: "center", padding: "40px 0" }}>
        라이프 이벤트 설정 (준비중)
      </p>
    </div>
  );
}
