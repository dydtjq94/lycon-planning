// 데이터 마이그레이션 유틸리티
// 기존 구조에서 새로운 시뮬레이션 기반 구조로 데이터를 마이그레이션합니다.

import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
} from "firebase/firestore";
import { db } from "../libs/firebase.js";
import { simulationService } from "../services/simulationService.js";

/**
 * 단일 프로필의 데이터를 새 구조로 마이그레이션
 *
 * 기존 구조:
 * profiles/{profileId}/{subcollection}
 *
 * 새 구조:
 * profiles/{profileId}/simulations/{simulationId}/{subcollection}
 *
 * @param {string} profileId - 마이그레이션할 프로필 ID
 * @returns {Promise<object>} - 마이그레이션 결과
 */
export async function migrateProfileData(profileId) {
  console.log(`[마이그레이션] 프로필 ${profileId} 마이그레이션 시작`);

  try {
    // 1. 기존 시뮬레이션이 있는지 확인
    const existingSimulations = await simulationService.getSimulations(
      profileId
    );

    if (existingSimulations.length > 0) {
      console.log(
        `[마이그레이션] 이미 시뮬레이션이 존재합니다. (${existingSimulations.length}개)`
      );
      return {
        success: false,
        message: "이미 마이그레이션된 프로필입니다.",
        simulationCount: existingSimulations.length,
      };
    }

    // 2. 기본 시뮬레이션("현재") 생성
    console.log("[마이그레이션] 기본 시뮬레이션 생성 중...");
    const defaultSimulationId = await simulationService.createSimulation(
      profileId,
      {
        title: "현재",
        isDefault: true,
      }
    );
    console.log(
      `[마이그레이션] 기본 시뮬레이션 생성 완료: ${defaultSimulationId}`
    );

    // 3. 기존 하위 컬렉션 데이터를 새 시뮬레이션으로 복사
    const subcollections = [
      "incomes",
      "expenses",
      "savings",
      "pensions",
      "realEstates",
      "assets",
      "debts",
    ];

    let totalMigrated = 0;
    const migrationResults = {};

    for (const subcollectionName of subcollections) {
      try {
        const count = await migrateSubcollection(
          profileId,
          defaultSimulationId,
          subcollectionName
        );
        migrationResults[subcollectionName] = count;
        totalMigrated += count;
        console.log(
          `[마이그레이션] ${subcollectionName}: ${count}개 마이그레이션 완료`
        );
      } catch (error) {
        console.error(
          `[마이그레이션] ${subcollectionName} 마이그레이션 오류:`,
          error
        );
        migrationResults[subcollectionName] = { error: error.message };
      }
    }

    console.log(
      `[마이그레이션] 프로필 ${profileId} 마이그레이션 완료: ${totalMigrated}개 문서`
    );

    return {
      success: true,
      message: "마이그레이션이 성공적으로 완료되었습니다.",
      defaultSimulationId,
      totalMigrated,
      details: migrationResults,
    };
  } catch (error) {
    console.error(
      `[마이그레이션] 프로필 ${profileId} 마이그레이션 오류:`,
      error
    );
    return {
      success: false,
      message: "마이그레이션 중 오류가 발생했습니다: " + error.message,
      error: error,
    };
  }
}

/**
 * 하위 컬렉션 데이터를 마이그레이션
 *
 * @param {string} profileId - 프로필 ID
 * @param {string} simulationId - 시뮬레이션 ID
 * @param {string} subcollectionName - 하위 컬렉션 이름
 * @returns {Promise<number>} - 마이그레이션된 문서 개수
 */
async function migrateSubcollection(
  profileId,
  simulationId,
  subcollectionName
) {
  // 기존 경로에서 데이터 조회
  const oldCollectionRef = collection(
    db,
    "profiles",
    profileId,
    subcollectionName
  );
  const snapshot = await getDocs(query(oldCollectionRef));

  if (snapshot.empty) {
    console.log(`[마이그레이션] ${subcollectionName}: 데이터 없음`);
    return 0;
  }

  // 새 경로로 데이터 복사
  const newCollectionRef = collection(
    db,
    "profiles",
    profileId,
    "simulations",
    simulationId,
    subcollectionName
  );

  let count = 0;
  const migrationPromises = snapshot.docs.map(async (oldDoc) => {
    const data = oldDoc.data();
    // 새 경로에 데이터 추가
    await addDoc(newCollectionRef, data);
    count++;
  });

  await Promise.all(migrationPromises);

  // 기존 데이터 삭제 (선택사항 - 백업을 위해 주석 처리할 수 있음)
  // const deletePromises = snapshot.docs.map((oldDoc) => deleteDoc(oldDoc.ref));
  // await Promise.all(deletePromises);
  // console.log(`[마이그레이션] ${subcollectionName}: 기존 데이터 삭제 완료`);

  return count;
}

/**
 * 모든 프로필을 마이그레이션
 *
 * @returns {Promise<object>} - 전체 마이그레이션 결과
 */
export async function migrateAllProfiles() {
  console.log("[마이그레이션] 전체 프로필 마이그레이션 시작");

  try {
    // 모든 프로필 조회
    const profilesRef = collection(db, "profiles");
    const profilesSnapshot = await getDocs(profilesRef);

    console.log(
      `[마이그레이션] 총 ${profilesSnapshot.docs.length}개 프로필 발견`
    );

    const results = [];

    for (const profileDoc of profilesSnapshot.docs) {
      const profileId = profileDoc.id;
      const result = await migrateProfileData(profileId);
      results.push({
        profileId,
        ...result,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    console.log(
      `[마이그레이션] 전체 마이그레이션 완료: 성공 ${successCount}개, 실패 ${failCount}개`
    );

    return {
      success: true,
      totalProfiles: results.length,
      successCount,
      failCount,
      results,
    };
  } catch (error) {
    console.error("[마이그레이션] 전체 마이그레이션 오류:", error);
    return {
      success: false,
      message: "전체 마이그레이션 중 오류가 발생했습니다: " + error.message,
      error: error,
    };
  }
}

/**
 * 마이그레이션 상태 확인
 *
 * @param {string} profileId - 확인할 프로필 ID
 * @returns {Promise<object>} - 마이그레이션 상태
 */
export async function checkMigrationStatus(profileId) {
  try {
    // 시뮬레이션 존재 여부 확인
    const simulations = await simulationService.getSimulations(profileId);

    if (simulations.length > 0) {
      return {
        migrated: true,
        simulationCount: simulations.length,
        simulations: simulations.map((s) => ({
          id: s.id,
          title: s.title,
          isDefault: s.isDefault,
        })),
      };
    }

    // 기존 데이터 존재 여부 확인
    const subcollections = [
      "incomes",
      "expenses",
      "savings",
      "pensions",
      "realEstates",
      "assets",
      "debts",
    ];
    const oldDataCounts = {};
    let totalOldData = 0;

    for (const subcollectionName of subcollections) {
      const collectionRef = collection(
        db,
        "profiles",
        profileId,
        subcollectionName
      );
      const snapshot = await getDocs(collectionRef);
      oldDataCounts[subcollectionName] = snapshot.docs.length;
      totalOldData += snapshot.docs.length;
    }

    return {
      migrated: false,
      needsMigration: totalOldData > 0,
      oldDataCounts,
      totalOldData,
    };
  } catch (error) {
    console.error("[마이그레이션] 상태 확인 오류:", error);
    return {
      error: true,
      message: error.message,
    };
  }
}
