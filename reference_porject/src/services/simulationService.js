// 시뮬레이션 서비스 - 시뮬레이션 탭 관리
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
  writeBatch,
} from "firebase/firestore";
import { db } from "../libs/firebase.js";

/**
 * 시뮬레이션 관련 서비스
 * 각 프로필은 여러 시뮬레이션 탭을 가질 수 있으며,
 * 각 시뮬레이션은 독립적인 재무 데이터를 가집니다.
 */
export const simulationService = {
  /**
   * 시뮬레이션 생성
   * @param {string} profileId - 프로필 ID
   * @param {object} simulationData - 시뮬레이션 데이터 {title, isDefault}
   * @returns {Promise<string>} - 생성된 시뮬레이션 ID
   */
  async createSimulation(profileId, simulationData) {
    try {
      // 현재 시뮬레이션 개수 확인하여 order 결정
      const existingSimulations = await this.getSimulations(profileId);
      const maxOrder = existingSimulations.reduce(
        (max, sim) => Math.max(max, sim.order || 0),
        -1
      );

      const docRef = await addDoc(
        collection(db, "profiles", profileId, "simulations"),
        {
          title: simulationData.title || "새 시뮬레이션",
          isDefault: simulationData.isDefault || false,
          order: maxOrder + 1,
          memo: simulationData.memo || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );

      return docRef.id;
    } catch (error) {
      console.error("시뮬레이션 생성 오류:", error);
      throw new Error(
        "시뮬레이션 생성 중 오류가 발생했습니다: " + error.message
      );
    }
  },

  /**
   * 프로필의 모든 시뮬레이션 조회
   * @param {string} profileId - 프로필 ID
   * @returns {Promise<Array>} - 시뮬레이션 목록
   */
  async getSimulations(profileId) {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, "profiles", profileId, "simulations"),
          orderBy("order", "asc")
        )
      );

      const simulations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return simulations;
    } catch (error) {
      console.error("시뮬레이션 조회 오류:", error);
      throw error;
    }
  },

  /**
   * 특정 시뮬레이션 조회
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @returns {Promise<object>} - 시뮬레이션 데이터
   */
  async getSimulation(profileId, simulationId) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId
      );
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("시뮬레이션을 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("시뮬레이션 조회 오류:", error);
      throw error;
    }
  },

  /**
   * 기본 시뮬레이션 조회 (isDefault: true)
   * @param {string} profileId - 프로필 ID
   * @returns {Promise<object|null>} - 기본 시뮬레이션 데이터
   */
  async getDefaultSimulation(profileId) {
    try {
      const simulations = await this.getSimulations(profileId);
      const defaultSim = simulations.find((sim) => sim.isDefault === true);
      return defaultSim || null;
    } catch (error) {
      console.error("기본 시뮬레이션 조회 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션 업데이트
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @param {object} updateData - 업데이트할 데이터
   */
  async updateSimulation(profileId, simulationId, updateData) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId
      );
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("시뮬레이션 업데이트 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션 삭제
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   */
  async deleteSimulation(profileId, simulationId) {
    try {
      // 기본 시뮬레이션은 삭제 불가
      const simulation = await this.getSimulation(profileId, simulationId);
      if (simulation.isDefault) {
        throw new Error("기본 시뮬레이션('현재')은 삭제할 수 없습니다.");
      }

      // 모든 하위 컬렉션 삭제
      await this.deleteAllSimulationData(profileId, simulationId);

      // 시뮬레이션 문서 삭제
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error("시뮬레이션 삭제 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션의 모든 하위 컬렉션 데이터 삭제
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   */
  async deleteAllSimulationData(profileId, simulationId) {
    try {
      const subcollections = [
        "incomes",
        "expenses",
        "savings",
        "pensions",
        "realEstates",
        "assets",
        "debts",
      ];

      let totalDeleted = 0;
      for (const subcollectionName of subcollections) {
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
          const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          totalDeleted += snapshot.docs.length;
        }
      }

      return totalDeleted;
    } catch (error) {
      console.error("시뮬레이션 하위 데이터 삭제 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션 복사 (현재 시뮬레이션의 모든 데이터를 새 시뮬레이션으로 복사)
   * @param {string} profileId - 프로필 ID
   * @param {string} sourceSimulationId - 복사할 원본 시뮬레이션 ID
   * @param {string} newTitle - 새 시뮬레이션 제목
   * @returns {Promise<string>} - 생성된 시뮬레이션 ID
   */
  async copySimulation(profileId, sourceSimulationId, newTitle) {
    try {
      const sourceSimulation = await this.getSimulation(
        profileId,
        sourceSimulationId
      );

      // 1. 새 시뮬레이션 생성
      const newSimulationId = await this.createSimulation(profileId, {
        title: newTitle,
        isDefault: false,
        memo: sourceSimulation?.memo || "",
      });

      // 1-1. 은퇴년도, 배우자 은퇴년도, 투자 규칙 복사 (원본 시뮬레이션에서)
      const updateData = {};
      if (sourceSimulation.retirementYear !== undefined) {
        updateData.retirementYear = sourceSimulation.retirementYear;
      }
      if (sourceSimulation.spouseRetirementYear !== undefined) {
        updateData.spouseRetirementYear = sourceSimulation.spouseRetirementYear;
      }
      if (sourceSimulation.cashflowInvestmentRules) {
        updateData.cashflowInvestmentRules =
          sourceSimulation.cashflowInvestmentRules;
      }
      if (Object.keys(updateData).length > 0) {
        await this.updateSimulation(profileId, newSimulationId, updateData);
      }

      // 2. 원본 시뮬레이션의 모든 하위 컬렉션 데이터 복사
      const subcollections = [
        "incomes",
        "expenses",
        "savings",
        "pensions",
        "realEstates",
        "assets",
        "debts",
      ];

      let totalCopied = 0;
      for (const subcollectionName of subcollections) {
        const count = await this.copySubcollection(
          profileId,
          sourceSimulationId,
          newSimulationId,
          subcollectionName
        );
        totalCopied += count;
      }

      return newSimulationId;
    } catch (error) {
      console.error("시뮬레이션 복사 오류:", error);
      throw new Error(
        "시뮬레이션 복사 중 오류가 발생했습니다: " + error.message
      );
    }
  },

  /**
   * 하위 컬렉션 복사
   * @param {string} profileId - 프로필 ID
   * @param {string} sourceSimulationId - 원본 시뮬레이션 ID
   * @param {string} targetSimulationId - 대상 시뮬레이션 ID
   * @param {string} subcollectionName - 하위 컬렉션 이름
   * @returns {Promise<number>} - 복사된 문서 개수
   */
  async copySubcollection(
    profileId,
    sourceSimulationId,
    targetSimulationId,
    subcollectionName
  ) {
    try {
      // 원본 하위 컬렉션 데이터 조회 (생성 시간 순으로 정렬)
      const sourceRef = collection(
        db,
        "profiles",
        profileId,
        "simulations",
        sourceSimulationId,
        subcollectionName
      );
      const snapshot = await getDocs(
        query(sourceRef, orderBy("createdAt", "asc"))
      );

      if (snapshot.empty) {
        return 0;
      }

      // Firestore batch 사용 (한 번에 최대 500개)
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((sourceDoc) => {
        // 원본 문서 ID를 그대로 사용하여 대상 문서 생성 → 시뮬레이션 간 동일 ID 유지
        const targetRef = doc(
          db,
          "profiles",
          profileId,
          "simulations",
          targetSimulationId,
          subcollectionName,
          sourceDoc.id
        );

        // 데이터 복사 (createdAt은 원본 유지, updatedAt만 갱신)
        const data = sourceDoc.data();
        batch.set(targetRef, {
          ...data,
          // createdAt은 원본 그대로 유지하여 순서 보장
          updatedAt: new Date().toISOString(),
        });
        count++;
      });

      await batch.commit();
      return count;
    } catch (error) {
      console.error(`${subcollectionName} 복사 오류:`, error);
      throw error;
    }
  },

  /**
   * 시뮬레이션 순서 변경
   * @param {string} profileId - 프로필 ID
   * @param {Array<{id: string, order: number}>} simulationOrders - 시뮬레이션 ID와 순서 배열
   */
  async updateSimulationOrders(profileId, simulationOrders) {
    try {
      const batch = writeBatch(db);

      simulationOrders.forEach(({ id, order }) => {
        const docRef = doc(db, "profiles", profileId, "simulations", id);
        batch.update(docRef, {
          order,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error("시뮬레이션 순서 업데이트 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션의 현금흐름 투자 규칙 업데이트
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @param {object} investmentRules - 투자 규칙 객체 {year: {allocations: [...]}}
   */
  async updateInvestmentRules(profileId, simulationId, investmentRules) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId
      );
      await updateDoc(docRef, {
        cashflowInvestmentRules: investmentRules,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("투자 규칙 업데이트 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션의 현금흐름 투자 규칙 조회
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @returns {Promise<object>} - 투자 규칙 객체
   */
  async getInvestmentRules(profileId, simulationId) {
    try {
      const simulation = await this.getSimulation(profileId, simulationId);
      return simulation.cashflowInvestmentRules || {};
    } catch (error) {
      console.error("투자 규칙 조회 오류:", error);
      return {};
    }
  },

  /**
   * 시뮬레이션의 자산 인출 규칙 업데이트
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @param {object} withdrawalRules - 인출 규칙 객체 {year: {withdrawals: [...]}}
   */
  async updateWithdrawalRules(profileId, simulationId, withdrawalRules) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId
      );
      await updateDoc(docRef, {
        assetWithdrawalRules: withdrawalRules,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("인출 규칙 업데이트 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션의 자산 인출 규칙 조회
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @returns {Promise<object>} - 인출 규칙 객체
   */
  async getWithdrawalRules(profileId, simulationId) {
    try {
      const simulation = await this.getSimulation(profileId, simulationId);
      return simulation.assetWithdrawalRules || {};
    } catch (error) {
      console.error("인출 규칙 조회 오류:", error);
      return {};
    }
  },

  /**
   * 시뮬레이션의 은퇴년도 업데이트
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @param {number} retirementYear - 은퇴년도
   */
  async updateRetirementYear(profileId, simulationId, retirementYear) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId
      );
      await updateDoc(docRef, {
        retirementYear: retirementYear,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("은퇴년도 업데이트 오류:", error);
      throw error;
    }
  },

  /**
   * 시뮬레이션의 배우자 은퇴년도 업데이트
   * @param {string} profileId - 프로필 ID
   * @param {string} simulationId - 시뮬레이션 ID
   * @param {number} spouseRetirementYear - 배우자 은퇴년도
   */
  async updateSpouseRetirementYear(profileId, simulationId, spouseRetirementYear) {
    try {
      const docRef = doc(
        db,
        "profiles",
        profileId,
        "simulations",
        simulationId
      );
      await updateDoc(docRef, {
        spouseRetirementYear: spouseRetirementYear,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("배우자 은퇴년도 업데이트 오류:", error);
      throw error;
    }
  },
};
