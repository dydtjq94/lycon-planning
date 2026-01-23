import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId, opinion } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
    }

    // 서비스 롤 클라이언트 사용 (RLS 우회)
    const supabase = createServiceClient();

    // 1. 사용자 정보 조회 (이름, 전화번호)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, phone_number")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "프로필을 찾을 수 없습니다" }, { status: 404 });
    }

    if (!profile.phone_number) {
      return NextResponse.json({ error: "사용자 전화번호가 없습니다" }, { status: 400 });
    }

    // 2. 보고서 발행 상태 업데이트 (소견 포함)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        report_published_at: new Date().toISOString(),
        customer_stage: "report_delivered",
        report_opinion: opinion || null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("보고서 발행 상태 업데이트 실패:", updateError);
      return NextResponse.json({ error: "보고서 발행 실패" }, { status: 500 });
    }

    // 3. SMS 발송 (FastAPI 통해)
    const FASTAPI_URL = process.env.FASTAPI_URL;

    if (FASTAPI_URL) {
      try {
        const smsResponse = await fetch(`${FASTAPI_URL}/sms/send-report-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: profile.phone_number,
            customer_name: profile.name || "고객",
          }),
        });

        const smsResult = await smsResponse.json();

        if (!smsResult.success) {
          console.error("SMS 발송 실패:", smsResult);
          // SMS 실패해도 보고서 발행은 성공으로 처리
        }
      } catch (smsError) {
        console.error("SMS 발송 오류:", smsError);
        // SMS 실패해도 보고서 발행은 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      message: "보고서가 발행되었습니다.",
    });
  } catch (error) {
    console.error("보고서 발행 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
