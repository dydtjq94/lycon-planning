import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import {
  createNationalPension,
  updateNationalPension,
} from "@/lib/services/nationalPensionService";
import type { NationalPension, Owner, PublicPensionType } from "@/types/tables";
import styles from "./Modal.module.css";

// 공적연금 유형
const PENSION_TYPES: { value: PublicPensionType; label: string }[] = [
  { value: "national", label: "국민연금" },
  { value: "government", label: "공무원연금" },
  { value: "military", label: "군인연금" },
  { value: "private_school", label: "사학연금" },
];

interface NationalPensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  simulationId: string;
  pension: NationalPension | null;
  defaultOwner: Owner;
  birthYear: number;
}

export function NationalPensionModal({
  isOpen,
  onClose,
  onSaved,
  simulationId,
  pension,
  defaultOwner,
  birthYear,
}: NationalPensionModalProps) {
  const [owner, setOwner] = useState<Owner>(defaultOwner);
  const [pensionType, setPensionType] = useState<PublicPensionType>("national");
  const [expectedMonthlyAmount, setExpectedMonthlyAmount] = useState<number>(0);
  const [startAge, setStartAge] = useState(65);
  const [endAge, setEndAge] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (pension) {
        setOwner(pension.owner);
        setPensionType(pension.pension_type || "national");
        setExpectedMonthlyAmount(pension.expected_monthly_amount);
        setStartAge(pension.start_age);
        setEndAge(pension.end_age);
        setMemo(pension.memo || "");
      } else {
        setOwner(defaultOwner);
        setPensionType("national");
        setExpectedMonthlyAmount(0);
        setStartAge(65);
        setEndAge(null);
        setMemo("");
      }
    }
  }, [isOpen, pension, defaultOwner]);

  const handleSave = async () => {
    if (!expectedMonthlyAmount || expectedMonthlyAmount <= 0) {
      alert("예상 수령액을 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const data = {
        pension_type: pensionType,
        expected_monthly_amount: expectedMonthlyAmount,
        start_age: startAge,
        end_age: endAge,
        memo: memo.trim() || null,
      };

      if (pension) {
        await updateNationalPension(pension.id, data, birthYear);
      } else {
        await createNationalPension(
          {
            simulation_id: simulationId,
            owner,
            ...data,
          },
          birthYear
        );
      }
      onSaved();
    } catch (error) {
      console.error("Failed to save public pension:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={pension ? "공적연금 수정" : "공적연금 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
      <FormRow>
        <FormField label="대상자" required>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as Owner)}
            className={styles.select}
            disabled={!!pension}
          >
            <option value="self">본인</option>
            <option value="spouse">배우자</option>
          </select>
        </FormField>
        <FormField label="연금 유형" required>
          <select
            value={pensionType}
            onChange={(e) => setPensionType(e.target.value as PublicPensionType)}
            className={styles.select}
          >
            {PENSION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </FormField>
      </FormRow>

      <FormField label="예상 월 수령액" required hint="해당 연금공단에서 예상연금 조회">
        <div className={styles.inputWithUnit}>
          <input
            type="number"
            value={expectedMonthlyAmount || ""}
            onChange={(e) => setExpectedMonthlyAmount(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLElement).blur()}
            placeholder="0"
            className={styles.input}
          />
          <span className={styles.unit}>만원/월</span>
        </div>
      </FormField>

      <FormRow>
        <FormField label="수령 시작 나이" required>
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={startAge}
              onChange={(e) => setStartAge(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={60}
              max={70}
              className={styles.input}
            />
            <span className={styles.unit}>세</span>
          </div>
        </FormField>
        <FormField label="수령 종료 나이" hint="비워두면 종신">
          <div className={styles.inputWithUnit}>
            <input
              type="number"
              value={endAge || ""}
              onChange={(e) => setEndAge(Number(e.target.value) || null)}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              min={startAge}
              max={100}
              placeholder="종신"
              className={styles.input}
            />
            <span className={styles.unit}>세</span>
          </div>
        </FormField>
      </FormRow>

      <FormField label="메모">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="추가 메모 (선택)"
          rows={2}
          className={styles.textarea}
        />
      </FormField>
    </BaseModal>
  );
}
