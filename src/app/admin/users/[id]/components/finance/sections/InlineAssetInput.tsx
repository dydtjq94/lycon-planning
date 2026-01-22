"use client";

import { useState, useRef, useEffect } from "react";
import { X, Check } from "lucide-react";
import styles from "./InlineAssetInput.module.css";

// 부동산
interface RealEstateInputProps {
  onSave: (data: { type: string; title: string; value: number; loan: number; owner: string }) => void;
  onCancel: () => void;
  defaultType: "residence" | "investment";
}

export function RealEstateInput({ onSave, onCancel, defaultType }: RealEstateInputProps) {
  const [type, setType] = useState<string>(defaultType);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState<number>(0);
  const [loan, setLoan] = useState<number>(0);
  const [owner, setOwner] = useState("self");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!title.trim() || value <= 0) return;
    onSave({ type, title: title.trim(), value, loan, owner });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  // 거주용은 타입 선택 없이 residence 고정, 투자용은 investment/rental/land 선택 가능
  const showTypeSelect = defaultType === "investment";

  return (
    <div className={styles.inputRow} onKeyDown={handleKeyDown}>
      {showTypeSelect && (
        <select value={type} onChange={(e) => setType(e.target.value)} className={styles.typeSelect}>
          <option value="investment">투자</option>
          <option value="rental">임대</option>
          <option value="land">토지</option>
        </select>
      )}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="명칭"
        className={styles.titleInput}
      />
      <div className={styles.valueGroup}>
        <input
          type="number"
          value={value || ""}
          onChange={(e) => setValue(Number(e.target.value))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          placeholder="시세"
          className={styles.valueInput}
        />
        <span className={styles.unit}>만원</span>
      </div>
      <div className={styles.valueGroup}>
        <input
          type="number"
          value={loan || ""}
          onChange={(e) => setLoan(Number(e.target.value))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          placeholder="대출"
          className={styles.valueInput}
        />
        <span className={styles.unit}>만원</span>
      </div>
      <select value={owner} onChange={(e) => setOwner(e.target.value)} className={styles.ownerSelect}>
        <option value="self">본인</option>
        <option value="spouse">배우자</option>
        <option value="joint">공동</option>
      </select>
      <div className={styles.actions}>
        <button type="button" onClick={handleSave} className={styles.saveBtn} title="저장">
          <Check size={16} />
        </button>
        <button type="button" onClick={onCancel} className={styles.cancelBtn} title="취소">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// 금융자산 (저축 / 투자)
interface SavingsInputProps {
  onSave: (data: { type: string; title: string; balance: number; owner: string }) => void;
  onCancel: () => void;
  category: "savings" | "investment";
}

export function SavingsInput({ onSave, onCancel, category }: SavingsInputProps) {
  const defaultType = category === "savings" ? "savings" : "domestic_stock";
  const [type, setType] = useState(defaultType);
  const [title, setTitle] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [owner, setOwner] = useState("self");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!title.trim() || balance <= 0) return;
    onSave({ type, title: title.trim(), balance, owner });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className={styles.inputRow} onKeyDown={handleKeyDown}>
      <select value={type} onChange={(e) => setType(e.target.value)} className={styles.typeSelect}>
        {category === "savings" ? (
          <>
            <option value="checking">입출금</option>
            <option value="savings">적금</option>
            <option value="deposit">예금</option>
          </>
        ) : (
          <>
            <option value="domestic_stock">국내주식</option>
            <option value="foreign_stock">해외주식</option>
            <option value="fund">펀드</option>
            <option value="bond">채권</option>
            <option value="crypto">암호화폐</option>
            <option value="other">기타</option>
          </>
        )}
      </select>
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="명칭"
        className={styles.titleInput}
      />
      <div className={styles.valueGroup}>
        <input
          type="number"
          value={balance || ""}
          onChange={(e) => setBalance(Number(e.target.value))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          placeholder="잔액"
          className={styles.valueInput}
        />
        <span className={styles.unit}>만원</span>
      </div>
      <select value={owner} onChange={(e) => setOwner(e.target.value)} className={styles.ownerSelect}>
        <option value="self">본인</option>
        <option value="spouse">배우자</option>
      </select>
      <div className={styles.actions}>
        <button type="button" onClick={handleSave} className={styles.saveBtn} title="저장">
          <Check size={16} />
        </button>
        <button type="button" onClick={onCancel} className={styles.cancelBtn} title="취소">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// 연금
interface PensionInputProps {
  onSave: (data: {
    category: "national" | "retirement" | "personal";
    type: string;
    amount: number;
    owner: string;
    startAge?: number;
  }) => void;
  onCancel: () => void;
}

export function PensionInput({ onSave, onCancel }: PensionInputProps) {
  const [category, setCategory] = useState<"national" | "retirement" | "personal">("national");
  const [type, setType] = useState("national");
  const [amount, setAmount] = useState<number>(0);
  const [startAge, setStartAge] = useState<number>(65);
  const [owner, setOwner] = useState("self");

  const handleCategoryChange = (cat: "national" | "retirement" | "personal") => {
    setCategory(cat);
    if (cat === "national") setType("national");
    else if (cat === "retirement") setType("severance");
    else setType("pension_savings");
  };

  const handleSave = () => {
    if (amount <= 0) return;
    onSave({ category, type, amount, owner, startAge: category === "national" ? startAge : undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className={styles.inputRow} onKeyDown={handleKeyDown}>
      <select
        value={category}
        onChange={(e) => handleCategoryChange(e.target.value as "national" | "retirement" | "personal")}
        className={styles.typeSelect}
      >
        <option value="national">공적연금</option>
        <option value="retirement">퇴직연금</option>
        <option value="personal">개인연금</option>
      </select>

      {category === "national" && (
        <select value={type} onChange={(e) => setType(e.target.value)} className={styles.subTypeSelect}>
          <option value="national">국민연금</option>
          <option value="government">공무원연금</option>
          <option value="military">군인연금</option>
          <option value="private_school">사학연금</option>
        </select>
      )}
      {category === "retirement" && (
        <select value={type} onChange={(e) => setType(e.target.value)} className={styles.subTypeSelect}>
          <option value="severance">퇴직금</option>
          <option value="db">DB형</option>
          <option value="dc">DC형</option>
          <option value="corporate_irp">기업IRP</option>
        </select>
      )}
      {category === "personal" && (
        <select value={type} onChange={(e) => setType(e.target.value)} className={styles.subTypeSelect}>
          <option value="pension_savings">연금저축</option>
          <option value="irp">개인IRP</option>
          <option value="isa">ISA</option>
        </select>
      )}

      <div className={styles.valueGroup}>
        <input
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          placeholder={category === "national" ? "월 수령액" : "잔액"}
          className={styles.valueInput}
        />
        <span className={styles.unit}>{category === "national" ? "만원/월" : "만원"}</span>
      </div>

      {category === "national" && (
        <div className={styles.valueGroup}>
          <input
            type="number"
            value={startAge}
            onChange={(e) => setStartAge(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLElement).blur()}
            min={60}
            max={70}
            className={styles.ageInput}
          />
          <span className={styles.unit}>세부터</span>
        </div>
      )}

      <select value={owner} onChange={(e) => setOwner(e.target.value)} className={styles.ownerSelect}>
        <option value="self">본인</option>
        <option value="spouse">배우자</option>
      </select>
      <div className={styles.actions}>
        <button type="button" onClick={handleSave} className={styles.saveBtn} title="저장">
          <Check size={16} />
        </button>
        <button type="button" onClick={onCancel} className={styles.cancelBtn} title="취소">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// 부채
interface DebtInputProps {
  onSave: (data: { type: string; title: string; balance: number; rate: number }) => void;
  onCancel: () => void;
}

export function DebtInput({ onSave, onCancel }: DebtInputProps) {
  const [type, setType] = useState("mortgage");
  const [title, setTitle] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!title.trim() || balance <= 0) return;
    onSave({ type, title: title.trim(), balance, rate });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className={styles.inputRow} onKeyDown={handleKeyDown}>
      <select value={type} onChange={(e) => setType(e.target.value)} className={styles.typeSelect}>
        <option value="mortgage">주택담보</option>
        <option value="jeonse">전세자금</option>
        <option value="credit">신용대출</option>
        <option value="car">자동차</option>
        <option value="student">학자금</option>
        <option value="card">카드</option>
        <option value="other">기타</option>
      </select>
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="명칭"
        className={styles.titleInput}
      />
      <div className={styles.valueGroup}>
        <input
          type="number"
          value={balance || ""}
          onChange={(e) => setBalance(Number(e.target.value))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          placeholder="잔액"
          className={styles.valueInput}
        />
        <span className={styles.unit}>만원</span>
      </div>
      <div className={styles.valueGroup}>
        <input
          type="number"
          value={rate || ""}
          onChange={(e) => setRate(Number(e.target.value))}
          onWheel={(e) => (e.target as HTMLElement).blur()}
          placeholder="금리"
          className={styles.rateInput}
          step="0.1"
        />
        <span className={styles.unit}>%</span>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={handleSave} className={styles.saveBtn} title="저장">
          <Check size={16} />
        </button>
        <button type="button" onClick={onCancel} className={styles.cancelBtn} title="취소">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
