import { createClient } from "@/lib/supabase/client";
import type {
  PrepData,
  PrepCompleted,
  PrepTaskId,
  FamilyMember,
  IncomeItem,
  ExpenseItem,
  AssetItem,
  DebtItem,
  PensionItem,
} from "../types";

const DEFAULT_COMPLETED: PrepCompleted = {
  family: false,
  income: false,
  expense: false,
  asset: false,
  debt: false,
  pension: false,
};

/**
 * 모든 준비사항 데이터를 한번에 로드
 */
export async function loadPrepData(userId: string): Promise<PrepData> {
  const supabase = createClient();

  // 병렬로 모든 데이터 로드
  const [
    profileResult,
    familyResult,
    // TODO: 나머지 테이블들도 추가
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("survey_responses")
      .eq("id", userId)
      .single(),
    supabase
      .from("family_members")
      .select("relationship, name, birth_date, gender")
      .eq("user_id", userId),
  ]);

  // 완료 상태 파싱
  const prepCompleted = profileResult.data?.survey_responses?.prep_completed || {};
  const completed: PrepCompleted = {
    ...DEFAULT_COMPLETED,
    ...prepCompleted,
  };

  return {
    family: (familyResult.data || []) as FamilyMember[],
    income: [], // TODO: 구현
    expense: [], // TODO: 구현
    asset: [], // TODO: 구현
    debt: [], // TODO: 구현
    pension: [], // TODO: 구현
    completed,
  };
}

/**
 * 가족 데이터 저장
 */
export async function saveFamilyData(
  userId: string,
  members: FamilyMember[]
): Promise<void> {
  const supabase = createClient();

  // 1. 기존 데이터 삭제
  await supabase.from("family_members").delete().eq("user_id", userId);

  // 2. 새 데이터 삽입
  if (members.length > 0) {
    const { error } = await supabase.from("family_members").insert(
      members.map((m) => ({
        user_id: userId,
        relationship: m.relationship,
        name: m.name,
        birth_date: m.birth_date,
        gender: m.gender,
      }))
    );
    if (error) throw error;
  }

  // 3. 완료 상태 업데이트
  await markTaskCompleted(userId, "family");
}

/**
 * 태스크 완료 상태 업데이트
 */
export async function markTaskCompleted(
  userId: string,
  taskId: PrepTaskId
): Promise<void> {
  const supabase = createClient();

  // 기존 survey_responses 가져오기
  const { data: profile } = await supabase
    .from("profiles")
    .select("survey_responses")
    .eq("id", userId)
    .single();

  const surveyResponses = profile?.survey_responses || {};
  const prepCompleted = surveyResponses.prep_completed || {};

  // 완료 상태 업데이트
  await supabase
    .from("profiles")
    .update({
      survey_responses: {
        ...surveyResponses,
        prep_completed: {
          ...prepCompleted,
          [taskId]: true,
        },
      },
    })
    .eq("id", userId);
}

/**
 * 완료된 태스크 ID 목록 반환
 */
export function getCompletedTaskIds(completed: PrepCompleted): PrepTaskId[] {
  return (Object.keys(completed) as PrepTaskId[]).filter(
    (key) => completed[key]
  );
}

/**
 * 다음 해야할 태스크 인덱스 반환
 */
export function getNextTaskIndex(completed: PrepCompleted): number {
  const order: PrepTaskId[] = ["family", "income", "expense", "asset", "debt", "pension"];
  for (let i = 0; i < order.length; i++) {
    if (!completed[order[i]]) {
      return i;
    }
  }
  return order.length; // 모두 완료
}
