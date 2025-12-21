"use client";

import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  AgeDisplay,
  calculateInternationalAge,
} from "@/components/ui/age-display";
import type { OnboardingData, FamilyMemberInput, Gender } from "@/types";
import { Heart, Baby, UserRound, Briefcase, Plus, Trash2 } from "lucide-react";
import styles from "../onboarding.module.css";

interface FamilyInfoStepProps {
  data: OnboardingData;
  onUpdateSpouse: (updates: Partial<FamilyMemberInput>) => void;
  onAddChild: () => void;
  onRemoveChild: (index: number) => void;
  onUpdateChild: (index: number, updates: Partial<FamilyMemberInput>) => void;
  onAddParent: () => void;
  onRemoveParent: (index: number) => void;
  onUpdateParent: (index: number, updates: Partial<FamilyMemberInput>) => void;
}

export function FamilyInfoStep({
  data,
  onUpdateSpouse,
  onAddChild,
  onRemoveChild,
  onUpdateChild,
  onAddParent,
  onRemoveParent,
  onUpdateParent,
}: FamilyInfoStepProps) {
  return (
    <div>
      <h2 className={styles.pageTitle}>가족 정보를 알려주세요</h2>
      <p className={styles.pageDescription}>
        {data.isMarried
          ? "배우자, 자녀, 부양 부모 정보를 입력해주세요"
          : "자녀와 부양 부모 정보를 입력해주세요"}
      </p>

      <div className={styles.familySection}>
        {/* 배우자 정보 */}
        {data.isMarried && data.spouse && (
          <div className={`${styles.familyCard} ${styles.familyCardPink}`}>
            <div className={styles.familyHeader}>
              <div
                className={`${styles.familyIconWrapper} ${styles.familyIconPink}`}
              >
                <Heart className={`${styles.icon20} ${styles.iconPink}`} />
              </div>
              <span className={styles.familyTitle}>배우자</span>
            </div>

            <div className={styles.familyContent}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.labelSmall}>이름</label>
                  <Input
                    placeholder="배우자 이름"
                    value={data.spouse.name}
                    onChange={(e) => onUpdateSpouse({ name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.labelSmall}>생년월일</label>
                  <Input
                    type="date"
                    max="9999-12-31"
                    value={data.spouse.birth_date || ""}
                    onChange={(e) =>
                      onUpdateSpouse({ birth_date: e.target.value })
                    }
                  />
                </div>
              </div>

              {data.spouse.birth_date && (
                <AgeDisplay birthDate={data.spouse.birth_date} />
              )}

              {/* 직장 여부 */}
              <div className={styles.workStatusSection}>
                <label className={styles.workStatusLabel}>직장 여부</label>
                <div className={styles.workStatusButtons}>
                  <button
                    onClick={() => onUpdateSpouse({ is_working: true })}
                    className={`${styles.workStatusButton} ${
                      data.spouse.is_working
                        ? styles.workStatusActive
                        : styles.workStatusInactive
                    }`}
                  >
                    <Briefcase className={styles.icon16} />
                    직장인
                  </button>
                  <button
                    onClick={() =>
                      onUpdateSpouse({ is_working: false, monthly_income: 0 })
                    }
                    className={`${styles.workStatusButton} ${
                      !data.spouse.is_working
                        ? styles.workStatusInactiveGray
                        : styles.workStatusInactive
                    }`}
                  >
                    비직장인
                  </button>
                </div>
              </div>

              {/* 직장인 추가 정보 */}
              {data.spouse.is_working && (
                <div className={styles.workStatusSection}>
                  <MoneyInput
                    label="월 수입"
                    value={data.spouse.monthly_income ?? null}
                    onChange={(value) =>
                      onUpdateSpouse({ monthly_income: value ?? undefined })
                    }
                    placeholder="500"
                  />
                  <div
                    className={styles.formGroup}
                    style={{ marginTop: "12px" }}
                  >
                    <label className={styles.labelSmall}>목표 은퇴 나이</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="60"
                      value={data.spouse.retirement_age || ""}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        onUpdateSpouse({
                          retirement_age: parseInt(value) || 0,
                        });
                      }}
                    />
                    {data.spouse.birth_date &&
                      (data.spouse.retirement_age ?? 0) > 0 && (
                        <p className={styles.retirementInfo}>
                          은퇴까지{" "}
                          {(data.spouse.retirement_age ?? 0) -
                            calculateInternationalAge(data.spouse.birth_date)}
                          년 남음
                        </p>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 자녀 */}
        <div className={`${styles.familyCard} ${styles.familyCardGray}`}>
          <div className={styles.familyHeaderWithButton}>
            <div className={styles.familyHeader} style={{ marginBottom: 0 }}>
              <div
                className={`${styles.familyIconWrapper} ${styles.familyIconBlue}`}
              >
                <Baby className={`${styles.icon20} ${styles.iconBlue}`} />
              </div>
              <span className={styles.familyTitle}>자녀</span>
            </div>
            <button className={styles.ghostButton} onClick={onAddChild}>
              <Plus className={styles.icon16} />
              추가
            </button>
          </div>

          {data.children.length === 0 ? (
            <p className={styles.emptyMessage}>등록된 자녀가 없습니다</p>
          ) : (
            <div className={styles.familyList}>
              {data.children.map((child, index) => (
                <div key={index} className={styles.familyItem}>
                  <div className={styles.familyItemContent}>
                    <div className={styles.familyItemFields}>
                      <Input
                        placeholder="자녀 이름"
                        value={child.name}
                        onChange={(e) =>
                          onUpdateChild(index, { name: e.target.value })
                        }
                      />
                      <div className={styles.familyItemRow}>
                        <Input
                          type="date"
                          max="9999-12-31"
                          value={child.birth_date || ""}
                          onChange={(e) =>
                            onUpdateChild(index, { birth_date: e.target.value })
                          }
                        />
                        <select
                          className={styles.assetSelect}
                          value={child.gender || "male"}
                          onChange={(e) =>
                            onUpdateChild(index, {
                              gender: e.target.value as Gender,
                            })
                          }
                        >
                          <option value="male">아들</option>
                          <option value="female">딸</option>
                        </select>
                      </div>
                      {child.birth_date && (
                        <AgeDisplay birthDate={child.birth_date} />
                      )}
                    </div>
                    <button
                      className={styles.deleteButton}
                      onClick={() => onRemoveChild(index)}
                    >
                      <Trash2 className={styles.icon16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 부양 부모 */}
        <div className={`${styles.familyCard} ${styles.familyCardGray}`}>
          <div className={styles.familyHeaderWithButton}>
            <div className={styles.familyHeader} style={{ marginBottom: 0 }}>
              <div
                className={`${styles.familyIconWrapper} ${styles.familyIconAmber}`}
              >
                <UserRound className={`${styles.icon20} ${styles.iconAmber}`} />
              </div>
              <div>
                <span className={styles.familyTitle}>부양 부모</span>
                <p className={styles.familySubtitle}>부양하고 계신 부모님</p>
              </div>
            </div>
            <button className={styles.ghostButton} onClick={onAddParent}>
              <Plus className={styles.icon16} />
              추가
            </button>
          </div>

          {data.parents.length === 0 ? (
            <p className={styles.emptyMessage}>등록된 부양 부모가 없습니다</p>
          ) : (
            <div className={styles.familyList}>
              {data.parents.map((parent, index) => (
                <div key={index} className={styles.familyItem}>
                  <div className={styles.familyItemContent}>
                    <div className={styles.familyItemFields}>
                      <Input
                        placeholder="부모님 성함"
                        value={parent.name}
                        onChange={(e) =>
                          onUpdateParent(index, { name: e.target.value })
                        }
                      />
                      <Input
                        type="date"
                        max="9999-12-31"
                        value={parent.birth_date || ""}
                        onChange={(e) =>
                          onUpdateParent(index, { birth_date: e.target.value })
                        }
                      />
                      {parent.birth_date && (
                        <AgeDisplay birthDate={parent.birth_date} />
                      )}
                    </div>
                    <button
                      className={styles.deleteButton}
                      onClick={() => onRemoveParent(index)}
                    >
                      <Trash2 className={styles.icon16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
