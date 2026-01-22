import { createClient } from "@/lib/supabase/client";

export interface FamilyMember {
  id: string;
  user_id: string;
  relationship: "self" | "spouse" | "child" | "parent";
  name: string;
  birth_date: string | null;
  gender: "male" | "female" | null;
  is_dependent: boolean;
  is_working: boolean;
  retirement_age: number | null;
  monthly_income: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FamilyMemberInput = Omit<FamilyMember, "id" | "created_at" | "updated_at">;

export const RELATIONSHIP_LABELS: Record<string, string> = {
  self: "본인",
  spouse: "배우자",
  child: "자녀",
  parent: "부양가족",
};

export async function getFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", userId)
    .order("relationship", { ascending: true });

  if (error) {
    console.error("Error fetching family members:", error);
    return [];
  }

  // Sort order: self -> spouse -> child -> parent
  const order = ["self", "spouse", "child", "parent"];
  return (data || []).sort((a, b) => {
    return order.indexOf(a.relationship) - order.indexOf(b.relationship);
  });
}

export async function createFamilyMember(input: FamilyMemberInput): Promise<FamilyMember | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("family_members")
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("Error creating family member - raw:", error);
    console.error("Error creating family member - stringified:", JSON.stringify(error, null, 2));
    console.error("Input was:", JSON.stringify(input, null, 2));
    return null;
  }

  return data;
}

export async function updateFamilyMember(
  id: string,
  updates: Partial<FamilyMemberInput>
): Promise<FamilyMember | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("family_members")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating family member:", error);
    return null;
  }

  return data;
}

export async function deleteFamilyMember(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("family_members")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting family member:", error);
    return false;
  }

  return true;
}

// 본인 정보가 없으면 profiles에서 가져와서 생성
export async function ensureSelfExists(userId: string): Promise<FamilyMember | null> {
  const members = await getFamilyMembers(userId);
  const self = members.find(m => m.relationship === "self");

  if (self) return self;

  // profiles에서 정보 가져오기
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, birth_date, gender")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  return createFamilyMember({
    user_id: userId,
    relationship: "self",
    name: profile.name || "본인",
    birth_date: profile.birth_date,
    gender: profile.gender as "male" | "female" | null,
    is_dependent: false,
    is_working: true,
    retirement_age: 60,
    monthly_income: 0,
    notes: null,
  });
}
