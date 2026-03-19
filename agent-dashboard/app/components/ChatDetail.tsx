"use client";

import React, { useEffect, useRef, useState } from "react";
import { avatarDataUrl } from '../avatarDataUrl';
import { ArrowLeft, Send, MoreVertical, Check, CheckCheck, Info, X } from "lucide-react";
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  text: string;
  sender: "me" | "other" | "system";
  time: string;
  read?: boolean;
  agent?: string | null;
  ai_enabled?: boolean;
  status?: string | null;
  media_url?: string | null;
}

interface ChatDetailProps {
  chatId: string;
  onBack: () => void;
  isDarkMode: boolean;
}

export function ChatDetail({ chatId, onBack, isDarkMode, messages: propMessages = [], chatName, chatAvatar, onSend, onSaveContact, initialContact }: ChatDetailProps & { messages?: Message[]; chatName?: string; chatAvatar?: string; onSend: (text: string) => Promise<void>; onSaveContact?: (name: string, notes: string) => void; initialContact?: { name: string; notes: string } }) {
  const [messages, setMessages] = useState<Message[]>(propMessages || []);
  const [inputValue, setInputValue] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [contactName, setContactName] = useState(initialContact?.name || '');
  const [contactNotes, setContactNotes] = useState(initialContact?.notes || '');

  // Reset info panel when switching chats
  useEffect(() => {
    setContactName(initialContact?.name || '');
    setContactNotes(initialContact?.notes || '');
    setShowInfo(false);
  }, [chatId]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Reset scroll tracking when switching chats
  useEffect(() => {
    prevLengthRef.current = 0;
  }, [chatId]);

  useEffect(() => {
    setMessages(propMessages || []);
  }, [propMessages]);

  // Smart scroll: instant on initial load, smooth on new message if already near bottom
  useEffect(() => {
    const end = messagesEndRef.current;
    const container = scrollContainerRef.current;
    if (!end || messages.length === 0) return;
    const isInitialLoad = prevLengthRef.current === 0;
    if (isInitialLoad) {
      end.scrollIntoView({ behavior: 'instant' });
    } else if (messages.length > prevLengthRef.current) {
      const isNearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 200
        : true;
      if (isNearBottom) end.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

  const handleSend = async () => {
    if (inputValue.trim()) {
      await onSend(inputValue.trim());
      setInputValue("");
    }
  };

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Direct upload to Supabase Storage (public bucket) to avoid server proxy limits
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_\.]/g, "_");
      const cleanPhone = String(chatId).replace(/^\+/, "");
      const path = `${cleanPhone}/${Date.now()}_${safeName}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream' });
      if (uploadErr) {
        console.error('direct upload error', uploadErr.message || uploadErr);
        // fallback: try server upload
        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            const resp = await fetch('https://kiddost-ai.onrender.com/upload-media-server', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileBase64: base64, fileName: file.name, fileType: file.type || 'application/octet-stream', phone: chatId })
            });
            const json = await resp.json();
            if (!json || !json.publicUrl) {
              console.error('server upload failed', json);
              return;
            }
            const publicURL = json.publicUrl;
            setMessages((prev) => [...prev, { id: `local-${Date.now()}`, text: '', sender: 'me', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), media_url: publicURL, status: 'sending' } as Message]);
            await fetch('https://kiddost-ai.onrender.com/agent-send-media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: chatId, mediaUrl: publicURL, caption: '' })
            });
          };
          reader.readAsDataURL(file);
        } catch (e) {
          console.error('fallback server upload failed', e);
        }
        return;
      }

      const publicRes = supabase.storage.from('media').getPublicUrl(path);
      const publicURL = publicRes?.data?.publicUrl || null;
      if (!publicURL) {
        console.error('failed to get public url for uploaded media');
        return;
      }

      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, text: '', sender: 'me', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), media_url: publicURL, status: 'sending' } as Message]);

      await fetch('https://kiddost-ai.onrender.com/agent-send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: chatId, mediaUrl: publicURL, caption: '' })
      });
    } catch (err) {
      console.error('uploadMedia error', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const name = chatName || "Unknown";
  const avatar = chatAvatar || avatarDataUrl(name);

  const handleSaveContact = () => {
    onSaveContact?.(contactName.trim(), contactNotes.trim());
    setShowInfo(false);
  };

  function resolveMediaUrl(url: string): string {
    if (!url) return url;
    // Route BotSpace-hosted media through the server proxy so browsers render inline
    if (url.includes('bot.space') || url.includes('botspace')) {
      return `https://kiddost-ai.onrender.com/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  function getMediaType(url: string): 'image' | 'video' | 'audio' | 'pdf' | 'file' {
    // Check for an explicit 'type' MIME hint in the query string (set by proxy URLs or server)
    try {
      const parsed = new URL(url);
      const typeParam = parsed.searchParams.get('type');
      if (typeParam) {
        if (typeParam.startsWith('image/')) return 'image';
        if (typeParam.startsWith('video/')) return 'video';
        if (typeParam.startsWith('audio/')) return 'audio';
        if (typeParam === 'application/pdf') return 'pdf';
      }
    } catch { /* ignore — not a valid absolute URL */ }
    const clean = url.split('?')[0].toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif)$/.test(clean)) return 'image';
    if (/\.(mp4|mov|avi|mkv|webm|3gp)$/.test(clean)) return 'video';
    if (/\.(mp3|ogg|wav|m4a|aac)$/.test(clean)) return 'audio';
    if (/\.pdf$/.test(clean)) return 'pdf';
    // Proxy URLs lack an extension — BotSpace primarily sends images, so default to image
    if (url.includes('/proxy-image')) return 'image';
    return 'file';
  }

  function MediaRenderer({ url, isDark }: { url: string; isDark: boolean }) {
    const resolved = resolveMediaUrl(url);
    const type = getMediaType(url);
    const linkClass = `text-sm underline ${isDark ? 'text-blue-300' : 'text-blue-600'}`;
    if (type === 'image') {
      return <img src={resolved} alt="media" className="w-48 rounded-md object-cover" />;
    }
    if (type === 'video') {
      return (
        <video controls className="w-48 rounded-md" preload="metadata">
          <source src={resolved} />
          <a href={resolved} target="_blank" rel="noreferrer" className={linkClass}>View video</a>
        </video>
      );
    }
    if (type === 'audio') {
      return (
        <audio controls className="w-48">
          <source src={resolved} />
          <a href={resolved} target="_blank" rel="noreferrer" className={linkClass}>Play audio</a>
        </audio>
      );
    }
    if (type === 'pdf') {
      return <a href={resolved} target="_blank" rel="noreferrer" className={linkClass}>📄 View PDF</a>;
    }
    return <a href={resolved} target="_blank" rel="noreferrer" className={linkClass}>📎 Download file</a>;
  }

  const [aiEnabledLocal, setAiEnabledLocal] = useState<boolean>(() => {
    const lm = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    return lm && typeof lm.ai_enabled !== 'undefined' ? !!lm.ai_enabled : true;
  });
  const [handlerLocal, setHandlerLocal] = useState<string>(() => {
    const lm = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    return lm && lm.agent ? lm.agent : (lm && lm.ai_enabled === false ? 'Agent' : 'AI 🤖');
  });

  // sync AI/handler state when messages change
  // Use the most recent message that has an explicit ai_enabled value — including system toggle messages
  React.useEffect(() => {
    if (messages.length === 0) return;
    const lastWithState = [...messages].reverse().find(m => typeof m.ai_enabled !== 'undefined');
    if (!lastWithState) return;
    const enabled = !!lastWithState.ai_enabled;
    setAiEnabledLocal(enabled);
    setHandlerLocal(lastWithState.agent ? lastWithState.agent : (enabled ? 'AI' : 'Agent'));
  }, [messages]);

  const toggleAi = async (enable: boolean) => {
    try {
      const res = await fetch("https://kiddost-ai.onrender.com/toggle-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: chatId, ai_enabled: enable }),
      });
      if (res.ok) {
        setAiEnabledLocal(!!enable);
        setHandlerLocal(enable ? 'AI' : 'Agent');
      }
    } catch (err) {
      console.error("toggleAi error", err);
    }
  };

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${isDarkMode ? "bg-black" : "bg-[#efeae2]"}`}>
      {isDarkMode && (
        <div className="absolute inset-0 opacity-30">
          <div className="absolute w-1 h-1 bg-blue-400 rounded-full top-[10%] left-[20%]" style={{ boxShadow: "0 0 3px rgba(96, 165, 250, 0.8)" }} />
          <div className="absolute w-1 h-1 bg-cyan-400 rounded-full top-[30%] left-[80%]" style={{ boxShadow: "0 0 3px rgba(34, 211, 238, 0.8)" }} />
          <div className="absolute w-1 h-1 bg-blue-300 rounded-full top-[60%] left-[15%]" style={{ boxShadow: "0 0 3px rgba(147, 197, 253, 0.8)" }} />
          <div className="absolute w-1 h-1 bg-cyan-300 rounded-full top-[80%] left-[70%]" style={{ boxShadow: "0 0 3px rgba(103, 232, 249, 0.8)" }} />
        </div>
      )}

      <div className={`text-white px-4 py-3 flex items-center relative z-10 ${isDarkMode ? "bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900" : "bg-[#008069]"}`}>
        {isDarkMode && <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />}
        <button onClick={onBack} className={`mr-3 relative z-10 ${isDarkMode ? "hover:scale-110" : ""} transition-transform`}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="relative">
          <img src={avatar} alt={name} className="w-11 h-11 rounded-full object-cover" />
        </div>
        <div className="flex-1 ml-3 relative z-10">
          <h2 className="font-medium">{name}</h2>
          <p className={`text-xs ${isDarkMode ? "text-white" : "text-gray-200"}`}>Online</p>
          <div className="text-xs mt-1 flex items-center gap-2">
            <span className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}><strong>Handled by:</strong> {handlerLocal}</span>
            {aiEnabledLocal ? (
              <button onClick={() => toggleAi(false)} className="ml-2 px-2 py-1 text-xs rounded bg-red-600 text-white">Stop AI</button>
            ) : (
              <button onClick={() => toggleAi(true)} className="ml-2 px-2 py-1 text-xs rounded bg-green-600 text-white">Resume AI</button>
            )}
          </div>
        </div>
        <button className={`relative z-10 ${isDarkMode ? "hover:scale-110" : ""} transition-transform`} onClick={() => setShowInfo(true)}>
          <Info className="w-6 h-6" />
        </button>
      </div>

      {/* Info / Notes drawer */}
      {showInfo && (
        <div className={`absolute inset-0 z-50 flex flex-col ${ isDarkMode ? 'bg-gray-950' : 'bg-white'}`}>
          <div className={`flex items-center gap-3 px-4 py-4 border-b ${ isDarkMode ? 'border-blue-900/30 text-white' : 'border-gray-200 text-gray-900'}`}>
            <button onClick={() => setShowInfo(false)} className="hover:opacity-70 transition-opacity">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-base flex-1">Contact Info</h2>
            <button onClick={handleSaveContact} className={`text-sm font-semibold px-3 py-1 rounded-lg ${ isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-[#008069] text-white'} transition-colors`}>Save</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">
            {/* Phone */}
            <div>
              <label className={`text-xs font-medium mb-1 block ${ isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>PHONE</label>
              <p className={`text-sm ${ isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{chatId}</p>
            </div>
            {/* Display name */}
            <div>
              <label className={`text-xs font-medium mb-1.5 block ${ isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>DISPLAY NAME</label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition-all ${ isDarkMode ? 'bg-gray-900 border border-blue-500/30 text-white placeholder:text-gray-600 focus:border-blue-500' : 'bg-gray-100 border border-gray-200 text-gray-900 focus:border-[#008069]'}`}
              />
            </div>
            {/* Notes */}
            <div>
              <label className={`text-xs font-medium mb-1.5 block ${ isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>NOTES</label>
              <textarea
                value={contactNotes}
                onChange={e => setContactNotes(e.target.value)}
                placeholder="Add any notes about this customer..."
                rows={6}
                className={`w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all ${ isDarkMode ? 'bg-gray-900 border border-blue-500/30 text-white placeholder:text-gray-600 focus:border-blue-500' : 'bg-gray-100 border border-gray-200 text-gray-900 focus:border-[#008069]'}`}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 relative z-10">
        {messages.filter(m => m.sender !== 'system').map((message) => {
          const isMe = message.sender === 'me';
          return (
            <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isDarkMode ? (isMe ? 'bg-gradient-to-r from-blue-800 to-blue-700 text-white backdrop-blur-sm' : 'bg-gray-900/80 text-gray-100 border border-blue-500/20 backdrop-blur-sm') : (isMe ? 'bg-[#d9fdd3]' : 'bg-white')}`} style={isDarkMode ? (isMe ? { boxShadow: '0 0 15px rgba(37, 99, 235, 0.2)' } : { boxShadow: '0 0 15px rgba(59, 130, 246, 0.1)' }) : {}}>
                {message.media_url && (
                  <div className="mb-2">
                    <MediaRenderer url={message.media_url} isDark={isDarkMode} />
                  </div>
                )}
                {message.text ? <p className={`text-sm ${isDarkMode ? '' : 'text-gray-900'}`}>{message.text}</p> : null}
                <div className={`flex items-center justify-end gap-1 mt-1.5 text-xs ${isDarkMode ? (isMe ? 'text-blue-200' : 'text-blue-400') : 'text-gray-500'}`}>
                  <span>{message.time}</span>
                  {isMe && (
                    message.status === 'delivered' || message.status === 'read' ? (
                      <CheckCheck className={`w-4 h-4 ${message.status === 'read' ? 'text-blue-400' : ''}`} />
                    ) : (
                      <Check className="w-4 h-4" />
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={`px-4 py-3 flex items-center gap-3 relative z-10 ${isDarkMode ? "bg-gradient-to-t from-gray-900 to-black border-t border-blue-900/30" : "bg-[#f0f0f0]"}`}>
        <label className="cursor-pointer">
          <input type="file" onChange={uploadMedia} className="hidden" />
          <div className={`px-3 py-2 rounded-full ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}>+</div>
        </label>
        <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={handleKeyPress} placeholder={isDarkMode ? "Transmit message..." : "Type a message"} className={`flex-1 rounded-full px-5 py-3 outline-none text-sm ${isDarkMode ? "bg-gray-900/70 border border-blue-500/30 text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-sm" : "bg-white text-gray-900"} transition-all`} />
        <button onClick={handleSend} className={`p-3 rounded-full active:scale-95 transition-all ${isDarkMode ? "bg-gradient-to-r from-blue-800 to-blue-700 text-white hover:from-blue-700 hover:to-blue-600" : "bg-[#008069] text-white hover:bg-[#017a5f]"}`} style={isDarkMode ? { boxShadow: "0 0 15px rgba(37, 99, 235, 0.3)" } : {}}>
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
