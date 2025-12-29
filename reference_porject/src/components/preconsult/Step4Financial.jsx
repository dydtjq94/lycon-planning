import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { profileService } from "../../services/firestoreService";
import { formatAmount } from "../../utils/format";
import styles from "./Step.module.css";

/**
 * 4단계: 재무정보 입력
 * 소득, 지출, 자산, 부채 현황 파악
 */
function Step4Financial({ data, onChange, profileId, profileData }) {
  const navigate = useNavigate();
  const [financialData, setFinancialData] = useState({
    incomes: [],
    expenses: [],
    assets: [],
    debts: [],
  });
  const [loading, setLoading] = useState(true);

  // 재무 데이터 로드
  useEffect(() => {
    loadFinancialData();
  }, [profileId]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      
      // 각 재무 데이터 로드
      const [incomes, expenses, assets, debts] = await Promise.all([
        profileService.getIncomes(profileId),
        profileService.getExpenses(profileId),
        profileService.getAssets(profileId),
        profileService.getDebts(profileId),
      ]);

      setFinancialData({
        incomes,
        expenses,
        assets,
        debts,
      });

      // 완료 상태 자동 업데이트
      const updated = {
        ...data,
        incomeCompleted: incomes.length > 0,
        expenseCompleted: expenses.length > 0,
        assetsCompleted: assets.length > 0,
        debtsCompleted: debts.length > 0,
      };
      
      // 모든 항목이 입력되었는지 체크
      const allCompleted =
        updated.incomeCompleted &&
        updated.expenseCompleted &&
        updated.assetsCompleted &&
        updated.debtsCompleted;
      
      updated.completed = allCompleted;
      
      onChange(updated);
    } catch (error) {
      console.error("재무 데이터 로드 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotesChange = (value) => {
    onChange({
      ...data,
      notes: value,
    });
  };

  const handleComplete = () => {
    onChange({
      ...data,
      completed: !data.completed,
    });
  };

  // 대시보드로 이동하여 입력
  const goToDashboard = () => {
    navigate(`/consult/dashboard/${profileId}`);
  };

  // 총액 계산
  const calculateTotal = (items, field = "amount") => {
    return items.reduce((sum, item) => sum + (item[field] || 0), 0);
  };

  const totalIncome = calculateTotal(financialData.incomes);
  const totalExpense = calculateTotal(financialData.expenses);
  const totalAssets = calculateTotal(financialData.assets);
  const totalDebts = calculateTotal(financialData.debts);
  const netAssets = totalAssets - totalDebts;
  const monthlyBalance = totalIncome - totalExpense;

  return (
    <div className={styles.step}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>💰 현재 재무 상황 파악</h2>
        <p className={styles.stepDescription}>
          시뮬레이션을 위한 기초 데이터를 확인합니다.
        </p>
      </div>

      <div className={styles.stepContent}>
        {/* 안내 메시지 */}
        <div className={styles.infoBox}>
          <h3 className={styles.infoTitle}>💡 시뮬레이션을 위한 기초 데이터</h3>
          <p className={styles.infoText}>
            현재 소득/지출/자산/부채를 파악합니다. 처음 정리해보시는 분들도
            괜찮습니다! 함께 하나씩 입력해보겠습니다.
          </p>
        </div>

        {loading ? (
          <div className={styles.loading}>데이터를 불러오는 중...</div>
        ) : (
          <>
            {/* 입력 진행 상황 */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>📊 입력 진행 상황</h3>
              <div className={styles.progressList}>
                <div
                  className={`${styles.progressItem} ${
                    data.incomeCompleted ? styles.progressItemCompleted : ""
                  }`}
                >
                  <span className={styles.progressIcon}>
                    {data.incomeCompleted ? "✅" : "⬜"}
                  </span>
                  <span className={styles.progressText}>
                    소득 정보 ({financialData.incomes.length}개)
                  </span>
                  <button
                    className={styles.detailButton}
                    onClick={goToDashboard}
                  >
                    {data.incomeCompleted ? "상세보기" : "입력하기"} →
                  </button>
                </div>

                <div
                  className={`${styles.progressItem} ${
                    data.expenseCompleted ? styles.progressItemCompleted : ""
                  }`}
                >
                  <span className={styles.progressIcon}>
                    {data.expenseCompleted ? "✅" : "⬜"}
                  </span>
                  <span className={styles.progressText}>
                    지출 정보 ({financialData.expenses.length}개)
                  </span>
                  <button
                    className={styles.detailButton}
                    onClick={goToDashboard}
                  >
                    {data.expenseCompleted ? "상세보기" : "입력하기"} →
                  </button>
                </div>

                <div
                  className={`${styles.progressItem} ${
                    data.assetsCompleted ? styles.progressItemCompleted : ""
                  }`}
                >
                  <span className={styles.progressIcon}>
                    {data.assetsCompleted ? "✅" : "⬜"}
                  </span>
                  <span className={styles.progressText}>
                    자산 정보 ({financialData.assets.length}개)
                  </span>
                  <button
                    className={styles.detailButton}
                    onClick={goToDashboard}
                  >
                    {data.assetsCompleted ? "상세보기" : "입력하기"} →
                  </button>
                </div>

                <div
                  className={`${styles.progressItem} ${
                    data.debtsCompleted ? styles.progressItemCompleted : ""
                  }`}
                >
                  <span className={styles.progressIcon}>
                    {data.debtsCompleted ? "✅" : "⬜"}
                  </span>
                  <span className={styles.progressText}>
                    부채 정보 ({financialData.debts.length}개)
                  </span>
                  <button
                    className={styles.detailButton}
                    onClick={goToDashboard}
                  >
                    {data.debtsCompleted ? "상세보기" : "입력하기"} →
                  </button>
                </div>
              </div>
            </div>

            {/* 재무 요약 */}
            <div className={styles.summaryBox}>
              <h3 className={styles.summaryTitle}>📊 현재 재무 요약</h3>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 자산</div>
                  <div className={styles.summaryValue}>
                    {formatAmount(totalAssets)}
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>총 부채</div>
                  <div className={styles.summaryValue}>
                    {formatAmount(totalDebts)}
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>순자산</div>
                  <div className={styles.summaryValue}>
                    {formatAmount(netAssets)}
                  </div>
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>월 수입</div>
                  <div className={styles.summaryValue}>
                    {data.incomeCompleted
                      ? formatAmount(totalIncome)
                      : "(미입력)"}
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>월 지출</div>
                  <div className={styles.summaryValue}>
                    {data.expenseCompleted
                      ? formatAmount(totalExpense)
                      : "(미입력)"}
                  </div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>월 여유</div>
                  <div
                    className={`${styles.summaryValue} ${
                      monthlyBalance > 0
                        ? styles.summaryValuePositive
                        : styles.summaryValueNegative
                    }`}
                  >
                    {data.incomeCompleted && data.expenseCompleted
                      ? formatAmount(monthlyBalance)
                      : "(미입력)"}
                  </div>
                </div>
              </div>
            </div>

            {/* 대시보드로 이동 버튼 */}
            <div className={styles.section}>
              <button className={styles.dashboardButton} onClick={goToDashboard}>
                대시보드에서 재무 데이터 입력/수정하기 →
              </button>
            </div>

            {/* 상담 메모 */}
            <div className={styles.section}>
              <label className={styles.label}>📝 상담 메모</label>
              <textarea
                className={styles.textarea}
                value={data.notes || ""}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="재무 상황 관련 추가 메모..."
                rows={4}
              />
            </div>

            {/* 완료 체크 */}
            <div className={styles.completeSection}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={data.completed || false}
                  onChange={handleComplete}
                  className={styles.checkbox}
                />
                <span>이 단계를 완료했습니다</span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Step4Financial;

