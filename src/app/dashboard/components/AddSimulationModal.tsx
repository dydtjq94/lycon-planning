"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Copy,
  ChevronLeft,
  Star,
  Landmark,
  Home,
  Briefcase,
  GraduationCap,
  Plane,
  Heart,
  Wallet,
  PiggyBank,
  Shield,
  Umbrella,
  Baby,
  Car,
  Gem,
  Building2,
  Palmtree,
  Rocket,
  Coffee,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import type { Simulation } from "@/types";
import styles from "./AddSimulationModal.module.css";

const SIM_ICON_MAP: Record<string, LucideIcon> = {
  landmark: Landmark,
  home: Home,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  plane: Plane,
  heart: Heart,
  baby: Baby,
  "trending-up": TrendingUp,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  target: Target,
  umbrella: Umbrella,
  car: Car,
  gem: Gem,
  building: Building2,
  palmtree: Palmtree,
  rocket: Rocket,
  star: Star,
  coffee: Coffee,
  shield: Shield,
};

function getSimIcon(iconId?: string): LucideIcon {
  return (iconId && SIM_ICON_MAP[iconId]) || Star;
}

interface AddSimulationModalProps {
  triggerRect: { top: number; left: number; bottom: number; width: number };
  simulations: Simulation[];
  onCreateNew: () => void;
  onCopyFrom: (sourceSimulationId: string) => void;
  onClose: () => void;
}

export function AddSimulationModal({
  triggerRect,
  simulations,
  onCreateNew,
  onCopyFrom,
  onClose,
}: AddSimulationModalProps) {
  const { isDark } = useChartTheme();
  const [showSimList, setShowSimList] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const modalLeft = Math.max(16, triggerRect.left);
  const modalTop = triggerRect.bottom + 6;

  const handleCreateNew = () => {
    onCreateNew();
    onClose();
  };

  const handleCopyFrom = (simId: string) => {
    onCopyFrom(simId);
    onClose();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />

      <div
        ref={modalRef}
        className={styles.modal}
        style={{
          top: modalTop,
          left: modalLeft,
          background: isDark
            ? "rgba(34, 37, 41, 0.6)"
            : "rgba(255, 255, 255, 0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
        }}
      >
        <div className={styles.content}>
          {!showSimList ? (
            <>
              <button className={styles.optionCard} onClick={handleCreateNew}>
                <div className={styles.optionIcon}>
                  <Plus size={18} />
                </div>
                <div className={styles.optionText}>
                  <span className={styles.optionTitle}>새 시뮬레이션</span>
                  <span className={styles.optionDesc}>
                    빈 시뮬레이션을 새로 만듭니다
                  </span>
                </div>
              </button>

              <button
                className={styles.optionCard}
                onClick={() => setShowSimList(true)}
                disabled={simulations.length === 0}
              >
                <div className={styles.optionIcon}>
                  <Copy size={18} />
                </div>
                <div className={styles.optionText}>
                  <span className={styles.optionTitle}>
                    기존 시뮬레이션 복사
                  </span>
                  <span className={styles.optionDesc}>
                    기존 데이터를 복사하여 만듭니다
                  </span>
                </div>
              </button>
            </>
          ) : (
            <>
              <div className={styles.simListHeader}>
                <button
                  className={styles.backBtn}
                  onClick={() => setShowSimList(false)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.simListTitle}>
                  복사할 시뮬레이션 선택
                </span>
              </div>
              <div className={styles.simList}>
                {simulations.map((sim) => {
                  const SimIcon = getSimIcon(sim.icon);
                  return (
                    <button
                      key={sim.id}
                      className={styles.simItem}
                      onClick={() => handleCopyFrom(sim.id)}
                    >
                      <SimIcon size={16} className={styles.simItemIcon} />
                      <span className={styles.simItemTitle}>{sim.title}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
