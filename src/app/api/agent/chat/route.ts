import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!FASTAPI_URL) {
      return NextResponse.json(
        { error: "FASTAPI_URL not configured" },
        { status: 500 }
      );
    }

    const { messages, context, agentType } = await request.json() as {
      messages: Message[];
      context?: string;
      agentType?: string;
    };

    // 디버그: context 확인
    console.log("[Agent Chat] Agent:", agentType, "Context length:", context?.length || 0);

    const response = await fetch(`${FASTAPI_URL}/agent/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, context, agent_type: agentType }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[FastAPI Agent Error]", error);
      return NextResponse.json(
        { error: "Failed to get response from agent" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ message: data.message });
  } catch (error) {
    console.error("[Agent Chat Error]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
