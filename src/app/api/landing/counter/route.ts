import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 페이지 방문 시 카운터 증가 + 반환
export async function POST() {
  try {
    const { data, error } = await supabase.rpc("increment_landing_counter");

    if (error) {
      console.error("Counter increment error:", error);
      return NextResponse.json({ count: 0 }, { status: 500 });
    }

    return NextResponse.json({ count: data });
  } catch (error) {
    console.error("Counter API error:", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
