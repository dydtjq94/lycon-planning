import { createClient } from "@/lib/supabase/client";

interface GuideClickData {
  count: number;
  last_clicked: string;
}

export type GuideClicks = {
  [categoryId: string]: GuideClickData;
};

export async function trackGuideClick(userId: string, categoryId: string): Promise<void> {
  const supabase = createClient();

  // 현재 guide_clicks 가져오기
  const { data: profile } = await supabase
    .from("profiles")
    .select("guide_clicks")
    .eq("id", userId)
    .single();

  const currentClicks: GuideClicks = (profile?.guide_clicks as GuideClicks) || {};

  // 해당 카테고리 클릭 수 증가
  const currentCount = currentClicks[categoryId]?.count || 0;
  currentClicks[categoryId] = {
    count: currentCount + 1,
    last_clicked: new Date().toISOString(),
  };

  // 업데이트
  await supabase
    .from("profiles")
    .update({ guide_clicks: currentClicks })
    .eq("id", userId);
}

export async function getGuideClicks(userId: string): Promise<GuideClicks> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("guide_clicks")
    .eq("id", userId)
    .single();

  return (profile?.guide_clicks as GuideClicks) || {};
}
