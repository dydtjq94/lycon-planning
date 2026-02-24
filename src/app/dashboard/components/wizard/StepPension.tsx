"use client";

import type { StepProps } from "./types";

export function StepPension({ data, onChange }: StepProps) {
  return (
    <div>
      <p style={{ color: "var(--dashboard-text-muted)", textAlign: "center", padding: "40px 0" }}>
        연금 설정 (준비중)
      </p>
    </div>
  );
}
