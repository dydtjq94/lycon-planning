import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWaitlistNotification } from "@/lib/services/slackService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "전화번호가 필요합니다." },
        { status: 400 },
      );
    }

    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10 || cleaned.length > 11) {
      return NextResponse.json(
        { error: "올바른 전화번호 형식이 아닙니다." },
        { status: 400 },
      );
    }

    // Supabase에 저장 + 카운터 증가
    const { error } = await supabase.rpc("submit_landing_waitlist", {
      p_phone: cleaned,
    });

    if (error) {
      console.error("Supabase waitlist error:", error);
    }

    // Slack 알림
    await sendWaitlistNotification({ phone: cleaned });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist API error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
