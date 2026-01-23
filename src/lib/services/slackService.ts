// Slack 알림 서비스

const SLACK_BOOKING_WEBHOOK_URL = process.env.SLACK_BOOKING_WEBHOOK_URL;
const SLACK_MESSAGE_WEBHOOK_URL = process.env.SLACK_MESSAGE_WEBHOOK_URL;

interface BookingNotificationData {
  userName: string;
  userPhone: string;
  bookingDate: string;
  bookingTime: string;
  userBirthYear?: string;
  userGender?: string;
}

export async function sendBookingConfirmedNotification(
  data: BookingNotificationData,
): Promise<void> {
  if (!SLACK_BOOKING_WEBHOOK_URL) {
    console.warn("SLACK_BOOKING_WEBHOOK_URL not configured");
    return;
  }

  const {
    userName,
    userPhone,
    bookingDate,
    bookingTime,
    userBirthYear,
    userGender,
  } = data;

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
    const response = await fetch(SLACK_BOOKING_WEBHOOK_URL, {
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

// 새 메시지 알림
interface MessageNotificationData {
  userId: string;
  userName: string;
  userPhone?: string;
  bookingDate?: string;
  bookingTime?: string;
  programName?: string;
}

export async function sendNewMessageNotification(
  data: MessageNotificationData,
): Promise<void> {
  if (!SLACK_MESSAGE_WEBHOOK_URL) {
    console.warn("SLACK_MESSAGE_WEBHOOK_URL not configured");
    return;
  }

  const { userId, userName, userPhone, bookingDate, bookingTime, programName } = data;

  // 전화번호 포맷팅 (010-1234-5678)
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formattedPhone = userPhone ? formatPhone(userPhone) : undefined;

  // consultation_type 한글 변환
  const consultationTypeMap: Record<string, string> = {
    "retirement-diagnosis": "은퇴 준비 검진",
    "asset-management": "자산 관리 상담",
    "pension-planning": "연금 설계",
    "tax-consulting": "세무 상담",
  };

  // 예약 정보 포맷팅
  let bookingInfo = "";
  if (bookingDate && bookingTime) {
    const date = new Date(bookingDate);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]}) ${bookingTime}`;
    bookingInfo = `\n예약: ${formattedDate}`;
    if (programName) {
      const displayName = consultationTypeMap[programName] || programName;
      bookingInfo += ` | ${displayName}`;
    }
  }

  const message = {
    text: `*${userName}* 님이 채팅을 보냈습니다.${bookingInfo}\n\n<https://www.lyconplanning.com/admin/users/${userId}#chat|채팅 확인하기>`,
  };

  try {
    const response = await fetch(SLACK_MESSAGE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error("Slack message notification failed:", response.status);
    }
  } catch (error) {
    console.error("Slack message notification error:", error);
  }
}
