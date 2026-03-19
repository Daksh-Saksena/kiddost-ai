"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChatList } from "./components/ChatList";
import { ChatDetail } from "./components/ChatDetail";
import "./mobile-styles.css";
import { avatarDataUrl } from './avatarDataUrl';
import { supabase } from "../lib/supabase";

const SERVER = "https://kiddost-ai.onrender.com";
const SESSION_KEY = "kiddost_auth";

type Chat = { id: string; name: string; avatar: string; lastMessage: string; time: string; unread?: number; agent?: string | null; lastMsgAt?: string };
type Message = { id: string; text: string; sender: "me" | "other" | "system"; time: string; agent?: string | null; ai_enabled?: boolean; status?: string | null; media_url?: string | null; whatsapp_id?: string | null };
type AgentProfile = { id: string; name: string };

function avatarColor(name: string) {
  const palette = ['from-blue-600 to-blue-400', 'from-purple-600 to-purple-400', 'from-emerald-600 to-emerald-400', 'from-orange-500 to-amber-400', 'from-pink-600 to-pink-400', 'from-cyan-600 to-cyan-400'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
  return palette[h];
}

function avatarInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [mode, setMode] = useState<'pick' | 'pin' | 'create_step1' | 'create_step2'>('pick');
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [pin, setPin] = useState("");
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${SERVER}/agents`)
      .then(r => r.json())
      .then(j => setAgents(j.agents || []))
      .catch(() => setAgents([]))
      .finally(() => setLoadingAgents(false));
  }, []);

  const handleSelectAgent = (agent: AgentProfile) => {
    setSelectedAgent(agent); setPin(""); setError(""); setMode('pin');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !selectedAgent) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER}/agent-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim(), agentId: selectedAgent.id }),
      });
      const json = await res.json();
      if (res.ok && json.name) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ name: json.name }));
        onLogin(json.name);
      } else {
        setError("Incorrect PIN. Try again.");
        setPin("");
      }
    } catch { setError("Connection error. Try again."); }
    finally { setLoading(false); }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPin.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER}/request-agent-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok && json.token) {
        setToken(json.token);
        setMode('create_step2');
      } else {
        setError(json.error === 'no_admin_phone_configured'
          ? "Admin phone not configured on server."
          : "Failed to send OTP. Try again.");
      }
    } catch { setError("Connection error. Try again."); }
    finally { setLoading(false); }
  };

  const subtitle = mode === 'pick' ? 'Who are you?' : mode === 'pin' ? `Welcome, ${selectedAgent?.name}` : 'New Agent';

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER}/create-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp: otp.trim(), name: newName.trim(), pin: newPin.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ name: json.name }));
        onLogin(json.name);
      } else {
        const msg = json.error === 'invalid_otp' ? "Incorrect OTP."
          : json.error === 'otp_expired' ? "OTP expired. Request a new one."
          : "Failed to create agent.";
        setError(msg);
        if (json.error === 'otp_expired') { setMode('create_step1'); setOtp(""); }
      }
    } catch { setError("Connection error. Try again."); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full rounded-xl px-5 py-3 bg-gray-900 border border-blue-500/30 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all";
  const btnCls = "w-full py-4 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 text-white font-semibold text-sm disabled:opacity-40 hover:from-blue-600 hover:to-blue-500 active:scale-95 transition-all";

  return (
    <div className="h-screen max-w-md mx-auto flex flex-col items-center justify-center bg-black" style={{ boxShadow: "0 0 100px rgba(59,130,246,0.3)" }}>
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2">🐣</div>
        <h1 className="text-2xl font-bold text-white tracking-wide">Kiddost</h1>
        <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
      </div>

      {mode === 'pick' && (
        <div className="w-full px-8 flex flex-col items-center gap-8">
          {loadingAgents ? (
            <p className="text-gray-600 text-sm animate-pulse">Loading profiles...</p>
          ) : agents.length === 0 ? (
            <p className="text-gray-600 text-sm">No agents yet. Create the first one below.</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-8">
              {agents.map(agent => (
                <button key={agent.id} onClick={() => handleSelectAgent(agent)} className="flex flex-col items-center gap-3 group">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarColor(agent.name)} flex items-center justify-center text-white text-2xl font-bold group-hover:scale-110 group-active:scale-95 transition-transform duration-200`} style={{ boxShadow: '0 0 25px rgba(59,130,246,0.3)' }}>
                    {avatarInitials(agent.name)}
                  </div>
                  <span className="text-gray-400 text-sm font-medium group-hover:text-white transition-colors">{agent.name}</span>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { setMode('create_step1'); setError(""); }} className="flex items-center gap-2 text-gray-600 text-xs hover:text-gray-400 transition-colors mt-2">
            <span className="w-6 h-6 rounded-full border border-gray-700 flex items-center justify-center hover:border-gray-500 transition-colors text-base leading-none">+</span>
            Request access for new agent
          </button>
        </div>
      )}

      {mode === 'pin' && selectedAgent && (
        <form onSubmit={handleLogin} className="w-full px-10 flex flex-col gap-4">
          <div className="flex flex-col items-center mb-2">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor(selectedAgent.name)} flex items-center justify-center text-white text-xl font-bold mb-2`} style={{ boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}>
              {avatarInitials(selectedAgent.name)}
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block text-center">ENTER YOUR PIN</label>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)}
              placeholder="••••••" maxLength={20} autoFocus
              className={`${inputCls} text-center text-2xl tracking-widest`} />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading || !pin.trim()} className={btnCls}
            style={{ boxShadow: "0 0 20px rgba(37,99,235,0.4)" }}>
            {loading ? "Verifying..." : "Sign In"}
          </button>
          <button type="button" onClick={() => { setMode('pick'); setError(""); setPin(""); }}
            className="text-gray-600 text-xs text-center hover:text-gray-400 transition-colors">
            Switch profile
          </button>
        </form>
      )}

      {mode === 'create_step1' && (
        <form onSubmit={handleRequestOtp} className="w-full px-10 flex flex-col gap-4">
          <p className="text-gray-500 text-xs text-center">An OTP will be sent to the admin’s WhatsApp to verify this request.</p>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">AGENT NAME</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Priya" maxLength={30} autoFocus className={inputCls} />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">CHOOSE A PIN</label>
            <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)}
              placeholder="Pick a secret PIN" maxLength={20} className={inputCls} />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading || !newName.trim() || !newPin.trim()} className={btnCls}
            style={{ boxShadow: "0 0 20px rgba(37,99,235,0.4)" }}>
            {loading ? "Sending OTP..." : "Send OTP to Admin"}
          </button>
          <button type="button" onClick={() => { setMode('pick'); setError(""); }}
            className="text-gray-600 text-xs text-center hover:text-gray-400 transition-colors">
            Back
          </button>
        </form>
      )}

      {mode === 'create_step2' && (
        <form onSubmit={handleCreateAgent} className="w-full px-10 flex flex-col gap-4">
          <p className="text-gray-500 text-xs text-center">Enter the 6-digit OTP sent to the admin’s WhatsApp.</p>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">OTP</label>
            <input type="text" inputMode="numeric" value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456" maxLength={6} autoFocus
              className={`${inputCls} text-center text-2xl tracking-widest`} />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading || otp.length < 6} className={btnCls}
            style={{ boxShadow: "0 0 20px rgba(37,99,235,0.4)" }}>
            {loading ? "Creating agent..." : "Create Agent"}
          </button>
          <button type="button" onClick={() => { setMode('create_step1'); setError(""); setOtp(""); }}
            className="text-gray-600 text-xs text-center hover:text-gray-400 transition-colors">
            ← Back
          </button>
        </form>
      )}
    </div>
  );
}

const CONTACTS_KEY = 'kiddost_contacts';
function getContacts(): Record<string, { name: string; notes: string }> {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '{}'); } catch { return {}; }
}
function saveContact(phone: string, data: { name: string; notes: string }) {
  const all = getContacts();
  all[phone] = data;
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(all)); } catch {}
}

export default function AppClient() {
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try { return !!JSON.parse(localStorage.getItem(SESSION_KEY) || '{}').name; } catch { return false; }
    }
    return false;
  });
  const [agentName, setAgentName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}').name || 'Agent'; } catch { return 'Agent'; }
    }
    return 'Agent';
  });
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Track last-seen message timestamp per phone to calculate unread counts
  const lastSeenRef = useRef<Record<string, string>>(
    (() => { try { return JSON.parse(localStorage.getItem('kiddost_lastSeen') || '{}'); } catch { return {}; } })()
  );

  const markRead = (phone: string) => {
    lastSeenRef.current[phone] = new Date().toISOString();
    try { localStorage.setItem('kiddost_lastSeen', JSON.stringify(lastSeenRef.current)); } catch {}
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChats = async () => {
    const { data, error } = await supabase.from("messages").select("phone, content, role, sender, agent, created_at").order("created_at", { ascending: false });
    console.log('loadChats result', { data, error });
    if (error) return;
    if (!data || data.length === 0) return setChats([]);

    // Count unread (user messages newer than last-seen) per phone
    const unreadCount: Record<string, number> = {};
    for (const row of data) {
      if (row.role !== 'user' && row.sender !== 'user') continue;
      const lastSeen = lastSeenRef.current[row.phone];
      if (!lastSeen || row.created_at > lastSeen) {
        unreadCount[row.phone] = (unreadCount[row.phone] || 0) + 1;
      }
    }

    const map = new Map();
    for (const row of data) {
      if (!map.has(row.phone)) map.set(row.phone, row);
    }

    const contacts = getContacts();
    const result: Chat[] = Array.from(map.values()).map((r: any) => ({
      id: r.phone,
      name: contacts[r.phone]?.name || r.phone,
      avatar: avatarDataUrl(r.phone),
      lastMessage: r.content || '',
      time: r.created_at ? new Date(r.created_at).toLocaleString() : "",
      agent: r.agent ?? null,
      unread: unreadCount[r.phone] || 0,
      lastMsgAt: r.created_at,
    }));

    setChats(result);
  };

  const loadMessages = async (phone: string) => {
    const { data, error } = await supabase.from("messages").select("*").eq("phone", phone).order("created_at", { ascending: true });
    console.log('loadMessages result', { phone, data, error });
    if (error) return;
    if (!data) return setMessages([]);
    const msgs: Message[] = data.map((m: any) => {
      // prefer explicit sender column when present
      const isOther = m.sender === 'user' || m.role === 'user';
      const isSystem = m.sender === 'system' || m.role === 'system';
      return ({
        id: String(m.id || m.created_at),
        text: m.content || m.text || '',
        sender: isSystem ? 'system' : (isOther ? 'other' : 'me'),
        time: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        agent: m.agent ?? null,
        ai_enabled: typeof m.ai_enabled !== 'undefined' ? !!m.ai_enabled : true,
        status: m.status ?? null,
        media_url: m.media_url ?? null,
        whatsapp_id: m.whatsapp_id ?? null,
      });
    });
    setMessages(msgs);
    setTimeout(scrollToBottom, 100);
  };

  const sendMessage = async (text: string) => {
    if (!text || !selectedChat) return;

    await fetch("https://kiddost-ai.onrender.com/agent-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: selectedChat, message: text, agent: agentName }),
    });
  };

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
      markRead(selectedChat);
      // Refresh chats so unread badge clears immediately
      setChats(prev => prev.map(c => c.id === selectedChat ? { ...c, unread: 0 } : c));
    }
  }, [selectedChat]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          console.log('realtime payload:', payload);
          const msg = payload.new;
          if (msg.phone === selectedChat) {
            const mapped = {
              id: String(msg.id || msg.created_at),
              text: msg.content || msg.text || '',
              sender: (msg.sender === 'system' || msg.role === 'system') ? 'system' as const
                : (msg.role === 'user' || msg.sender === 'user') ? 'other' as const
                : 'me' as const,
              time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
              agent: msg.agent ?? null,
              ai_enabled: typeof msg.ai_enabled !== 'undefined' ? !!msg.ai_enabled : undefined,
              status: msg.status ?? null,
              media_url: msg.media_url ?? null,
              whatsapp_id: msg.whatsapp_id ?? null,
            };
            setMessages((prev) => [...prev, mapped]);
            setTimeout(scrollToBottom, 100);
            // Mark as read since we're looking at it
            markRead(msg.phone);
          } else if (msg.role === 'user' || msg.sender === 'user') {
            // Message for a background chat — bump its unread count
            setChats(prev => prev.map(c =>
              c.id === msg.phone ? { ...c, unread: (c.unread || 0) + 1 } : c
            ));
          }
          loadChats();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new;
          // Patch status on matching message in state (status tick update)
          if (msg.phone === selectedChat && msg.status) {
            setMessages(prev => prev.map(m =>
              (m.whatsapp_id && m.whatsapp_id === msg.whatsapp_id) ||
              (m.id === String(msg.id))
                ? { ...m, status: msg.status }
                : m
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

  // Polling fallback: refresh chats/messages every 5s
  useEffect(() => {
    const iv = setInterval(() => {
      loadChats();
      if (selectedChat) loadMessages(selectedChat);
    }, 5000);

    return () => clearInterval(iv);
  }, [selectedChat]);

  const currentChat = chats.find((c) => c.id === selectedChat);

  if (!authed) {
    return <LoginScreen onLogin={(name) => { setAuthed(true); setAgentName(name); }} />;
  }

  return (
    <div
      className={`h-screen max-w-md mx-auto shadow-2xl ${isDarkMode ? "bg-black" : "bg-white"}`}
      style={isDarkMode ? { boxShadow: "0 0 100px rgba(59, 130, 246, 0.3)" } : { boxShadow: "0 0 50px rgba(0, 0, 0, 0.1)" }}
    >
      {selectedChat ? (
        <ChatDetail
          chatId={selectedChat}
          onBack={() => setSelectedChat(null)}
          isDarkMode={isDarkMode}
          messages={messages}
          chatName={currentChat?.name}
          chatAvatar={currentChat?.avatar}
          onSend={sendMessage}
          onSaveContact={(name, notes) => {
            saveContact(selectedChat, { name, notes });
            setChats(prev => prev.map(c => c.id === selectedChat ? { ...c, name: name || c.id } : c));
          }}
          initialContact={(() => { const c = getContacts(); return c[selectedChat] || { name: '', notes: '' }; })()}
        />
      ) : (
        chats.length === 0 ? (
          <div style={{ padding: 40, color: isDarkMode ? '#fff' : '#000', textAlign: 'center' }}>
            No chats yet — check DevTools console for errors.
          </div>
        ) : (
          <ChatList
            onSelectChat={(chatId) => setSelectedChat(chatId)}
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            onLogout={() => { localStorage.removeItem(SESSION_KEY); setAuthed(false); setAgentName('Agent'); }}
            chats={chats}
          />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}
