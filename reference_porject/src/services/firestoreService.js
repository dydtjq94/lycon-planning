// Firestore 서비스 - 프로필 및 재무 데이터 관리
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc,
  where,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { db } from "../libs/firebase.js";

const DEFAULT_PROFILE_PASSWORD = "lycon1111";

// 프로필에 기본 비밀번호가 없으면 설정
const ensureProfilePassword = async (docRef, data) => {
  if (data?.password && data.password.trim()) {
    return data;
  }
  const patchedData = {
    ...data,
    password: DEFAULT_PROFILE_PASSWORD,
  };

  if (docRef) {
    try {
      await updateDoc(docRef, {
        password: DEFAULT_PROFILE_PASSWORD,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("기본 프로필 비밀번호 설정 오류:", error);
    }
  }

  return patchedData;
};

/**
 * 프로필 관련 서비스
 */
export const profileService = {
  // 프로필 생성
  async createProfile(profileData) {
    try {
      const passwordToUse =
        profileData?.password && profileData.password.trim()
          ? profileData.password
          : DEFAULT_PROFILE_PASSWORD;

      const docRef = await addDoc(collection(db, "profiles"), {
        ...profileData,
        password: passwordToUse,
        isActive: true, // 기본값으로 활성 상태 설정
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { id: docRef.id, ...profileData, password: passwordToUse };
    } catch (error) {
      console.error("프로필 생성 오류:", error);
      if (error.code === "unavailable") {
        throw new Error(
          "Firebase 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
        );
      } else if (error.code === "permission-denied") {
        throw new Error("프로필 생성 권한이 없습니다.");
      } else {
        throw new Error("프로필 생성 중 오류가 발생했습니다: " + error.message);
      }
    }
  },

  // 모든 활성 프로필 조회 (isActive가 true이거나 undefined인 것들)
  async getAllProfiles() {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "profiles"), orderBy("createdAt", "desc"))
      );
      const profiles = (
        await Promise.all(
          querySnapshot.docs.map(async (docSnap) => {
            const data = await ensureProfilePassword(
              doc(db, "profiles", docSnap.id),
              docSnap.data()
            );
            return { id: docSnap.id, ...data };
          })
        )
      ).filter((profile) => profile.isActive !== false); // isActive가 false가 아닌 것만
      return profiles;
    } catch (error) {
      console.error("프로필 조회 오류:", error);
      if (error.name === "AbortError") {
        throw new Error("네트워크 연결이 중단되었습니다. 다시 시도해주세요.");
      }
      throw error;
    }
  },

  // 모든 프로필 조회 (삭제된 것 포함)
  async getAllProfilesIncludingDeleted() {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "profiles"), orderBy("createdAt", "desc"))
      );
      return Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const data = await ensureProfilePassword(
            doc(db, "profiles", docSnap.id),
            docSnap.data()
          );
          return { id: docSnap.id, ...data };
        })
      );
    } catch (error) {
      console.error("전체 프로필 조회 오류:", error);
      if (error.name === "AbortError") {
        throw new Error("네트워크 연결이 중단되었습니다. 다시 시도해주세요.");
      }
      throw error;
    }
  },

  // 삭제된 프로필만 조회 (휴지통)
  async getDeletedProfiles() {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "profiles"), orderBy("deletedAt", "desc"))
      );
      const deletedProfiles = (
        await Promise.all(
          querySnapshot.docs.map(async (docSnap) => {
            const data = await ensureProfilePassword(
              doc(db, "profiles", docSnap.id),
              docSnap.data()
            );
            return { id: docSnap.id, ...data };
          })
        )
      ).filter((profile) => profile.isActive === false); // isActive가 false인 것만
      return deletedProfiles;
    } catch (error) {
      console.error("삭제 프로필 조회 오류:", error);
      throw error;
    }
  },

  // 프로필 휴지통으로 이동 (soft delete)
  async moveToTrash(profileId) {
    try {
      const docRef = doc(db, "profiles", profileId);
      await updateDoc(docRef, {
        isActive: false,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("프로필 휴지통 이동 오류:", error);
      throw error;
    }
  },

  // 프로필 복구 (휴지통에서 복원)
  async restoreFromTrash(profileId) {
    try {
      const docRef = doc(db, "profiles", profileId);
      await updateDoc(docRef, {
        isActive: true,
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("프로필 복구 오류:", error);
      throw error;
    }
  },

  // 프로필 조회
  async getProfile(profileId) {
    try {
      const docRef = doc(db, "profiles", profileId);

      // 타임아웃 설정 (10초)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("요청 시간이 초과되었습니다.")),
          10000
        );
      });

      const docSnap = await Promise.race([getDoc(docRef), timeoutPromise]);

      if (docSnap.exists()) {
        const dataWithPassword = await ensureProfilePassword(
          docRef,
          docSnap.data()
        );
        return { id: docSnap.id, ...dataWithPassword };
      } else {
        throw new Error("프로필을 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("프로필 조회 오류:", error);
      if (error.name === "AbortError") {
        console.warn(
          "AbortError 발생 - 요청이 중단되었지만 정상적인 상황일 수 있습니다."
        );
        // AbortError는 무시하고 빈 결과 반환
        return null;
      }
      throw error;
    }
  },

  // 프로필 업데이트
  async updateProfile(profileId, updateData) {
    try {
      const docRef = doc(db, "profiles", profileId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("프로필 업데이트 오류:", error);
      throw error;
    }
  },

  // 프로필 소프트 삭제 (isActive를 false로 설정)
  async deleteProfile(profileId) {
    try {
      const docRef = doc(db, "profiles", profileId);
      await updateDoc(docRef, {
        isActive: false,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("프로필 삭제 오류:", error);
      throw error;
    }
  },

  // 프로필 복원 (isActive를 true로 설정)
  async restoreProfile(profileId) {
    try {
      const docRef = doc(db, "profiles", profileId);
      await updateDoc(docRef, {
        isActive: true,
        restoredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("프로필 복원 오류:", error);
      throw error;
    }
  },

  // 프로필 완전 삭제 (실제 데이터 삭제)
  async permanentDeleteProfile(profileId) {
    try {
      const docRef = doc(db, "profiles", profileId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("프로필 완전 삭제 오류:", error);
      throw error;
    }
  },

  // 프로필 복제 (모든 하위 데이터 포함)
  async duplicateProfile(profileId) {
    try {
      // 1. 원본 프로필 조회
      const originalProfile = await this.getProfile(profileId);
      if (!originalProfile) {
        throw new Error("복제할 프로필을 찾을 수 없습니다.");
      }

      // 2. 새 프로필 생성 (이름에 "(복사본)" 추가)
      const { id, createdAt, updatedAt, ...profileData } = originalProfile;
      const newProfileData = {
        ...profileData,
        name: `${profileData.name} (복사본)`,
      };
      const newProfile = await this.createProfile(newProfileData);
      const newProfileId = newProfile.id;

      // 3. 원본 프로필의 모든 시뮬레이션 복제
      const simulationsRef = collection(db, "profiles", profileId, "simulations");
      const simulationsSnapshot = await getDocs(query(simulationsRef, orderBy("order", "asc")));

      for (const simDoc of simulationsSnapshot.docs) {
        const simData = simDoc.data();
        const originalSimId = simDoc.id;

        // 새 시뮬레이션 생성
        const newSimRef = await addDoc(
          collection(db, "profiles", newProfileId, "simulations"),
          {
            ...simData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );
        const newSimId = newSimRef.id;

        // 4. 각 시뮬레이션의 하위 컬렉션 복제
        const subcollections = [
          "incomes",
          "expenses",
          "savings",
          "pensions",
          "realEstates",
          "assets",
          "debts",
        ];

        for (const subcollectionName of subcollections) {
          const subcollectionRef = collection(
            db,
            "profiles",
            profileId,
            "simulations",
            originalSimId,
            subcollectionName
          );
          const subcollectionSnapshot = await getDocs(subcollectionRef);

          if (!subcollectionSnapshot.empty) {
            const batch = writeBatch(db);
            subcollectionSnapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const newDocRef = doc(
                db,
                "profiles",
                newProfileId,
                "simulations",
                newSimId,
                subcollectionName,
                docSnap.id
              );
              batch.set(newDocRef, {
                ...data,
                updatedAt: new Date().toISOString(),
              });
            });
            await batch.commit();
          }
        }
      }

      // 5. 체크리스트 복제
      const checklistsRef = collection(db, "profiles", profileId, "checklists");
      const checklistsSnapshot = await getDocs(checklistsRef);

      if (!checklistsSnapshot.empty) {
        const batch = writeBatch(db);
        checklistsSnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const newDocRef = doc(
            db,
            "profiles",
            newProfileId,
            "checklists",
            docSnap.id
          );
          batch.set(newDocRef, {
            ...data,
            updatedAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      }

      return newProfile;
    } catch (error) {
      console.error("프로필 복제 오류:", error);
      throw new Error("프로필 복제 중 오류가 발생했습니다: " + error.message);
    }
  },

  // 하위 컬렉션의 모든 문서 삭제 헬퍼 함수
  async deleteSubcollection(profileId, subcollectionName) {
    try {
      const subcollectionRef = collection(
        db,
        "profiles",
        profileId,
        subcollectionName
      );
      const snapshot = await getDocs(subcollectionRef);

      if (snapshot.empty) {
        return 0;
      }

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      return snapshot.docs.length;
    } catch (error) {
      console.error(`${subcollectionName} 하위 컬렉션 삭제 오류:`, error);
      throw error;
    }
  },

  // 프로필과 모든 관련 데이터 완전 삭제 (시뮬레이션 포함)
  async deleteProfileWithAllData(profileId) {
    try {
      // 먼저 모든 시뮬레이션 조회
      const simulationsRef = collection(
        db,
        "profiles",
        profileId,
        "simulations"
      );
      const simulationsSnapshot = await getDocs(simulationsRef);

      let totalDeleted = 0;

      // 각 시뮬레이션의 하위 컬렉션 삭제
      for (const simDoc of simulationsSnapshot.docs) {
        const simulationId = simDoc.id;

        const subcollections = [
          "incomes",
          "expenses",
          "savings",
          "pensions",
          "realEstates",
          "assets",
          "debts",
        ];

        for (const subcollectionName of subcollections) {
          try {
            const subcollectionRef = collection(
              db,
              "profiles",
              profileId,
              "simulations",
              simulationId,
              subcollectionName
            );
            const snapshot = await getDocs(subcollectionRef);

            if (!snapshot.empty) {
              const deletePromises = snapshot.docs.map((doc) =>
                deleteDoc(doc.ref)
              );
              await Promise.all(deletePromises);
              totalDeleted += snapshot.docs.length;
            }
          } catch (error) {
            console.warn(`${subcollectionName} 하위 컬렉션 삭제 실패:`, error);
          }
        }

        // 시뮬레이션 문서 삭제
        await deleteDoc(simDoc.ref);
      }

      // 마지막으로 프로필 문서 삭제
      const profileRef = doc(db, "profiles", profileId);
      await deleteDoc(profileRef);
    } catch (error) {
      console.error("프로필 및 관련 데이터 삭제 오류:", error);
      throw error;
    }
  },
};

/**
 * 수입 데이터 관련 서비스
 * 모든 수입 데이터는 시뮬레이션 하위에 저장됩니다.
 */
export const incomeService = {
  // 수입 데이터 생성
  async createIncome(profileId, simulationId, incomeData) {
    try {
      const docRef = await addDoc(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "incomes"
        ),
        {
          ...incomeData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return { id: docRef.id, ...incomeData };
    } catch (error) {
      console.error("수입 데이터 생성 오류:", error);
      throw new Error(
        "수입 데이터 생성 중 오류가 발생했습니다: " + error.message
      );
    }
  },

  // 특정 ID로 수입 데이터 생성 (동일 ID 유지 목적)
  async createIncomeWithId(profileId, simulationId, incomeId, incomeData) {
    const incomeRef = doc(
      db,
      "profiles",
      profileId,
      "simulations",
      simulationId,
      "incomes",
      incomeId
    );
    await setDoc(
      incomeRef,
      {
        ...incomeData,
        createdAt: incomeData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { id: incomeId, ...incomeData };
  },

  // 프로필의 모든 수입 데이터 조회
  async getIncomes(profileId, simulationId) {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(
            db,
            "profiles",
            profileId,
            "simulations",
            simulationId,
            "incomes"
          ),
          orderBy("createdAt", "desc")
        )
      );
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("수입 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 수입 데이터 조회
  async getIncome(profileId, simulationId, incomeId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "incomes",
        incomeId
      );
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("수입 데이터를 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("수입 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 수입 데이터 업데이트
  async updateIncome(profileId, simulationId, incomeId, updateData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "incomes",
        incomeId
      );
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("수입 데이터 업데이트 오류:", error);
      throw error;
    }
  },

  // 수입 데이터 삭제
  async deleteIncome(profileId, simulationId, incomeId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "incomes",
        incomeId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("수입 데이터 삭제 오류:", error);
      throw error;
    }
  },

  // 모든 시뮬레이션의 은퇴년도 고정된 소득 항목들의 endYear 업데이트
  async updateFixedIncomesEndYear(profileId, retirementYear) {
    try {
      // 모든 시뮬레이션 조회
      const simulationsRef = collection(
        db,
        "profiles",
        profileId,
        "simulations"
      );
      const simulationsSnapshot = await getDocs(simulationsRef);

      let totalUpdated = 0;

      // 각 시뮬레이션의 소득 데이터 조회 및 업데이트
      for (const simDoc of simulationsSnapshot.docs) {
        const simulationId = simDoc.id;
        const incomesRef = collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "incomes"
        );
        const incomesSnapshot = await getDocs(incomesRef);

        // isFixedToRetirementYear가 true인 소득 항목들 찾기
        const fixedIncomes = incomesSnapshot.docs.filter(
          (doc) => doc.data().isFixedToRetirementYear === true
        );

        // 일괄 업데이트
        if (fixedIncomes.length > 0) {
          const batch = writeBatch(db);

          fixedIncomes.forEach((incomeDoc) => {
            const incomeRef = doc(
              db,
              "profiles",
              profileId,
              "simulations",
              simulationId,
              "incomes",
              incomeDoc.id
            );
            batch.update(incomeRef, {
              endYear: retirementYear,
              updatedAt: new Date().toISOString(),
            });
            totalUpdated++;
          });

          await batch.commit();
        }
      }

      return totalUpdated;
    } catch (error) {
      console.error("고정된 소득 항목 업데이트 오류:", error);
      throw error;
    }
  },
};

// 지출 데이터 서비스
export const expenseService = {
  // 지출 데이터 생성
  async createExpense(profileId, simulationId, expenseData) {
    try {
      const docRef = await addDoc(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "expenses"
        ),
        {
          ...expenseData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return { id: docRef.id, ...expenseData };
    } catch (error) {
      console.error("지출 데이터 생성 오류:", error);
      throw error;
    }
  },

  // 지출 데이터 목록 조회
  async getExpenses(profileId, simulationId) {
    try {
      const q = query(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "expenses"
        ),
        orderBy("createdAt", "asc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("지출 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 지출 데이터 조회
  async getExpense(profileId, simulationId, expenseId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "expenses",
        expenseId
      );
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error("지출 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 지출 데이터 업데이트
  async updateExpense(profileId, simulationId, expenseId, updateData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "expenses",
        expenseId
      );
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("지출 데이터 업데이트 오류:", error);
      throw error;
    }
  },

  // 특정 ID로 지출 데이터 생성 (동일 ID 유지 목적)
  async createExpenseWithId(profileId, simulationId, expenseId, expenseData) {
    const expenseRef = doc(
      db,
      "profiles",
      profileId,
      "simulations",
      simulationId,
      "expenses",
      expenseId
    );
    await setDoc(
      expenseRef,
      {
        ...expenseData,
        createdAt: expenseData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { id: expenseId, ...expenseData };
  },

  // 지출 데이터 삭제
  async deleteExpense(profileId, simulationId, expenseId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "expenses",
        expenseId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("지출 데이터 삭제 오류:", error);
      throw error;
    }
  },

  // 모든 시뮬레이션의 은퇴년도 고정된 지출 항목들의 endYear 업데이트
  async updateFixedExpensesEndYear(profileId, retirementYear) {
    try {
      // 모든 시뮬레이션 조회
      const simulationsRef = collection(
        db,
        "profiles",
        profileId,
        "simulations"
      );
      const simulationsSnapshot = await getDocs(simulationsRef);

      let totalUpdated = 0;

      // 각 시뮬레이션의 지출 데이터 조회 및 업데이트
      for (const simDoc of simulationsSnapshot.docs) {
        const simulationId = simDoc.id;
        const expensesRef = collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "expenses"
        );
        const expensesSnapshot = await getDocs(expensesRef);

        // isFixedToRetirementYear가 true인 지출 항목들 찾기
        const fixedExpenses = expensesSnapshot.docs.filter(
          (doc) => doc.data().isFixedToRetirementYear === true
        );

        // 일괄 업데이트
        if (fixedExpenses.length > 0) {
          const batch = writeBatch(db);

          fixedExpenses.forEach((expenseDoc) => {
            const expenseRef = doc(
              db,
              "profiles",
              profileId,
              "simulations",
              simulationId,
              "expenses",
              expenseDoc.id
            );
            batch.update(expenseRef, {
              endYear: retirementYear,
              updatedAt: new Date().toISOString(),
            });
            totalUpdated++;
          });

          await batch.commit();
        }
      }

      return totalUpdated;
    } catch (error) {
      console.error("고정된 지출 항목 업데이트 오류:", error);
      throw error;
    }
  },
};

// 저축 데이터 서비스
export const savingsService = {
  // 저축 데이터 생성
  async createSaving(profileId, simulationId, savingData) {
    try {
      const docRef = await addDoc(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "savings"
        ),
        {
          ...savingData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return { id: docRef.id, ...savingData };
    } catch (error) {
      console.error("저축 데이터 생성 오류:", error);
      throw error;
    }
  },

  // 저축 데이터 조회 (전체)
  async getSavings(profileId, simulationId) {
    try {
      const querySnapshot = await getDocs(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "savings"
        )
      );
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("저축 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 저축 데이터 조회 (단일)
  async getSaving(profileId, simulationId, savingId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "savings",
        savingId
      );
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error("저축 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 저축 데이터 업데이트
  async updateSaving(profileId, simulationId, savingId, updateData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "savings",
        savingId
      );
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("저축 데이터 업데이트 오류:", error);
      throw error;
    }
  },

  // 특정 ID로 저축 데이터 생성 (동일 ID 유지 목적)
  async createSavingWithId(profileId, simulationId, savingId, savingData) {
    const savingRef = doc(
      db,
      "profiles",
      profileId,
      "simulations",
      simulationId,
      "savings",
      savingId
    );
    await setDoc(
      savingRef,
      {
        ...savingData,
        createdAt: savingData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { id: savingId, ...savingData };
  },

  // 저축 데이터 삭제
  async deleteSaving(profileId, simulationId, savingId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "savings",
        savingId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("저축 데이터 삭제 오류:", error);
      throw error;
    }
  },

  // 모든 시뮬레이션의 은퇴년도 고정된 저축 항목들의 endYear 업데이트
  async updateFixedSavingsEndYear(profileId, retirementYear) {
    try {
      // 모든 시뮬레이션 조회
      const simulationsRef = collection(
        db,
        "profiles",
        profileId,
        "simulations"
      );
      const simulationsSnapshot = await getDocs(simulationsRef);

      let totalUpdated = 0;

      // 각 시뮬레이션의 저축 데이터 조회 및 업데이트
      for (const simDoc of simulationsSnapshot.docs) {
        const simulationId = simDoc.id;
        const savingsRef = collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "savings"
        );
        const savingsSnapshot = await getDocs(savingsRef);

        // isFixedToRetirementYear가 true인 저축 항목들 찾기
        const fixedSavings = savingsSnapshot.docs.filter(
          (doc) => doc.data().isFixedToRetirementYear === true
        );

        // 일괄 업데이트
        if (fixedSavings.length > 0) {
          const batch = writeBatch(db);

          fixedSavings.forEach((savingDoc) => {
            const savingRef = doc(
              db,
              "profiles",
              profileId,
              "simulations",
              simulationId,
              "savings",
              savingDoc.id
            );
            batch.update(savingRef, {
              endYear: retirementYear,
              updatedAt: new Date().toISOString(),
            });
            totalUpdated++;
          });

          await batch.commit();
        }
      }

      return totalUpdated;
    } catch (error) {
      console.error("고정된 저축 항목 업데이트 오류:", error);
      throw error;
    }
  },
};

/**
 * 연금 관련 서비스
 */
export const pensionService = {
  // 연금 데이터 생성
  async createPension(profileId, simulationId, pensionData) {
    try {
      const docRef = await addDoc(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "pensions"
        ),
        {
          ...pensionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return docRef.id;
    } catch (error) {
      console.error("연금 데이터 생성 오류:", error);
      throw error;
    }
  },

  // 연금 데이터 목록 조회
  async getPensions(profileId, simulationId) {
    try {
      const q = query(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "pensions"
        ),
        orderBy("createdAt", "asc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("연금 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 연금 데이터 단건 조회
  async getPension(profileId, simulationId, pensionId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "pensions",
        pensionId
      );
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error("연금 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 연금 데이터 수정
  async updatePension(profileId, simulationId, pensionId, updateData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "pensions",
        pensionId
      );
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("연금 데이터 업데이트 오류:", error);
      throw error;
    }
  },

  // 특정 ID로 연금 데이터 생성 (동일 ID 유지 목적)
  async createPensionWithId(profileId, simulationId, pensionId, pensionData) {
    const pensionRef = doc(
      db,
      "profiles",
      profileId,
      "simulations",
      simulationId,
      "pensions",
      pensionId
    );
    await setDoc(
      pensionRef,
      {
        ...pensionData,
        createdAt: pensionData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { id: pensionId, ...pensionData };
  },

  // 연금 데이터 삭제
  async deletePension(profileId, simulationId, pensionId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "pensions",
        pensionId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("연금 데이터 삭제 오류:", error);
      throw error;
    }
  },

  // 모든 시뮬레이션의 은퇴년도 고정된 연금 항목들의 endYear 업데이트
  async updateFixedPensionsEndYear(profileId, retirementYear) {
    try {
      // 모든 시뮬레이션 조회
      const simulationsRef = collection(
        db,
        "profiles",
        profileId,
        "simulations"
      );
      const simulationsSnapshot = await getDocs(simulationsRef);

      let totalUpdated = 0;

      // 각 시뮬레이션의 연금 데이터 조회 및 업데이트
      for (const simDoc of simulationsSnapshot.docs) {
        const simulationId = simDoc.id;
        const pensionsRef = collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "pensions"
        );
        const pensionsSnapshot = await getDocs(pensionsRef);

        // isFixedContributionEndYearToRetirement가 true인 연금 항목들 찾기
        const fixedPensions = pensionsSnapshot.docs.filter(
          (doc) => doc.data().isFixedContributionEndYearToRetirement === true
        );

        // 일괄 업데이트
        if (fixedPensions.length > 0) {
          const batch = writeBatch(db);

          fixedPensions.forEach((pensionDoc) => {
            const pensionRef = doc(
              db,
              "profiles",
              profileId,
              "simulations",
              simulationId,
              "pensions",
              pensionDoc.id
            );
            batch.update(pensionRef, {
              contributionEndYear: retirementYear,
              updatedAt: new Date().toISOString(),
            });
            totalUpdated++;
          });

          await batch.commit();
        }
      }

      return totalUpdated;
    } catch (error) {
      console.error("고정된 연금 항목 업데이트 오류:", error);
      throw error;
    }
  },
};

/**
 * 자산 데이터 관련 서비스
 */
export const assetService = {
  // 자산 데이터 생성
  async createAsset(profileId, simulationId, assetData) {
    try {
      const docRef = await addDoc(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "assets"
        ),
        {
          ...assetData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return docRef.id;
    } catch (error) {
      console.error("자산 데이터 생성 오류:", error);
      throw error;
    }
  },

  // 자산 목록 조회
  async getAssets(profileId, simulationId) {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(
            db,
            "profiles",
            profileId,
            "simulations",
            simulationId,
            "assets"
          ),
          orderBy("createdAt", "desc")
        )
      );
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("자산 목록 조회 오류:", error);
      throw error;
    }
  },

  // 자산 조회
  async getAsset(profileId, simulationId, assetId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "assets",
        assetId
      );
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("자산을 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("자산 조회 오류:", error);
      throw error;
    }
  },

  // 자산 수정
  async updateAsset(profileId, simulationId, assetId, assetData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "assets",
        assetId
      );
      await updateDoc(docRef, {
        ...assetData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("자산 수정 오류:", error);
      throw error;
    }
  },

  // 특정 ID로 자산 데이터 생성 (동일 ID 유지 목적)
  async createAssetWithId(profileId, simulationId, assetId, assetData) {
    const assetRef = doc(
      db,
      "profiles",
      profileId,
      "simulations",
      simulationId,
      "assets",
      assetId
    );
    await setDoc(
      assetRef,
      {
        ...assetData,
        createdAt: assetData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { id: assetId, ...assetData };
  },

  // 자산 삭제
  async deleteAsset(profileId, simulationId, assetId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "assets",
        assetId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("자산 삭제 오류:", error);
      throw error;
    }
  },
};

// 부동산 데이터 서비스
export const realEstateService = {
  // 부동산 데이터 생성
  async createRealEstate(profileId, simulationId, realEstateData) {
    try {
      const docRef = await addDoc(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "realEstates"
        ),
        {
          ...realEstateData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return docRef.id;
    } catch (error) {
      console.error("부동산 데이터 생성 오류:", error);
      throw error;
    }
  },

  // 부동산 데이터 조회
  async getRealEstates(profileId, simulationId) {
    try {
      const q = query(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "realEstates"
        ),
        orderBy("createdAt", "asc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("부동산 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 부동산 데이터 단일 조회
  async getRealEstate(profileId, simulationId, realEstateId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "realEstates",
        realEstateId
      );
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error("부동산 데이터 단일 조회 오류:", error);
      throw error;
    }
  },

  // 부동산 데이터 업데이트
  async updateRealEstate(profileId, simulationId, realEstateId, updateData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "realEstates",
        realEstateId
      );
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("부동산 데이터 업데이트 오류:", error);
      throw error;
    }
  },

  // 특정 ID로 부동산 데이터 생성 (동일 ID 유지 목적)
  async createRealEstateWithId(
    profileId,
    simulationId,
    realEstateId,
    realEstateData
  ) {
    const realEstateRef = doc(
      db,
      "profiles",
      profileId,
      "simulations",
      simulationId,
      "realEstates",
      realEstateId
    );
    await setDoc(
      realEstateRef,
      {
        ...realEstateData,
        createdAt: realEstateData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { id: realEstateId, ...realEstateData };
  },

  // 부동산 데이터 삭제
  async deleteRealEstate(profileId, simulationId, realEstateId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "realEstates",
        realEstateId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("부동산 데이터 삭제 오류:", error);
      throw error;
    }
  },
};

/**
 * 부채 데이터 관련 서비스
 */
export const debtService = {
  // 부채 데이터 생성
  async createDebt(profileId, simulationId, debtData) {
    try {
      const docRef = await addDoc(
        collection(
          db,
          "profiles",
          profileId,
          "simulations",
          simulationId,
          "debts"
        ),
        {
          ...debtData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return { id: docRef.id, ...debtData };
    } catch (error) {
      console.error("부채 데이터 생성 오류:", error);
      throw new Error(
        "부채 데이터 생성 중 오류가 발생했습니다: " + error.message
      );
    }
  },

  // 프로필의 모든 부채 데이터 조회
  async getDebts(profileId, simulationId) {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(
            db,
            "profiles",
            profileId,
            "simulations",
            simulationId,
            "debts"
          ),
          orderBy("createdAt", "desc")
        )
      );
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("부채 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 부채 데이터 조회 (단일)
  async getDebt(profileId, simulationId, debtId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "debts",
        debtId
      );
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("부채 데이터를 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("부채 데이터 조회 오류:", error);
      throw error;
    }
  },

  // 부채 데이터 업데이트
  async updateDebt(profileId, simulationId, debtId, updateData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "debts",
        debtId
      );
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("부채 데이터 업데이트 오류:", error);
      throw error;
    }
  },

  // 특정 ID로 부채 데이터 생성 (동일 ID 유지 목적)
  async createDebtWithId(profileId, simulationId, debtId, debtData) {
    const debtRef = doc(
      db,
      "profiles",
      profileId,
      "simulations",
      simulationId,
      "debts",
      debtId
    );
    await setDoc(
      debtRef,
      {
        ...debtData,
        createdAt: debtData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { id: debtId, ...debtData };
  },

  // 부채 데이터 삭제
  async deleteDebt(profileId, simulationId, debtId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId,
        "debts",
        debtId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("부채 데이터 삭제 오류:", error);
      throw error;
    }
  },
};

// 체크리스트 서비스 (프로필 단위 저장)
export const checklistService = {
  // 체크리스트 생성
  async createChecklist(profileId, checklistData) {
    try {
      const docRef = await addDoc(
        collection(db, "profiles", profileId, "checklists"),
        {
          ...checklistData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
      return { id: docRef.id, ...checklistData };
    } catch (error) {
      console.error("체크리스트 생성 오류:", error);
      throw error;
    }
  },

  // 체크리스트 조회 (전체)
  async getChecklists(profileId) {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, "profiles", profileId, "checklists"),
          orderBy("createdAt", "asc")
        )
      );
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("체크리스트 조회 오류:", error);
      throw error;
    }
  },

  // 체크리스트 조회 (단일)
  async getChecklist(profileId, checklistId) {
    try {
      const docRef = doc(db, "profiles", profileId, "checklists", checklistId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error("체크리스트 조회 오류:", error);
      throw error;
    }
  },

  // 체크리스트 업데이트
  async updateChecklist(profileId, checklistId, updateData) {
    try {
      const docRef = doc(db, "profiles", profileId, "checklists", checklistId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("체크리스트 업데이트 오류:", error);
      throw error;
    }
  },

  // 체크리스트 삭제
  async deleteChecklist(profileId, checklistId) {
    try {
      const docRef = doc(db, "profiles", profileId, "checklists", checklistId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("체크리스트 삭제 오류:", error);
      throw error;
    }
  },
};

/**
 * 체크리스트 템플릿 서비스
 * Firebase의 checklistTemplates 컬렉션에 전역 템플릿을 저장하고 관리합니다.
 * 관리자만 수정 가능하며, 프로필 생성 시 이 템플릿을 기반으로 체크리스트를 생성합니다.
 */
export const checklistTemplateService = {
  // 체크리스트 템플릿 조회
  async getTemplate() {
    try {
      const querySnapshot = await getDocs(collection(db, "checklistTemplates"));

      // 가장 최신 템플릿 하나만 사용 (createdAt 기준 정렬)
      const templates = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (templates.length === 0) {
        return null;
      }

      // 가장 최신 템플릿 반환
      templates.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt)
      );

      return templates[0];
    } catch (error) {
      console.error("체크리스트 템플릿 조회 오류:", error);
      throw error;
    }
  },

  // 체크리스트 템플릿 생성 (최초 1회)
  async createTemplate(templateData) {
    try {
      const docRef = await addDoc(collection(db, "checklistTemplates"), {
        title: templateData.title || "상담 체크리스트 템플릿",
        items: templateData.items || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { id: docRef.id, ...templateData };
    } catch (error) {
      console.error("체크리스트 템플릿 생성 오류:", error);
      throw error;
    }
  },

  // 체크리스트 템플릿 업데이트
  async updateTemplate(templateId, templateData) {
    try {
      const docRef = doc(db, "checklistTemplates", templateId);
      await updateDoc(docRef, {
        title: templateData.title,
        items: templateData.items,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("체크리스트 템플릿 업데이트 오류:", error);
      throw error;
    }
  },

  // 기본 템플릿 초기화 (Firebase에 템플릿이 없을 때)
  async initializeDefaultTemplate(defaultItems) {
    try {
      const existing = await this.getTemplate();
      if (existing) {
        return existing;
      }

      return await this.createTemplate({
        title: "상담 체크리스트 템플릿",
        items: defaultItems,
      });
    } catch (error) {
      console.error("기본 템플릿 초기화 오류:", error);
      throw error;
    }
  },
};

/**
 * 버전 히스토리 서비스
 * Firebase의 versionHistory 컬렉션에 버전 변경 내역을 저장하고 조회합니다.
 */
export const versionHistoryService = {
  /**
   * 새 버전 정보를 Firebase에 추가
   * @param {Object} versionData - 버전 정보 (version, date, changes)
   */
  async addVersion(versionData) {
    try {
      // 동일한 버전이 이미 있는지 확인
      const existingQuery = query(
        collection(db, "versionHistory"),
        where("version", "==", versionData.version)
      );
      const existingDocs = await getDocs(existingQuery);

      if (!existingDocs.empty) {
        // 이미 존재하는 버전이면 업데이트
        const existingDoc = existingDocs.docs[0];
        await updateDoc(doc(db, "versionHistory", existingDoc.id), {
          ...versionData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // 새 버전이면 추가
        await addDoc(collection(db, "versionHistory"), {
          ...versionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("버전 정보 저장 오류:", error);
      throw error;
    }
  },

  /**
   * 모든 버전 히스토리를 조회 (최신순)
   * @returns {Array} 버전 히스토리 배열
   */
  async getHistory() {
    try {
      const q = query(
        collection(db, "versionHistory"),
        orderBy("date", "desc")
      );
      const querySnapshot = await getDocs(q);
      const history = [];
      querySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      return history;
    } catch (error) {
      console.error("버전 히스토리 조회 오류:", error);
      throw error;
    }
  },

  /**
   * 특정 버전 정보 조회
   * @param {String} version - 버전 문자열
   * @returns {Object|null} 버전 정보 또는 null
   */
  async getVersion(version) {
    try {
      const q = query(
        collection(db, "versionHistory"),
        where("version", "==", version)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data(),
        };
      }
      return null;
    } catch (error) {
      console.error("버전 정보 조회 오류:", error);
      throw error;
    }
  },
};

/**
 * 재무 라이브러리 서비스
 * Firebase의 financialLibrary 컬렉션에 재무 데이터 템플릿을 저장하고 관리합니다.
 * 가족 구성원 타입별로 분류되며, 프로필 생성 시 자동으로 적용될 수 있습니다.
 */
export const financialLibraryService = {
  /**
   * 재무 라이브러리 템플릿 생성
   * @param {Object} templateData - 템플릿 데이터
   * @returns {String} 생성된 문서 ID
   */
  async createTemplate(templateData) {
    try {
      const docRef = await addDoc(collection(db, "financialLibrary"), {
        ...templateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      console.error("재무 라이브러리 템플릿 생성 오류:", error);
      throw error;
    }
  },

  /**
   * 재무 라이브러리 템플릿 추가 (createTemplate의 별칭)
   * @param {Object} templateData - 템플릿 데이터
   * @returns {String} 생성된 문서 ID
   */
  async addTemplate(templateData) {
    return this.createTemplate(templateData);
  },

  /**
   * 모든 재무 라이브러리 템플릿 조회
   * @returns {Array} 템플릿 배열
   */
  async getTemplates() {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "financialLibrary"), orderBy("createdAt", "asc"))
      );
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("재무 라이브러리 템플릿 조회 오류:", error);
      throw error;
    }
  },

  /**
   * 가족 구성원 타입별 템플릿 조회
   * @param {String} familyMemberType - 가족 구성원 타입 (self/spouse/child/parent/common)
   * @returns {Array} 해당 타입의 템플릿 배열
   */
  async getTemplatesByFamilyType(familyMemberType) {
    try {
      const q = query(
        collection(db, "financialLibrary"),
        where("familyMemberType", "==", familyMemberType),
        orderBy("category", "asc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("가족 구성원 타입별 템플릿 조회 오류:", error);
      throw error;
    }
  },

  /**
   * 자동 적용 템플릿 조회 (프로필 생성 시 자동으로 추가되는 템플릿)
   * @returns {Array} autoApply가 true인 템플릿 배열
   */
  async getAutoApplyTemplates() {
    try {
      const q = query(
        collection(db, "financialLibrary"),
        where("autoApply", "==", true)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("자동 적용 템플릿 조회 오류:", error);
      throw error;
    }
  },

  /**
   * 재무 라이브러리 템플릿 수정
   * @param {String} templateId - 템플릿 ID
   * @param {Object} updateData - 수정할 데이터
   */
  async updateTemplate(templateId, updateData) {
    try {
      const docRef = doc(db, "financialLibrary", templateId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("재무 라이브러리 템플릿 수정 오류:", error);
      throw error;
    }
  },

  /**
   * 재무 라이브러리 템플릿 삭제
   * @param {String} templateId - 템플릿 ID
   */
  async deleteTemplate(templateId) {
    try {
      const docRef = doc(db, "financialLibrary", templateId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("재무 라이브러리 템플릿 삭제 오류:", error);
      throw error;
    }
  },

  /**
   * 기본 재무 라이브러리 템플릿 초기화
   * Firebase에 기본 템플릿이 없을 때 초기화합니다.
   */
  async initializeDefaultTemplates() {
    try {
      const existing = await this.getTemplates();
      if (existing.length > 0) {
        return;
      }

      // 기본 템플릿 데이터
      const defaultTemplates = [
        // 본인 (self) 관련
        {
          title: "월급여",
          category: "income",
          familyMemberType: "self",
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            amount: 300,
            frequency: "monthly",
            growthRate: 3.3,
            memo: "기본 급여",
            originalAmount: 300,
            originalFrequency: "monthly",
          },
        },
        {
          title: "상여금",
          category: "income",
          familyMemberType: "self",
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            amount: 2000,
            frequency: "yearly",
            growthRate: 3.3,
            memo: "연간 상여금",
            originalAmount: 2000,
            originalFrequency: "yearly",
          },
        },
        // 자녀 (child) 관련
        {
          title: "대학 등록금",
          category: "expense",
          familyMemberType: "child",
          ageStart: 19,
          ageEnd: 22,
          autoApply: true,
          data: {
            amount: 1000,
            frequency: "yearly",
            growthRate: 2.0,
            memo: "대학 4년 등록금",
          },
        },
        {
          title: "자녀 용돈",
          category: "expense",
          familyMemberType: "child",
          ageStart: 13,
          ageEnd: 18,
          autoApply: false,
          data: {
            amount: 30,
            frequency: "monthly",
            growthRate: 2.0,
            memo: "중고등학생 용돈",
          },
        },
        {
          title: "자녀 결혼자금",
          category: "expense",
          familyMemberType: "child",
          ageStart: 30,
          ageEnd: 30,
          autoApply: false,
          data: {
            amount: 5000,
            frequency: "onetime",
            growthRate: 0,
            memo: "자녀 결혼 지원금",
          },
        },
        {
          title: "자녀 학원비",
          category: "expense",
          familyMemberType: "child",
          ageStart: 7,
          ageEnd: 18,
          autoApply: false,
          data: {
            amount: 50,
            frequency: "monthly",
            growthRate: 2.0,
            memo: "초중고 학원비",
          },
        },
        // 공통 (common) 관련
        {
          title: "생활비",
          category: "expense",
          familyMemberType: "common",
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            amount: 200,
            frequency: "monthly",
            growthRate: 1.89,
            memo: "월 생활비",
            isFixedToRetirementYear: false,
          },
        },
        {
          title: "보험료",
          category: "expense",
          familyMemberType: "common",
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            amount: 50,
            frequency: "monthly",
            growthRate: 1.89,
            memo: "월 보험료",
            isFixedToRetirementYear: false,
          },
        },
        // 저축/투자 템플릿
        {
          title: "S&P500 ETF 월 적립",
          category: "saving",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            savingType: "standard",
            frequency: "monthly",
            amount: 100,
            currentAmount: 0,
            interestRate: "7.0", // 미국 S&P500 장기 평균 수익률
            yearlyGrowthRate: "1.89",
            memo: "미국 S&P500 지수 추종 ETF 월 적립\n수익률: 7% (장기 평균)",
          },
        },
        {
          title: "국내 주식형 펀드",
          category: "saving",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            savingType: "standard",
            frequency: "monthly",
            amount: 50,
            currentAmount: 0,
            interestRate: "5.0",
            yearlyGrowthRate: "1.89",
            memo: "국내 주식형 펀드 월 적립\n수익률: 5% (보수적 추정)",
          },
        },
        {
          title: "은행 정기 적금",
          category: "saving",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            savingType: "standard",
            frequency: "monthly",
            amount: 100,
            currentAmount: 0,
            interestRate: "2.86",
            yearlyGrowthRate: "0",
            memo: "은행 정기 적금\n수익률: 2.86% (평균 금리)",
          },
        },
        {
          title: "채권형 펀드 (안정형)",
          category: "saving",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            savingType: "standard",
            frequency: "monthly",
            amount: 50,
            currentAmount: 0,
            interestRate: "3.5",
            yearlyGrowthRate: "0",
            memo: "채권형 펀드 (안정형)\n수익률: 3.5%",
          },
        },
        // 연금 템플릿
        {
          title: "국민연금",
          category: "pension",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            type: "national",
            monthlyAmount: 150,
            inflationRate: 1.89,
            memo: "국민연금\n물가상승률: 1.89%",
          },
        },
        {
          title: "퇴직연금 (DC형)",
          category: "pension",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            type: "retirement",
            currentAmount: 5000,
            monthlyContribution: 50,
            returnRate: 2.86,
            memo: "퇴직연금 DC형\n연평균 수익률: 2.86%",
          },
        },
        {
          title: "개인연금 (연금저축)",
          category: "pension",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            type: "personal",
            currentAmount: 2000,
            monthlyContribution: 50,
            returnRate: 2.86,
            memo: "개인연금 연금저축\n연평균 수익률: 2.86%\n연 최대 900만원 세액공제",
          },
        },
        {
          title: "퇴직금/DB형",
          category: "pension",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            type: "severance",
            currentAmount: 10000,
            returnRate: 2.86,
            memo: "퇴직금/DB형\n연평균 수익률: 2.86%",
          },
        },
        {
          title: "IRP (개인형 퇴직연금)",
          category: "pension",
          familyMemberType: ["self", "spouse"],
          ageStart: null,
          ageEnd: null,
          autoApply: false,
          data: {
            type: "personal",
            currentAmount: 1000,
            monthlyContribution: 30,
            returnRate: 2.86,
            memo: "IRP 개인형 퇴직연금\n연평균 수익률: 2.86%\n연 최대 900만원 세액공제 (연금저축 포함)",
          },
        },
      ];

      // 모든 템플릿 생성
      for (const template of defaultTemplates) {
        await this.createTemplate(template);
      }
    } catch (error) {
      console.error("기본 재무 라이브러리 템플릿 초기화 오류:", error);
      throw error;
    }
  },
};

/**
 * 전역 설정 서비스
 * globalSettings 컬렉션에 단일 문서 "defaults"로 관리
 */
export const globalSettingsService = {
  // 기본 설정값
  defaultSettings: {
    defaultInflationRate: "1.89", // 물가 상승률 기본값 (지출, 국민연금)
    defaultIncomeGrowthRate: "3.3", // 소득 상승률 기본값
    defaultInvestmentReturnRate: "2.86", // 투자 수익률 기본값 (저축/투자, 퇴직/개인연금)
    defaultSavingGrowthRate: "1.89", // 저축금액 증가율 기본값
    defaultIncomeRate: "3", // 연간 수익률 (배당, 이자 등) 기본값 (수익형 저축/투자, 수익형 자산)
    defaultRealEstateGrowthRate: "2.4", // 부동산 연평균 가치 상승률 기본값
    defaultAssetGrowthRate: "2.86", // 자산 연평균 가치 상승률 기본값
    defaultDebtInterestRate: "3.5", // 부채 이자율 기본값
  },

  // 전역 설정 조회
  async getSettings() {
    try {
      const docRef = doc(db, "globalSettings", "defaults");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { ...this.defaultSettings, ...docSnap.data() };
      }

      // 문서가 없으면 기본값 반환
      return this.defaultSettings;
    } catch (error) {
      console.error("전역 설정 조회 오류:", error);
      return this.defaultSettings;
    }
  },

  // 전역 설정 업데이트
  async updateSettings(settings) {
    try {
      const docRef = doc(db, "globalSettings", "defaults");
      await setDoc(
        docRef,
        {
          ...settings,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return { ...this.defaultSettings, ...settings };
    } catch (error) {
      console.error("전역 설정 업데이트 오류:", error);
      throw new Error("설정 저장 중 오류가 발생했습니다: " + error.message);
    }
  },
};

// 앱 버전 서비스
export const versionService = {
  // 버전 업데이트 (배포 시 호출)
  async updateVersion(version) {
    try {
      const docRef = doc(db, "settings", "appVersion");
      await setDoc(docRef, {
        version: version,
        updatedAt: new Date().toISOString(),
      });
      console.log(`앱 버전이 ${version}으로 업데이트되었습니다.`);
      return true;
    } catch (error) {
      console.error("버전 업데이트 오류:", error);
      throw new Error("버전 업데이트 중 오류가 발생했습니다: " + error.message);
    }
  },

  // 현재 Firebase 버전 조회
  async getVersion() {
    try {
      const docRef = doc(db, "settings", "appVersion");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().version;
      }
      return null;
    } catch (error) {
      console.error("버전 조회 오류:", error);
      return null;
    }
  },
};

/**
 * AI 프롬프트 설정 서비스
 * settings 컬렉션에 "aiPrompts" 문서로 관리
 */
export const aiPromptService = {
  // 기본 프롬프트 설정값
  defaultPrompts: {
    singlePrompt: `아래 제공된 **연도별 재무데이터(소득·지출·자산·부채·이벤트·연금 등)**를 기반으로 총 60~90분 상담 구성에 맞게 자동 생성해야 하는 상담 내용입니다.
:느낌표: 반드시 준수
	•	확인되지 않은 사실 금지
	•	숫자는 제공 데이터 기반 계산
	•	설명은 짧고 명확하게
	•	과장 금지
	•	한국 세제·연금 규정 반영
	•	1~1.5시간 내 소비 가능한 분량으로 구성
	•	중요도 기반으로 핵심 포인트를 앞쪽에 배치
⸻
:다트: [최종 출력 요구: 1~1.5시간 상담 보고서]
⸻
## A. 상태 진단 프로그램 (30~45분)
⸻
1) 은퇴 준비 상태 진단 (15~20분)
1.1 목표 확인 및 데이터 검증 (3분)
	•	목표 은퇴연령
	•	목표 자산
	•	목표 월 현금흐름
	•	기타 목표 이벤트(자녀/의료비/이주/자동차/기타)
	•	입력 데이터 정확성 및 누락사항 보완
	•	시뮬레이션 기본 가정 안내
	•	수익률/자산 매도 여부
	•	부채 상환 기본값
	•	연금 수령구조 기본값
	•	물가·임금 상승률
1.2 은퇴 자산 준비율 진단 (5~8분)
	•	현재 상태 유지 시 은퇴 시점 예상 자산
	•	목표 대비 달성률(%)
	•	저축률·성장률 적정성
	•	필요한 수익률/저축률 제안
	•	간단한 리스크 언급(자산 성장 속도, 부채 등)
1.3 은퇴 현금흐름 준비율 진단 (7~9분)
	•	예상 은퇴 후 연간/월간 현금흐름
	•	총공급 vs 총수요 비교
	•	목표 대비 충족률
	•	4%룰/정적 인출 기반 자산 유지기간
	•	취약 지점 및 개선 필요 요소
⸻
2) 현재 가계 재무현황 진단 (10~15분)
2.1 자산 현황 브리핑 (5분)
	•	전체 자산 구성
	•	유동성·비상자금
	•	부채 구조 및 만기 리스크
2.2 현금흐름 브리핑 (5~10분)
	•	소득 대비 순현금흐름
	•	저축 가능액 및 저축률
	•	현금 고갈 포인트(있을 경우)
⸻
3) 소득·지출 패턴 분석 및 관리방안 (10~15분)
3.1 소득 구조 (3분)
	•	근로·사업·기타 소득 구성
	•	향후 소득 이벤트(퇴직·이직·임대 종료 등)
	•	연령대별 소득 패턴 전망
3.2 지출 패턴 분석 (5~7분)
	•	고정비·변동비 비중
	•	과다 카테고리
	•	일회성 이벤트 분리
	•	평균 대비 포지션
3.3 개선 전략 (3~5분)
	•	고정비·변동비 조정
	•	선저축·후지출 습관
	•	이벤트 비용 관리
⸻
4) 은퇴 리스크 진단 (5분)
	•	장수 리스크
	•	의료비 리스크
	•	돌발비용 리스크
	•	부채·금리 리스크
	•	리스크별 해결 전략 2~3개씩 제시
⸻
## B. 목표 기반 설계 (25~35분)
⸻
1) 은퇴 후 현금흐름 목표 달성 전략 (10~15분)
	•	목표 지출 vs 실제 인출 가능액
	•	예상 부족액
	•	부족 자금 해결 전략
	•	지출 조정
	•	저축률 조정
	•	목표 조정
	•	수익률 상향 (현실적 범위 내)
	•	중요한 이벤트(자녀, 이주, 의료비) 반영
⸻
2) 은퇴 시점 목표 자산 달성 전략 (7~10분)
	•	목표 자산 대비 격차
	•	연간 필요 저축·투자금액
	•	필요한 수익률 제시
	•	"이 수준이면 충분 / 부족"의 명확한 판단
⸻
3) 투자(자산운용) 진단 (8~10분)
3.1 현재 포트폴리오 스냅샷
	•	자산군 구성
	•	상품 분산도·리스크 요인
3.2 적합성·리스크 구조 평가
	•	현재 위험 대비 기대수익 성과
	•	백테스트 기반 간단한 성과 리뷰(사팔사팔 습관 점검 가능)
3.3 은퇴 목표 대비 적정성 판단
3.4 간단한 포트폴리오 제안 + 즉시 액션 3~5개

## 💡 중요: 금액 단위 안내
**우리는 만원 단위를 사용합니다.**
- 1000 = 1,000만원 (1천만원)
- 10000 = 1억원 (1억원)
- 예: amount가 5000이면 → 5,000만원 (5천만원)`,
    comparePrompt: `당신은 20년 경력의 전문 재무 상담사입니다. 두 가지 재무 시뮬레이션을 비교 분석하여 상세한 재무 상담과 구체적인 액션 플랜을 제시해주세요.

## 비교 분석 요청사항

### 1. 두 시뮬레이션 차이점 분석
- A와 B의 주요 차이점 3가지 요약
- 각 시뮬레이션의 현금흐름 패턴 비교
- 은퇴 후 현금흐름 지속 가능성 비교

### 2. 자산 구조 비교
- A와 B의 자산 구성 비교
- 목표 자산 달성 가능성과 시점 비교
- 각 시뮬레이션의 리스크 수준 비교

### 3. 장단점 분석
- A 시뮬레이션의 장점과 단점
- B 시뮬레이션의 장점과 단점
- 어떤 시뮬레이션이 더 적합한지 판단

### 4. 권장 사항
- 두 시뮬레이션 중 어느 것을 선택하는 것이 좋은지
- 선택한 시뮬레이션에서 개선할 점
- 구체적인 액션 플랜 (금액과 시점 포함)

### 5. 시나리오별 대응
- 각 시뮬레이션에서 최악/최선의 시나리오 비교
- 리스크 관리 방안 비교

## 출력 형식
1. **시뮬레이션 비교 요약** (3-4줄)
2. **주요 차이점 3가지** (우선순위별)
3. **각 시뮬레이션 장단점**
4. **권장 시뮬레이션 및 이유**
5. **개선 방안 및 액션 플랜** (구체적 금액과 방법)
6. **위험 관리 방안 비교**
7. **예상 결과 비교** (구체적 수치로)

모든 제안은 한국의 금융 환경과 세제를 고려하여 현실적이고 실행 가능한 수준으로 제시해주세요.

## 💡 중요: 금액 단위 안내
**우리는 만원 단위를 사용합니다.**
- 1000 = 1,000만원 (1천만원)
- 10000 = 1억원 (1억원)
- 예: amount가 5000이면 → 5,000만원 (5천만원)`,
  },

  // AI 프롬프트 설정 조회
  async getPrompts() {
    try {
      const docRef = doc(db, "settings", "aiPrompts");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { ...this.defaultPrompts, ...docSnap.data() };
      }

      // 문서가 없으면 기본값 반환
      return this.defaultPrompts;
    } catch (error) {
      console.error("AI 프롬프트 조회 오류:", error);
      return this.defaultPrompts;
    }
  },

  // AI 프롬프트 설정 업데이트
  async updatePrompts(prompts) {
    try {
      const docRef = doc(db, "settings", "aiPrompts");
      await setDoc(
        docRef,
        {
          ...prompts,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return { ...this.defaultPrompts, ...prompts };
    } catch (error) {
      console.error("AI 프롬프트 업데이트 오류:", error);
      throw new Error(
        "AI 프롬프트 저장 중 오류가 발생했습니다: " + error.message
      );
    }
  },
};
