import { createServiceClient } from "@/lib/supabase/service";
import { sendNewMessageNotification } from "@/lib/services/slackService";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 유저 정보 조회
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, phone_number")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 예약 정보 조회
    const { data: booking } = await supabase
      .from("bookings")
      .select("booking_date, booking_time, consultation_type")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .order("booking_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Slack 알림 발송
    await sendNewMessageNotification({
      userId,
      userName: profile.name || "고객",
      userPhone: profile.phone_number || undefined,
      bookingDate: booking?.booking_date,
      bookingTime: booking?.booking_time,
      programName: booking?.consultation_type,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Slack notification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
