import React, { useState, useEffect } from "react";
import styles from "./RateAdjustModal.module.css";

/**
 * 상승률 일괄 조절 모달
 * 각 재무 카테고리의 상승률을 한 번에 조절할 수 있습니다.
 */
function RateAdjustModal({
  isOpen,
  onClose,
  incomes = [],
  expenses = [],
  savings = [],
  realEstates = [],
  assets = [],
  debts = [],
  pensions = [],
  onSave,
  globalSettings = {},
}) {
  // 현재 활성 탭
  const [activeTab, setActiveTab] = useState("income-expense");

  // 전체 적용 값들
  const [globalIncomeGrowthRate, setGlobalIncomeGrowthRate] = useState("");
  const [globalExpenseGrowthRate, setGlobalExpenseGrowthRate] = useState("");
  const [globalSavingInterestRate, setGlobalSavingInterestRate] = useState("");
  const [globalSavingGrowthRate, setGlobalSavingGrowthRate] = useState("");
  const [globalSavingIncomeRate, setGlobalSavingIncomeRate] = useState("");
  const [globalRealEstateGrowthRate, setGlobalRealEstateGrowthRate] =
    useState("");
  const [globalAssetGrowthRate, setGlobalAssetGrowthRate] = useState("");
  const [globalDebtInterestRate, setGlobalDebtInterestRate] = useState("");
  // 연금용
  const [globalPensionInflationRate, setGlobalPensionInflationRate] =
    useState(""); // 국민연금 물가상승률
  const [globalPensionReturnRate, setGlobalPensionReturnRate] = useState(""); // 퇴직/개인연금 수익률

  // 개별 상승률 (id -> rate)
  const [incomeRates, setIncomeRates] = useState({});
  const [expenseRates, setExpenseRates] = useState({});
  const [savingInterestRates, setSavingInterestRates] = useState({});
  const [savingGrowthRates, setSavingGrowthRates] = useState({});
  const [savingIncomeRates, setSavingIncomeRates] = useState({});
  const [realEstateRates, setRealEstateRates] = useState({});
  const [assetRates, setAssetRates] = useState({});
  const [debtRates, setDebtRates] = useState({});
  // 연금용 (국민연금: inflationRate, 퇴직/개인/퇴직금: returnRate)
  const [pensionInflationRates, setPensionInflationRates] = useState({}); // 국민연금용
  const [pensionReturnRates, setPensionReturnRates] = useState({}); // 퇴직/개인/퇴직금용

  const [isSaving, setIsSaving] = useState(false);

  // 모달 열릴 때 현재 데이터로 초기화
  useEffect(() => {
    if (isOpen) {
      // 소득
      const incRates = {};
      incomes.forEach((item) => {
        incRates[item.id] = item.growthRate ?? "";
      });
      setIncomeRates(incRates);
      setGlobalIncomeGrowthRate(
        globalSettings.defaultIncomeGrowthRate || "3.3"
      );

      // 지출
      const expRates = {};
      expenses.forEach((item) => {
        expRates[item.id] = item.growthRate ?? "";
      });
      setExpenseRates(expRates);
      setGlobalExpenseGrowthRate(globalSettings.defaultInflationRate || "1.89");

      // 저축/투자 (소수점 -> 퍼센트 변환)
      const savIntRates = {};
      const savGrowthRates = {};
      const savIncRates = {};
      savings.forEach((item) => {
        // 저장된 값이 소수점 형태(0.05)이므로 퍼센트(5)로 변환
        savIntRates[item.id] =
          item.interestRate != null ? (item.interestRate * 100).toFixed(2) : "";
        savGrowthRates[item.id] =
          item.yearlyGrowthRate != null
            ? (item.yearlyGrowthRate * 100).toFixed(2)
            : "";
        savIncRates[item.id] =
          item.incomeRate != null ? (item.incomeRate * 100).toFixed(2) : "";
      });
      setSavingInterestRates(savIntRates);
      setSavingGrowthRates(savGrowthRates);
      setSavingIncomeRates(savIncRates);
      setGlobalSavingInterestRate(
        globalSettings.defaultInvestmentReturnRate || "2.86"
      );
      setGlobalSavingGrowthRate(
        globalSettings.defaultSavingGrowthRate || "1.89"
      );
      setGlobalSavingIncomeRate(globalSettings.defaultIncomeRate || "3");

      // 부동산
      const reRates = {};
      realEstates.forEach((item) => {
        reRates[item.id] = item.growthRate ?? "";
      });
      setRealEstateRates(reRates);
      setGlobalRealEstateGrowthRate(
        globalSettings.defaultRealEstateGrowthRate || "2.4"
      );

      // 자산 (소수점 -> 퍼센트 변환)
      const asRates = {};
      assets.forEach((item) => {
        asRates[item.id] =
          item.growthRate != null ? (item.growthRate * 100).toFixed(2) : "";
      });
      setAssetRates(asRates);
      setGlobalAssetGrowthRate(globalSettings.defaultAssetGrowthRate || "2.86");

      // 부채 (소수점 -> 퍼센트 변환)
      const deRates = {};
      debts.forEach((item) => {
        deRates[item.id] =
          item.interestRate != null ? (item.interestRate * 100).toFixed(2) : "";
      });
      setDebtRates(deRates);
      setGlobalDebtInterestRate(
        globalSettings.defaultDebtInterestRate || "3.5"
      );

      // 연금 (타입별로 다른 rate 사용)
      // 국민연금: inflationRate (퍼센트로 저장됨)
      // 퇴직/개인/퇴직금: returnRate (퍼센트로 저장됨)
      const penInflRates = {};
      const penRetRates = {};
      pensions.forEach((item) => {
        if (item.type === "national") {
          penInflRates[item.id] =
            item.inflationRate != null ? item.inflationRate : "";
        } else {
          // retirement, personal, severance
          penRetRates[item.id] = item.returnRate != null ? item.returnRate : "";
        }
      });
      setPensionInflationRates(penInflRates);
      setPensionReturnRates(penRetRates);
      setGlobalPensionInflationRate(
        globalSettings.defaultInflationRate || "1.89"
      );
      setGlobalPensionReturnRate(
        globalSettings.defaultInvestmentReturnRate || "2.86"
      );
    }
  }, [
    isOpen,
    incomes,
    expenses,
    savings,
    realEstates,
    assets,
    debts,
    pensions,
    globalSettings,
  ]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // 모달 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // 숫자 입력 검증
  const isValidNumber = (value) => value === "" || /^-?\d*\.?\d*$/.test(value);

  // 전체 적용 핸들러들
  const applyGlobalIncomeRate = () => {
    if (globalIncomeGrowthRate === "") return;
    const newRates = {};
    incomes.forEach((item) => {
      newRates[item.id] = globalIncomeGrowthRate;
    });
    setIncomeRates(newRates);
  };

  const applyGlobalExpenseRate = () => {
    if (globalExpenseGrowthRate === "") return;
    const newRates = {};
    expenses.forEach((item) => {
      newRates[item.id] = globalExpenseGrowthRate;
    });
    setExpenseRates(newRates);
  };

  const applyGlobalSavingInterestRate = () => {
    if (globalSavingInterestRate === "") return;
    const newRates = {};
    savings.forEach((item) => {
      newRates[item.id] = globalSavingInterestRate;
    });
    setSavingInterestRates(newRates);
  };

  const applyGlobalSavingGrowthRate = () => {
    if (globalSavingGrowthRate === "") return;
    const newRates = {};
    savings.forEach((item) => {
      newRates[item.id] = globalSavingGrowthRate;
    });
    setSavingGrowthRates(newRates);
  };

  const applyGlobalSavingIncomeRate = () => {
    if (globalSavingIncomeRate === "") return;
    const newRates = {};
    savings.forEach((item) => {
      newRates[item.id] = globalSavingIncomeRate;
    });
    setSavingIncomeRates(newRates);
  };

  const applyGlobalRealEstateRate = () => {
    if (globalRealEstateGrowthRate === "") return;
    const newRates = {};
    realEstates.forEach((item) => {
      newRates[item.id] = globalRealEstateGrowthRate;
    });
    setRealEstateRates(newRates);
  };

  const applyGlobalAssetRate = () => {
    if (globalAssetGrowthRate === "") return;
    const newRates = {};
    assets.forEach((item) => {
      newRates[item.id] = globalAssetGrowthRate;
    });
    setAssetRates(newRates);
  };

  const applyGlobalDebtRate = () => {
    if (globalDebtInterestRate === "") return;
    const newRates = {};
    debts.forEach((item) => {
      newRates[item.id] = globalDebtInterestRate;
    });
    setDebtRates(newRates);
  };

  // 연금 - 국민연금 물가상승률 전체 적용
  const applyGlobalPensionInflationRate = () => {
    if (globalPensionInflationRate === "") return;
    const newRates = {};
    pensions.forEach((item) => {
      if (item.type === "national") {
        newRates[item.id] = globalPensionInflationRate;
      }
    });
    setPensionInflationRates(newRates);
  };

  // 연금 - 퇴직/개인/퇴직금 수익률 전체 적용
  const applyGlobalPensionReturnRate = () => {
    if (globalPensionReturnRate === "") return;
    const newRates = {};
    pensions.forEach((item) => {
      if (item.type !== "national") {
        newRates[item.id] = globalPensionReturnRate;
      }
    });
    setPensionReturnRates(newRates);
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedIncomes = incomes.map((item) => ({
        ...item,
        growthRate: incomeRates[item.id] ?? item.growthRate,
      }));

      const updatedExpenses = expenses.map((item) => ({
        ...item,
        growthRate: expenseRates[item.id] ?? item.growthRate,
      }));

      // 저축/투자: 퍼센트 -> 소수점 변환하여 저장
      const updatedSavings = savings.map((item) => {
        const intRate = savingInterestRates[item.id];
        const growthRate = savingGrowthRates[item.id];
        const incRate = savingIncomeRates[item.id];
        return {
          ...item,
          interestRate:
            intRate != null && intRate !== ""
              ? parseFloat(intRate) / 100
              : item.interestRate,
          yearlyGrowthRate:
            growthRate != null && growthRate !== ""
              ? parseFloat(growthRate) / 100
              : item.yearlyGrowthRate,
          incomeRate:
            incRate != null && incRate !== ""
              ? parseFloat(incRate) / 100
              : item.incomeRate,
        };
      });

      const updatedRealEstates = realEstates.map((item) => ({
        ...item,
        growthRate: realEstateRates[item.id] ?? item.growthRate,
      }));

      // 자산: 퍼센트 -> 소수점 변환하여 저장
      const updatedAssets = assets.map((item) => {
        const rate = assetRates[item.id];
        return {
          ...item,
          growthRate:
            rate != null && rate !== ""
              ? parseFloat(rate) / 100
              : item.growthRate,
        };
      });

      // 부채: 퍼센트 -> 소수점 변환하여 저장
      const updatedDebts = debts.map((item) => {
        const rate = debtRates[item.id];
        return {
          ...item,
          interestRate:
            rate != null && rate !== ""
              ? parseFloat(rate) / 100
              : item.interestRate,
        };
      });

      // 연금: 타입별로 다른 rate 사용 (퍼센트 그대로 저장)
      const updatedPensions = pensions.map((item) => {
        if (item.type === "national") {
          const rate = pensionInflationRates[item.id];
          return {
            ...item,
            inflationRate:
              rate != null && rate !== ""
                ? parseFloat(rate)
                : item.inflationRate,
          };
        } else {
          // retirement, personal, severance
          const rate = pensionReturnRates[item.id];
          return {
            ...item,
            returnRate:
              rate != null && rate !== "" ? parseFloat(rate) : item.returnRate,
          };
        }
      });

      await onSave({
        incomes: updatedIncomes,
        expenses: updatedExpenses,
        savings: updatedSavings,
        realEstates: updatedRealEstates,
        assets: updatedAssets,
        debts: updatedDebts,
        pensions: updatedPensions,
      });
      onClose();
    } catch (error) {
      console.error("상승률 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: "income-expense", label: "소득 / 지출" },
    { id: "saving", label: "저축 / 투자" },
    { id: "pension", label: "연금" },
    { id: "realestate-asset", label: "부동산 / 자산" },
    { id: "debt", label: "부채" },
  ];

  // 연금 타입별 라벨
  const getPensionTypeLabel = (type) => {
    switch (type) {
      case "national":
        return "국민연금";
      case "retirement":
        return "퇴직연금";
      case "personal":
        return "개인연금";
      case "severance":
        return "퇴직금/DB";
      default:
        return "연금";
    }
  };

  // 단일 필드 카드 렌더링 (소득, 지출, 부동산, 자산, 부채, 국민연금)
  const renderSingleFieldCard = (item, rate, setRate, label, placeholder, subtitle = null) => (
    <div key={item.id} className={styles.itemCard}>
      <div className={styles.itemCardTitle}>
        {item.title}
        {subtitle && <span className={styles.itemCardSubtitle}>({subtitle})</span>}
      </div>
      <div className={styles.itemCardFields}>
        <div className={styles.itemCardField}>
          <label>{label}</label>
          <input
            type="text"
            value={rate ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (isValidNumber(value)) {
                setRate(value);
              }
            }}
            placeholder={placeholder}
          />
        </div>
      </div>
    </div>
  );

  // 다중 필드 카드 렌더링 (저축/투자)
  const renderMultiFieldCard = (item, fields) => (
    <div key={item.id} className={styles.itemCard}>
      <div className={styles.itemCardTitle}>{item.title}</div>
      <div className={styles.itemCardFieldsRow}>
        {fields.map((field, idx) => (
          <div key={idx} className={styles.itemCardField}>
            <label>{field.label}</label>
            <input
              type="text"
              value={field.value ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (isValidNumber(value)) {
                  field.onChange(value);
                }
              }}
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );

  // 전체 적용 행 렌더링 헬퍼
  const renderGlobalRow = (label, value, setValue, onApply, placeholder) => (
    <div className={styles.globalRow}>
      <div className={styles.globalField}>
        <label>전체 - {label}</label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              if (isValidNumber(val)) {
                setValue(val);
              }
            }}
            placeholder={placeholder}
          />
          <button
            className={styles.applyButton}
            onClick={onApply}
            disabled={value === ""}
          >
            전체 적용
          </button>
        </div>
      </div>
    </div>
  );

  // 3열 전체 적용 행 렌더링 (저축/투자용)
  const renderGlobalRowTriple = (fields) => (
    <div className={styles.globalRowTriple}>
      {fields.map((field, idx) => (
        <div key={idx} className={styles.globalFieldCompact}>
          <label>전체 - {field.label}</label>
          <div className={styles.inputWithButton}>
            <input
              type="text"
              value={field.value}
              onChange={(e) => {
                const val = e.target.value;
                if (isValidNumber(val)) {
                  field.setValue(val);
                }
              }}
              placeholder={field.placeholder}
            />
            <button
              className={styles.applyButton}
              onClick={field.onApply}
              disabled={field.value === ""}
            >
              적용
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>상승률 일괄 조절</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className={styles.tabNav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${
                activeTab === tab.id ? styles.tabButtonActive : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.modalBody}>
          {/* 소득/지출 탭 */}
          {activeTab === "income-expense" && (
            <>
              {/* 소득 섹션 */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>소득</h4>
                {renderGlobalRow(
                  "소득 상승률 (%)",
                  globalIncomeGrowthRate,
                  setGlobalIncomeGrowthRate,
                  applyGlobalIncomeRate,
                  "3.3"
                )}
                {incomes.length > 0 ? (
                  <div className={styles.itemsGrid}>
                    {incomes.map((item) =>
                      renderSingleFieldCard(
                        item,
                        incomeRates[item.id],
                        (val) =>
                          setIncomeRates({ ...incomeRates, [item.id]: val }),
                        "상승률 (%)",
                        "3.3"
                      )
                    )}
                  </div>
                ) : (
                  <p className={styles.emptyText}>등록된 소득이 없습니다.</p>
                )}
              </div>

              {/* 지출 섹션 */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>지출</h4>
                {renderGlobalRow(
                  "물가 상승률 (%)",
                  globalExpenseGrowthRate,
                  setGlobalExpenseGrowthRate,
                  applyGlobalExpenseRate,
                  "1.89"
                )}
                {expenses.length > 0 ? (
                  <div className={styles.itemsGrid}>
                    {expenses.map((item) =>
                      renderSingleFieldCard(
                        item,
                        expenseRates[item.id],
                        (val) =>
                          setExpenseRates({ ...expenseRates, [item.id]: val }),
                        "상승률 (%)",
                        "1.89"
                      )
                    )}
                  </div>
                ) : (
                  <p className={styles.emptyText}>등록된 지출이 없습니다.</p>
                )}
              </div>
            </>
          )}

          {/* 저축/투자 탭 */}
          {activeTab === "saving" && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>저축 / 투자</h4>

              {/* 3열로 전체 적용 표시 */}
              {renderGlobalRowTriple([
                {
                  label: "수익률 (%)",
                  value: globalSavingInterestRate,
                  setValue: setGlobalSavingInterestRate,
                  onApply: applyGlobalSavingInterestRate,
                  placeholder: "2.86",
                },
                {
                  label: "증가율 (%)",
                  value: globalSavingGrowthRate,
                  setValue: setGlobalSavingGrowthRate,
                  onApply: applyGlobalSavingGrowthRate,
                  placeholder: "1.89",
                },
                {
                  label: "배당/이자 (%)",
                  value: globalSavingIncomeRate,
                  setValue: setGlobalSavingIncomeRate,
                  onApply: applyGlobalSavingIncomeRate,
                  placeholder: "3",
                },
              ])}

              {savings.length > 0 ? (
                <div className={styles.itemsGrid}>
                  {savings.map((item) =>
                    renderMultiFieldCard(item, [
                      {
                        label: "수익률 (%)",
                        value: savingInterestRates[item.id],
                        onChange: (val) =>
                          setSavingInterestRates({
                            ...savingInterestRates,
                            [item.id]: val,
                          }),
                        placeholder: "2.86",
                      },
                      {
                        label: "증가율 (%)",
                        value: savingGrowthRates[item.id],
                        onChange: (val) =>
                          setSavingGrowthRates({
                            ...savingGrowthRates,
                            [item.id]: val,
                          }),
                        placeholder: "1.89",
                      },
                      {
                        label: "배당 (%)",
                        value: savingIncomeRates[item.id],
                        onChange: (val) =>
                          setSavingIncomeRates({
                            ...savingIncomeRates,
                            [item.id]: val,
                          }),
                        placeholder: "3",
                      },
                    ])
                  )}
                </div>
              ) : (
                <p className={styles.emptyText}>등록된 저축/투자가 없습니다.</p>
              )}
            </div>
          )}

          {/* 부동산/자산 탭 */}
          {activeTab === "realestate-asset" && (
            <>
              {/* 부동산 섹션 */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>부동산</h4>
                {renderGlobalRow(
                  "부동산 가치 상승률 (%)",
                  globalRealEstateGrowthRate,
                  setGlobalRealEstateGrowthRate,
                  applyGlobalRealEstateRate,
                  "2.4"
                )}
                {realEstates.length > 0 ? (
                  <div className={styles.itemsGrid}>
                    {realEstates.map((item) =>
                      renderSingleFieldCard(
                        item,
                        realEstateRates[item.id],
                        (val) =>
                          setRealEstateRates({
                            ...realEstateRates,
                            [item.id]: val,
                          }),
                        "상승률 (%)",
                        "2.4"
                      )
                    )}
                  </div>
                ) : (
                  <p className={styles.emptyText}>등록된 부동산이 없습니다.</p>
                )}
              </div>

              {/* 자산 섹션 */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>자산</h4>
                {renderGlobalRow(
                  "자산 가치 상승률 (%)",
                  globalAssetGrowthRate,
                  setGlobalAssetGrowthRate,
                  applyGlobalAssetRate,
                  "2.86"
                )}
                {assets.length > 0 ? (
                  <div className={styles.itemsGrid}>
                    {assets.map((item) =>
                      renderSingleFieldCard(
                        item,
                        assetRates[item.id],
                        (val) =>
                          setAssetRates({ ...assetRates, [item.id]: val }),
                        "상승률 (%)",
                        "2.86"
                      )
                    )}
                  </div>
                ) : (
                  <p className={styles.emptyText}>등록된 자산이 없습니다.</p>
                )}
              </div>
            </>
          )}

          {/* 부채 탭 */}
          {activeTab === "debt" && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>부채</h4>
              {renderGlobalRow(
                "부채 이자율 (%)",
                globalDebtInterestRate,
                setGlobalDebtInterestRate,
                applyGlobalDebtRate,
                "3.5"
              )}
              {debts.length > 0 ? (
                <div className={styles.itemsGrid}>
                  {debts.map((item) =>
                    renderSingleFieldCard(
                      item,
                      debtRates[item.id],
                      (val) => setDebtRates({ ...debtRates, [item.id]: val }),
                      "이자율 (%)",
                      "3.5"
                    )
                  )}
                </div>
              ) : (
                <p className={styles.emptyText}>등록된 부채가 없습니다.</p>
              )}
            </div>
          )}

          {/* 연금 탭 */}
          {activeTab === "pension" && (
            <>
              {/* 국민연금 섹션 */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>국민연금</h4>
                {renderGlobalRow(
                  "물가 상승률 (%)",
                  globalPensionInflationRate,
                  setGlobalPensionInflationRate,
                  applyGlobalPensionInflationRate,
                  "1.89"
                )}
                {pensions.filter((p) => p.type === "national").length > 0 ? (
                  <div className={styles.itemsGrid}>
                    {pensions
                      .filter((p) => p.type === "national")
                      .map((item) =>
                        renderSingleFieldCard(
                          item,
                          pensionInflationRates[item.id],
                          (val) =>
                            setPensionInflationRates({
                              ...pensionInflationRates,
                              [item.id]: val,
                            }),
                          "상승률 (%)",
                          "1.89"
                        )
                      )}
                  </div>
                ) : (
                  <p className={styles.emptyText}>
                    등록된 국민연금이 없습니다.
                  </p>
                )}
              </div>

              {/* 퇴직/개인연금 섹션 */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  퇴직연금 / 개인연금 / 퇴직금
                </h4>
                {renderGlobalRow(
                  "연평균 수익률 (%)",
                  globalPensionReturnRate,
                  setGlobalPensionReturnRate,
                  applyGlobalPensionReturnRate,
                  "2.86"
                )}
                {pensions.filter((p) => p.type !== "national").length > 0 ? (
                  <div className={styles.itemsGrid}>
                    {pensions
                      .filter((p) => p.type !== "national")
                      .map((item) =>
                        renderSingleFieldCard(
                          item,
                          pensionReturnRates[item.id],
                          (val) =>
                            setPensionReturnRates({
                              ...pensionReturnRates,
                              [item.id]: val,
                            }),
                          "수익률 (%)",
                          "2.86",
                          getPensionTypeLabel(item.type)
                        )
                      )}
                  </div>
                ) : (
                  <p className={styles.emptyText}>
                    등록된 퇴직/개인연금이 없습니다.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            취소
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RateAdjustModal;
