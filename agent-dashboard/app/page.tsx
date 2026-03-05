"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [text, setText] = useState("");

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    setMessages(data || []);
  }

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const conversations = [
    ...new Set(messages.map((m) => m.phone)),
  ];

  const filtered = messages.filter((m) => m.phone === selectedPhone);

  async function sendMessage() {
    if (!text || !selectedPhone) return;

    await fetch("https://kiddost-ai.onrender.com/agent-send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: selectedPhone,
        text,
      }),
    });

    setText("");
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      
      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: "300px",
          borderRight: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <h3 style={{ padding: "15px" }}>Chats</h3>

        {conversations.map((phone) => (
          <div
            key={phone}
            onClick={() => setSelectedPhone(phone)}
            style={{
              padding: "12px",
              cursor: "pointer",
              background:
                selectedPhone === phone ? "#f0f0f0" : "white",
              borderBottom: "1px solid #eee",
            }}
          >
            {phone}
          </div>
        ))}
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* HEADER */}
        <div
          style={{
            padding: "15px",
            borderBottom: "1px solid #ddd",
            fontWeight: "bold",
          }}
        >
          {selectedPhone || "Select a chat"}
        </div>

        {/* MESSAGES */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            background: "#f5f5f5",
          }}
        >
          {filtered.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: "10px",
                display: "flex",
                justifyContent:
                  msg.sender === "agent"
                    ? "flex-end"
                    : "flex-start",
              }}
            >
              <div
                style={{
                  padding: "10px 15px",
                  borderRadius: "12px",
                  background:
                    msg.sender === "agent"
                      ? "#dcf8c6"
                      : "white",
                  maxWidth: "60%",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* INPUT */}
        {selectedPhone && (
          <div
            style={{
              display: "flex",
              borderTop: "1px solid #ddd",
              padding: "10px",
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type message..."
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />

            <button
              onClick={sendMessage}
              style={{
                marginLeft: "10px",
                padding: "10px 15px",
                background: "#25D366",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}