"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });

    setConversations(data || []);
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      {/* LEFT SIDE */}
      <div style={{ width: "300px", borderRight: "1px solid #ddd", padding: "20px" }}>
        <h2>Conversations</h2>

        {conversations.map((c) => (
          <div
            key={c.phone}
            style={{
              padding: "10px",
              borderBottom: "1px solid #eee",
              cursor: "pointer"
            }}
          >
            {c.phone}
          </div>
        ))}
      </div>

      {/* RIGHT SIDE */}
      <div style={{ flex: 1, padding: "20px" }}>
        Select a conversation
      </div>

    </div>
  );
}