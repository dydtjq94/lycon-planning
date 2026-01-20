import { useState, useEffect } from "react";
import { BaseModal, FormField, FormRow } from "../shared";
import {
  createNationalPension,
  updateNationalPension,
} from "@/lib/services/nationalPensionService";
import type { NationalPension, Owner } from "@/types/tables";
import styles from "./Modal.module.css";

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
  const [expectedMonthlyAmount, setExpectedMonthlyAmount] = useState<number>(0);
  const [startAge, setStartAge] = useState(65);
  const [endAge, setEndAge] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (pension) {
        setOwner(pension.owner);
        setExpectedMonthlyAmount(pension.expected_monthly_amount);
        setStartAge(pension.start_age);
        setEndAge(pension.end_age);
        setMemo(pension.memo || "");
      } else {
        setOwner(defaultOwner);
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
      console.error("Failed to save national pension:", error);
      alert("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      title={pension ? "국민연금 수정" : "국민연금 추가"}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={saving ? "저장 중..." : "저장"}
      saveDisabled={saving}
    >
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

      <FormField label="예상 월 수령액" required hint="국민연금공단 예상연금조회 참고">
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
