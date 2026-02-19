"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatRoom } from "@/app/waiting/components";
import styles from "./chat.module.css";

export default function ChatPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [expertName, setExpertName] = useState<string>("전문가");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        localStorage.setItem("returnUrl", "/chat");
        router.replace("/auth/login");
        return;
      }

      const { data: conversation } = await supabase
        .from("conversations")
        .select("expert:experts(name)")
        .eq("user_id", user.id)
        .single();

      if (conversation?.expert) {
        const expert = conversation.expert as unknown as { name: string };
        setExpertName(expert.name);
      }

      setUserId(user.id);
      setLoading(false);
    };

    init();
  }, [router]);

  if (loading) {
    return <div className={styles.loading} />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>담당: {expertName}</h1>
      </header>
      <div className={styles.main}>
        {userId && (
          <ChatRoom
            userId={userId}
            isVisible={true}
          />
        )}
      </div>
    </div>
  );
}
