// Slack 알림 서비스

const SLACK_WEBHOOK_URL = process.env.SLACK_BOOKING_WEBHOOK_URL;

interface BookingNotificationData {
  userName: string;
  userPhone: string;
  bookingDate: string;
  bookingTime: string;
  userBirthYear?: string;
  userGender?: string;
}

export async function sendBookingConfirmedNotification(
  data: BookingNotificationData
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_BOOKING_WEBHOOK_URL not configured");
    return;
  }

  const { userName, userPhone, bookingDate, bookingTime, userBirthYear, userGender } = data;

  // 날짜 포맷팅
  const date = new Date(bookingDate);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const formattedDate = `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`;

  // 유저 정보 조합
  let userInfo = userName;
  if (userBirthYear) userInfo += ` ${userBirthYear}년생`;
  if (userGender) userInfo += ` ${userGender === "male" ? "남" : "여"}`;

  const message = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "새 예약이 확정되었습니다",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*고객*\n${userInfo}`,
          },
          {
            type: "mrkdwn",
            text: `*연락처*\n${userPhone}`,
          },
          {
            type: "mrkdwn",
            text: `*예약 일시*\n${formattedDate} ${bookingTime}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error("Slack notification failed:", response.status);
    }
  } catch (error) {
    console.error("Slack notification error:", error);
  }
}
