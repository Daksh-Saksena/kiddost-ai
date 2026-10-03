"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { avatarDataUrl } from '../avatarDataUrl';
import {
  ArrowLeft,
  Send,
  Check,
  CheckCheck,
  Info,
  X,
  FileText,
  ChevronLeft,
  CalendarPlus,
  ExternalLink,
  MapPin,
  Paperclip,
  Image as ImageIcon,
  Bot,
  User,
  Sparkles,
  Download,
  Clock,
  Phone
} from "lucide-react";
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
  created_at?: string;
  whatsapp_id?: string | null;
}

interface ChatDetailProps {
  chatId: string;
  onBack: () => void;
  isDarkMode: boolean;
  messages?: Message[];
  chatName?: string;
  chatAvatar?: string;
  onSend: (text: string) => Promise<void>;
  onSaveContact?: (name: string, notes: string) => void;
  initialContact?: { name: string; notes: string };
  initialLabels?: string[];
  onAddLabel?: (label: string) => void;
  onRemoveLabel?: (label: string) => void;
  agentName?: string;
}

const SERVER = 'https://kiddost-ai.onrender.com';

const KNOWN_TEMPLATES = [
  { id: 'session', name: 'Session Today?', body: 'Hi, Would you like to go ahead with the session today?', language: 'en' },
  { id: 'confirm_booking', name: 'Confirm Booking', body: 'Hi! Would you like to go ahead and confirm your booking for tomorrow?', language: 'en' },
  { id: 'slots_available', name: 'Slots Available', body: 'Hi! We have slots available {{1}} . Would you like to try a session and see how it works for you?', language: 'en' }
];


export function ChatDetail({
  chatId,
  onBack,
  isDarkMode,
  messages: propMessages = [],
  chatName,
  chatAvatar,
  onSend,
  onSaveContact,
  initialContact,
  initialLabels = [],
  onAddLabel,
  onRemoveLabel,
  agentName,
}: ChatDetailProps) {
  const [messages, setMessages] = useState<Message[]>(propMessages || []);
  const [inputValue, setInputValue] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [contactName, setContactName] = useState(initialContact?.name || '');
  const [contactNotes, setContactNotes] = useState(initialContact?.notes || '');
  const [labels, setLabels] = useState<string[]>(initialLabels);
  const [labelInput, setLabelInput] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [templateSending, setTemplateSending] = useState(false);
  const [manualTemplateId, setManualTemplateId] = useState('');
  const [customerVars, setCustomerVars] = useState<{ children?: any[]; notes?: Record<string, string> } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Sync incoming prop messages
  useEffect(() => {
    setMessages(propMessages || []);
  }, [propMessages]);

  // AI Handler status tracking
  const [aiEnabledLocal, setAiEnabledLocal] = useState<boolean>(() => {
    const lm = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    return lm && typeof lm.ai_enabled !== 'undefined' ? !!lm.ai_enabled : true;
  });

  const [handlerLocal, setHandlerLocal] = useState<string>(() => {
    const lm = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    return lm && lm.agent ? lm.agent : (lm && lm.ai_enabled === false ? 'Agent' : 'AI');
  });

  useEffect(() => {
    if (messages.length === 0) return;
    const lastWithState = [...messages].reverse().find(m => typeof m.ai_enabled !== 'undefined');
    if (!lastWithState) return;
    const enabled = !!lastWithState.ai_enabled;
    setAiEnabledLocal(enabled);
    if (lastWithState.sender !== 'other') {
      setHandlerLocal(lastWithState.agent ? lastWithState.agent : (enabled ? 'AI' : 'Agent'));
    }
  }, [messages]);

  const toggleAi = async (enable: boolean) => {
    try {
      const res = await fetch(`${SERVER}/toggle-ai`, {
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

  // Reset info panel state when switching chats
  useEffect(() => {
    setContactName(initialContact?.name || '');
    setContactNotes(initialContact?.notes || '');
    setShowInfo(false);
    setLabels(initialLabels || []);
    setLabelInput('');
    setCustomerVars(null);
  }, [chatId, initialContact?.name, initialContact?.notes]);

  // Fetch conversation vars when info drawer opens
  useEffect(() => {
    if (!showInfo) return;
    const cleanPhone = chatId.startsWith('+') ? chatId : `+${chatId}`;
    supabase.from('conversations').select('vars').eq('phone', cleanPhone).single()
      .then(({ data }) => {
        setCustomerVars(data?.vars || {});
      });
  }, [showInfo, chatId]);

  // Smart auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLengthRef = useRef(0);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  };

  useEffect(() => {
    const isInitial = prevLengthRef.current === 0;
    if (messages.length > 0) {
      scrollToBottom(isInitial);
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

  // Auto-expand textarea
  const adjustTextareaHeight = () => {
    const tx = textareaRef.current;
    if (!tx) return;
    tx.style.height = "auto";
    tx.style.height = `${Math.min(tx.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  // Send message
  const [sendCooldown, setSendCooldown] = useState(false);
  const handleSend = async () => {
    if (sendCooldown || !inputValue.trim()) return;
    const text = inputValue.trim();
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = '40px';
    setSendCooldown(true);
    await onSend(text);
    setTimeout(() => setSendCooldown(false), 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Upload Media
  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaCaption = inputValue.trim();
    if (mediaCaption) setInputValue("");

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_\.]/g, "_");
      const cleanPhone = String(chatId).replace(/^\+/, "");
      const path = `${cleanPhone}/${Date.now()}_${safeName}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('media')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream' });

      if (uploadErr) {
        // Fallback: try server proxy upload
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          const resp = await fetch(`${SERVER}/upload-media-server`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: base64, fileName: file.name, fileType: file.type || 'application/octet-stream', phone: chatId })
          });
          const json = await resp.json();
          if (json?.publicUrl) {
            await fetch(`${SERVER}/agent-send-media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: chatId, mediaUrl: json.publicUrl, caption: mediaCaption })
            });
          }
        };
        reader.readAsDataURL(file);
        return;
      }

      const publicRes = supabase.storage.from('media').getPublicUrl(path);
      const publicURL = publicRes?.data?.publicUrl || null;
      if (publicURL) {
        await fetch(`${SERVER}/agent-send-media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: chatId, mediaUrl: publicURL, caption: mediaCaption })
        });
      }
    } catch (err) {
      console.error('uploadMedia error', err);
    }
  };

  // Media link resolver & type detection
  function resolveMediaUrl(url: string): string {
    if (!url) return url;
    if (url.includes('bot.space') || url.includes('botspace')) {
      try {
        return `${SERVER}/proxy-image?url=${encodeURIComponent(url)}`;
      } catch {
        return url;
      }
    }
    return url;
  }

  function getMediaType(url: string): 'image' | 'video' | 'audio' | 'pdf' | 'file' {
    try {
      const parsed = new URL(url);
      const typeParam = parsed.searchParams.get('type');
      if (typeParam?.startsWith('image/')) return 'image';
      if (typeParam?.startsWith('video/')) return 'video';
      if (typeParam?.startsWith('audio/')) return 'audio';
      if (typeParam === 'application/pdf') return 'pdf';
    } catch {}
    const clean = url.split('?')[0].toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif)$/.test(clean)) return 'image';
    if (/\.(mp4|mov|avi|mkv|webm|3gp)$/.test(clean)) return 'video';
    if (/\.(mp3|ogg|wav|m4a|aac)$/.test(clean)) return 'audio';
    if (/\.pdf$/.test(clean)) return 'pdf';
    if (url.includes('/proxy-image')) return 'image';
    return 'file';
  }

  // Template handling
  const openTemplateModal = async () => {
    setShowTemplateModal(true);
    setSelectedTemplate(null);
    setTemplateVars([]);
    setTemplatesLoading(true);
    try {
      const res = await fetch(`${SERVER}/templates`);
      const json = await res.json();
      const fetched: any[] = json?.templates || json?.data || [];
      const knownNotInFetched = KNOWN_TEMPLATES.filter(k => !fetched.find((f: any) => (f.id || f.name) === k.id));
      setTemplates([...fetched, ...knownNotInFetched]);
    } catch {
      setTemplates(KNOWN_TEMPLATES);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const sendTemplate = async () => {
    const tid = selectedTemplate ? (selectedTemplate.id || selectedTemplate.name) : manualTemplateId.trim();
    if (!tid || templateSending) return;
    setTemplateSending(true);
    try {
      await fetch(`${SERVER}/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: chatId,
          templateId: tid,
          variables: templateVars.filter(v => v.trim() !== ''),
        })
      });
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      setTemplateVars([]);
      setManualTemplateId('');
    } catch {}
    finally { setTemplateSending(false); }
  };

  // Calendar event extraction
  const [showCalModal, setShowCalModal] = useState(false);
  const [calExtracting, setCalExtracting] = useState(false);
  const [calTitle, setCalTitle] = useState('');
  const [calDate, setCalDate] = useState('');
  const [calStart, setCalStart] = useState('');
  const [calEnd, setCalEnd] = useState('');
  const [calNotes, setCalNotes] = useState('');
  const [calRepeat, setCalRepeat] = useState(1);
  const [calDays, setCalDays] = useState<number[]>([]);
  const [calTrial, setCalTrial] = useState(false);
  const [calMember, setCalMember] = useState('');
  const [calSaving, setCalSaving] = useState(false);
  const [calSuccess, setCalSuccess] = useState(false);

  const extractAndShowCalendar = async () => {
    setCalExtracting(true);
    setCalTitle(''); setCalDate(''); setCalStart(''); setCalEnd(''); setCalNotes('');
    setCalRepeat(1); setCalDays([]); setCalTrial(false); setCalMember(''); setCalSuccess(false);
    try {
      const res = await fetch(`${SERVER}/calendar/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: chatId }),
      });
      const json = await res.json();
      const ex = json.extracted;
      if (ex && (ex.title || ex.startTime || ex.start_time || ex.date || (Array.isArray(ex.repeatDays) && ex.repeatDays.length > 0))) {
        setCalTitle(ex.title || 'KidDost Session');
        if (ex.date) {
          setCalDate(ex.date);
        } else if (Array.isArray(ex.repeatDays) && ex.repeatDays.length > 0) {
          const today = new Date();
          let best: Date | null = null;
          for (const targetDay of ex.repeatDays) {
            const diff = (targetDay - today.getDay() + 7) % 7 || 7;
            const candidate = new Date(today);
            candidate.setDate(today.getDate() + diff);
            if (!best || candidate < best) best = candidate;
          }
          setCalDate(best ? best.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        } else {
          setCalDate(new Date().toISOString().split('T')[0]);
        }
        setCalStart(ex.startTime || ex.start_time || '');
        setCalEnd(ex.endTime || ex.end_time || '');
        setCalNotes(ex.notes || '');
        setCalTrial(ex.isTrial === true);
        if (ex.repeatCount && ex.repeatCount > 1) setCalRepeat(ex.repeatCount);
        if (Array.isArray(ex.repeatDays) && ex.repeatDays.length > 0) setCalDays(ex.repeatDays);
      } else {
        setCalTitle('KidDost Session');
        setCalDate(new Date().toISOString().split('T')[0]);
      }
    } catch {
      setCalTitle('KidDost Session');
    } finally {
      setCalExtracting(false);
      setShowCalModal(true);
    }
  };

  const saveCalEvent = async () => {
    if (!calTitle.trim() || !calDate) return;
    setCalSaving(true);
    try {
      await fetch(`${SERVER}/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: chatId,
          title: calTitle.trim(),
          date: calDate,
          start_time: calStart || null,
          end_time: calEnd || null,
          notes: calNotes.trim() || null,
          created_by: agentName || null,
          assigned_member: calMember.trim() || null,
          repeat_count: calRepeat > 1 ? calRepeat : undefined,
          repeat_days: calDays.length > 0 ? calDays : undefined,
          is_trial: calTrial
        }),
      });
      setCalSuccess(true);
      setTimeout(() => { setShowCalModal(false); setCalSuccess(false); }, 1200);
    } catch {}
    finally { setCalSaving(false); }
  };

  const name = chatName || chatId;
  const avatar = chatAvatar || avatarDataUrl(name, chatId);

  // Check 24-hour WhatsApp messaging window
  const lastUserMsg = useMemo(() => {
    return [...messages].reverse().find(m => m.sender === 'other');
  }, [messages]);

  const is24hWindowClosed = useMemo(() => {
    if (!lastUserMsg || !lastUserMsg.created_at) return true;
    return (new Date().getTime() - new Date(lastUserMsg.created_at).getTime()) > 24 * 60 * 60 * 1000;
  }, [lastUserMsg]);

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${
      isDarkMode ? "bg-[#0b141a] text-slate-100" : "bg-[#efeae2] text-slate-900"
    }`}>
      {/* WhatsApp Modern Header */}
      <header className={`px-3 py-2.5 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-sm select-none ${
        isDarkMode ? "bg-[#111b21] border-b border-[#202c33]" : "bg-[#008069] text-white"
      }`}>
        <div className="flex items-center min-w-0 flex-1">
          {/* Back button with standard 44px tap target */}
          <button
            onClick={onBack}
            className={`p-2 -ml-1 rounded-full transition-all active:scale-95 shrink-0 mr-1 ${
              isDarkMode ? "text-slate-300 hover:text-white hover:bg-[#202c33]" : "text-white hover:bg-white/10"
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Contact Avatar & Info */}
          <div
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            onClick={() => setShowInfo(true)}
          >
            <img
              src={avatar}
              alt={name}
              className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[15px] truncate leading-tight">{name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[11px] font-medium leading-none ${
                  isDarkMode ? "text-slate-400" : "text-emerald-100"
                }`}>
                  {chatId}
                </span>

                {/* AI Toggle Pill inside Header */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAi(!aiEnabledLocal);
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all active:scale-95 ${
                    aiEnabledLocal
                      ? isDarkMode
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                        : "bg-emerald-700 text-white"
                      : isDarkMode
                      ? "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                      : "bg-amber-500 text-white"
                  }`}
                  title={aiEnabledLocal ? "AI is running. Tap to stop." : "AI is paused. Tap to resume."}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${aiEnabledLocal ? "bg-emerald-400 animate-pulse" : "bg-amber-300"}`} />
                  {aiEnabledLocal ? "AI ON" : "AI PAUSED"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={extractAndShowCalendar}
            disabled={calExtracting}
            title="Add to Calendar"
            className={`p-2 rounded-full transition-all active:scale-95 ${
              isDarkMode ? "text-slate-300 hover:text-white hover:bg-[#202c33]" : "text-white hover:bg-white/10"
            }`}
          >
            <CalendarPlus className={`w-5 h-5 ${calExtracting ? "animate-spin text-amber-400" : ""}`} />
          </button>

          <button
            onClick={() => setShowInfo(true)}
            title="Contact Details"
            className={`p-2 rounded-full transition-all active:scale-95 ${
              isDarkMode ? "text-slate-300 hover:text-white hover:bg-[#202c33]" : "text-white hover:bg-white/10"
            }`}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Message History Feed */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3.5 py-4 space-y-2.5 overscroll-contain"
      >
        {(() => {
          let lastDateStr = '';
          return messages
            .filter((m) => m.sender !== 'system')
            .map((message) => {
              const isMe = message.sender === 'me';
              const msgDate = message.created_at ? new Date(message.created_at) : new Date();
              const dateStr = msgDate.toDateString();
              let showDivider = false;
              if (dateStr !== lastDateStr) {
                showDivider = true;
                lastDateStr = dateStr;
              }

              const today = new Date();
              const yesterday = new Date();
              yesterday.setDate(today.getDate() - 1);

              let dividerLabel = '';
              if (showDivider) {
                if (dateStr === today.toDateString()) {
                  dividerLabel = 'Today';
                } else if (dateStr === yesterday.toDateString()) {
                  dividerLabel = 'Yesterday';
                } else {
                  dividerLabel = msgDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
                }
              }

              return (
                <React.Fragment key={message.id}>
                  {showDivider && (
                    <div className="flex justify-center my-3 select-none">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-semibold tracking-wide shadow-sm border ${
                        isDarkMode
                          ? "bg-[#182229] text-slate-400 border-[#222e35]"
                          : "bg-white/90 text-slate-600 border-slate-200/80 backdrop-blur-sm"
                      }`}>
                        {dividerLabel}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 shadow-sm text-sm break-words relative transition-all ${
                        isMe
                          ? isDarkMode
                            ? "bg-[#005c4b] text-white rounded-tr-sm"
                            : "bg-[#d9fdd3] text-slate-900 border border-[#c4f3bd] rounded-tr-sm"
                          : isDarkMode
                          ? "bg-[#202c33] text-slate-100 rounded-tl-sm border border-[#2a3942]"
                          : "bg-white text-slate-900 rounded-tl-sm shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      }`}
                    >
                      {/* Media Renderer */}
                      {message.media_url && (
                        <div className="mb-2 rounded-xl overflow-hidden max-w-sm">
                          {getMediaType(message.media_url) === 'image' ? (
                            <img
                              src={resolveMediaUrl(message.media_url)}
                              alt="media"
                              className="rounded-xl w-full max-h-60 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => setLightboxUrl(resolveMediaUrl(message.media_url!))}
                            />
                          ) : getMediaType(message.media_url) === 'video' ? (
                            <video controls className="w-full rounded-xl" preload="metadata">
                              <source src={resolveMediaUrl(message.media_url)} />
                            </video>
                          ) : getMediaType(message.media_url) === 'audio' ? (
                            <audio controls className="w-full">
                              <source src={resolveMediaUrl(message.media_url)} />
                            </audio>
                          ) : (
                            <a
                              href={resolveMediaUrl(message.media_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 p-2.5 rounded-lg bg-black/10 hover:bg-black/20 text-xs font-semibold underline"
                            >
                              <Paperclip className="w-4 h-4 shrink-0" />
                              View Attachment
                            </a>
                          )}
                        </div>
                      )}

                      {/* Text content with clickable links & Google Maps button */}
                      {(() => {
                        if (!message.text) return null;
                        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)[^\s]+)/gi;
                        const parts = message.text.split(urlRegex);
                        const mapsMatch = message.text.match(/(https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)[^\s]+|(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)[^\s]+)/i);
                        const mapsUrl = mapsMatch ? (mapsMatch[0].startsWith('http') ? mapsMatch[0] : `https://${mapsMatch[0]}`) : null;

                        return (
                          <div className="space-y-2">
                            <p className="whitespace-pre-wrap leading-relaxed text-[14.5px]">
                              {parts.map((part, i) => {
                                if (part && part.match(urlRegex)) {
                                  const href = part.startsWith('http') ? part : `https://${part}`;
                                  return (
                                    <a
                                      key={i}
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center underline font-semibold text-emerald-600 dark:text-emerald-400 hover:opacity-80 break-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(href, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      <span>{part}</span>
                                      <ExternalLink className="w-3 h-3 ml-0.5 inline opacity-80" />
                                    </a>
                                  );
                                }
                                return part;
                              })}
                            </p>

                            {mapsUrl && (
                              <div className="pt-1">
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span>Open in Google Maps</span>
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Time and Delivery Status Checkmarks */}
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[11px] select-none ${
                        isMe
                          ? isDarkMode ? "text-emerald-200" : "text-emerald-800/80"
                          : isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}>
                        <span>{message.time}</span>
                        {isMe && (() => {
                          const s = message.status?.toLowerCase() || '';
                          if (s === 'read' || s === 'seen') {
                            return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />;
                          }
                          if (s === 'delivered' || s === 'delivery') {
                            return <CheckCheck className="w-3.5 h-3.5 opacity-70" />;
                          }
                          if (s === 'sent' || s === 'accepted' || s === 'enqueued') {
                            return <Check className="w-3.5 h-3.5 opacity-70" />;
                          }
                          return <Clock className="w-3 h-3 opacity-60" />;
                        })()}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer Bar (Safe Area Protected on iOS) */}
      <footer className={`px-3.5 pt-3 pb-4 pb-safe border-t sticky bottom-0 z-30 transition-colors ${
        isDarkMode
          ? "bg-[#111b21] border-[#202c33]"
          : "bg-white border-slate-200 shadow-md"
      }`}>
        {is24hWindowClosed ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
            <p className="text-sm font-medium flex-1">
              24-hour WhatsApp messaging window closed. Send a template message to reopen.
            </p>
            <button
              onClick={openTemplateModal}
              className="text-xs font-bold px-3.5 py-2 rounded-lg bg-amber-500 text-white shrink-0 hover:bg-amber-600 active:scale-95 transition-all"
            >
              Send Template
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2.5">
            {/* Attachment Button */}
            <label className={`p-3 rounded-full cursor-pointer transition-all active:scale-95 shrink-0 mb-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center ${
              isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-[#202c33]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}>
              <input type="file" onChange={uploadMedia} className="hidden" />
              <Paperclip className="w-5 h-5" />
            </label>

            {/* Template Button */}
            <button
              onClick={openTemplateModal}
              title="Send Template"
              className={`p-3 rounded-full transition-all active:scale-95 shrink-0 mb-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center ${
                isDarkMode
                  ? "text-slate-400 hover:text-slate-200 hover:bg-[#202c33]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-5 h-5" />
            </button>

            {/* Auto-expanding Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type message..."
              className={`flex-1 rounded-2xl px-4 py-3 outline-none text-base resize-none overflow-y-auto leading-snug transition-all ${
                isDarkMode
                  ? "bg-[#202c33] text-slate-100 placeholder:text-slate-500 border border-[#2a3942] focus:border-emerald-500"
                  : "bg-slate-100 text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-[#008069]"
              }`}
              style={{ minHeight: '48px', maxHeight: '130px' }}
            />

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sendCooldown || !inputValue.trim()}
              className={`p-3.5 rounded-full shrink-0 mb-0.5 min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95 transition-all shadow-sm ${
                inputValue.trim()
                  ? isDarkMode
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-[#008069] text-white hover:bg-[#006e5a]"
                  : isDarkMode
                  ? "bg-[#202c33] text-slate-500 cursor-not-allowed"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </footer>

      {/* Fullscreen Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged media"
            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Contact Info & Notes Drawer */}
      {showInfo && (
        <div className={`absolute inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-200 ${
          isDarkMode ? "bg-[#111b21] text-slate-100" : "bg-white text-slate-900"
        }`}>
          <div className={`flex items-center justify-between px-4 py-3.5 border-b ${
            isDarkMode ? "border-[#202c33]" : "border-slate-200"
          }`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInfo(false)}
                className="p-1.5 -ml-1 rounded-full text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-bold text-base">Contact Information</h2>
            </div>
            <button
              onClick={() => {
                onSaveContact?.(contactName.trim(), contactNotes.trim());
                setShowInfo(false);
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all active:scale-95 ${
                isDarkMode ? "bg-emerald-600 hover:bg-emerald-500" : "bg-[#008069] hover:bg-[#006e5a]"
              }`}
            >
              Save
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Phone */}
            <div>
              <label className="text-[11px] font-bold tracking-wider block text-slate-400 uppercase mb-1">
                Phone Number
              </label>
              <p className="text-sm font-semibold">{chatId}</p>
            </div>

            {/* Display Name */}
            <div>
              <label className="text-[11px] font-bold tracking-wider block text-slate-400 uppercase mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ${
                  isDarkMode
                    ? "bg-[#202c33] border border-[#2a3942] text-slate-100 focus:border-emerald-500"
                    : "bg-slate-100 border border-slate-200 text-slate-900 focus:border-[#008069]"
                }`}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] font-bold tracking-wider block text-slate-400 uppercase mb-1.5">
                Internal Notes
              </label>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="Child details, preferences, addresses, special requests..."
                rows={3}
                className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none ${
                  isDarkMode
                    ? "bg-[#202c33] border border-[#2a3942] text-slate-100 focus:border-emerald-500"
                    : "bg-slate-100 border border-slate-200 text-slate-900 focus:border-[#008069]"
                }`}
              />
            </div>

            {/* Labels */}
            <div>
              <label className="text-[11px] font-bold tracking-wider block text-slate-400 uppercase mb-1.5">
                Labels
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {labels.map((l) => (
                  <span
                    key={l}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      isDarkMode
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {l}
                    <button
                      onClick={() => {
                        onRemoveLabel?.(l);
                        setLabels((prev) => prev.filter((x) => x !== l));
                      }}
                      className="p-0.5 hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && labelInput.trim()) {
                      const l = labelInput.trim();
                      onAddLabel?.(l);
                      setLabels((prev) => prev.includes(l) ? prev : [...prev, l]);
                      setLabelInput('');
                    }
                  }}
                  placeholder="New label + Enter"
                  className={`flex-1 rounded-xl px-3 py-2 text-sm outline-none ${
                    isDarkMode
                      ? "bg-[#202c33] border border-[#2a3942] text-slate-100"
                      : "bg-slate-100 border border-slate-200 text-slate-900"
                  }`}
                />
                <button
                  onClick={() => {
                    if (labelInput.trim()) {
                      const l = labelInput.trim();
                      onAddLabel?.(l);
                      setLabels((prev) => prev.includes(l) ? prev : [...prev, l]);
                      setLabelInput('');
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-white ${
                    isDarkMode ? "bg-emerald-600" : "bg-[#008069]"
                  }`}
                >
                  Add
                </button>
              </div>
            </div>

            {/* AI Extracted Facts */}
            {customerVars && (
              <div className={`p-3.5 rounded-2xl border ${
                isDarkMode ? "bg-[#202c33]/50 border-[#2a3942]" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center gap-1.5 mb-2 text-emerald-500">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">AI Extracted Memory</span>
                </div>

                {customerVars.children && customerVars.children.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-slate-400 block mb-1">Children</span>
                    <div className="flex flex-wrap gap-1.5">
                      {customerVars.children.map((c: any, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                          {c.name || 'Child'}{c.age ? ` (${c.age})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {customerVars.notes && Object.keys(customerVars.notes).length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    {Object.entries(customerVars.notes).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-slate-400 font-medium">{k}:</span>
                        <span className="font-semibold text-slate-200">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className={`absolute inset-0 z-50 flex flex-col animate-in slide-in-from-bottom duration-200 ${
          isDarkMode ? "bg-[#111b21] text-slate-100" : "bg-white text-slate-900"
        }`}>
          <div className={`flex items-center justify-between px-4 py-3.5 border-b ${
            isDarkMode ? "border-[#202c33]" : "border-slate-200"
          }`}>
            <div className="flex items-center gap-2">
              {selectedTemplate ? (
                <button
                  onClick={() => { setSelectedTemplate(null); setTemplateVars([]); }}
                  className="p-1.5 -ml-1 rounded-full text-slate-400 hover:text-slate-200"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="p-1.5 -ml-1 rounded-full text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <h2 className="font-bold text-base">
                {selectedTemplate ? selectedTemplate.name : "Select Template"}
              </h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selectedTemplate ? (
              templatesLoading ? (
                <p className="text-center text-sm py-10 text-slate-400">Loading templates...</p>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id || t.name}
                    onClick={() => { setSelectedTemplate(t); setTemplateVars([]); }}
                    className={`w-full text-left rounded-xl p-3.5 border transition-all active:scale-[0.99] ${
                      isDarkMode
                        ? "bg-[#202c33] border-[#2a3942] hover:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 hover:border-[#008069]"
                    }`}
                  >
                    <p className="text-sm font-bold text-emerald-500 mb-1">{t.name}</p>
                    <p className="text-xs text-slate-400 line-clamp-2">{t.body || t.text}</p>
                  </button>
                ))
              )
            ) : (
              <div className="space-y-4">
                <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  isDarkMode ? "bg-[#202c33] border-[#2a3942] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                }`}>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Preview</p>
                  {selectedTemplate.body || selectedTemplate.text}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-400">Variables</span>
                    <button
                      onClick={() => setTemplateVars((prev) => [...prev, ''])}
                      className="text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                    >
                      + Add Variable
                    </button>
                  </div>

                  {templateVars.map((v, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={v}
                          onChange={(e) => setTemplateVars((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                          placeholder={`Variable {{${i + 1}}}`}
                          className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none ${
                            isDarkMode ? "bg-[#202c33] border border-[#2a3942] text-slate-100" : "bg-slate-100 border border-slate-200 text-slate-900"
                          }`}
                        />
                        <button onClick={() => setTemplateVars((prev) => prev.filter((_, j) => j !== i))} className="text-rose-400 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                        {['today', 'tomorrow', 'this evening'].map((quick) => (
                          <button
                            key={quick}
                            onClick={() => setTemplateVars((prev) => prev.map((x, j) => j === i ? quick : x))}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                          >
                            {quick}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={sendTemplate}
                  disabled={templateSending}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-sm ${
                    isDarkMode ? "bg-emerald-600 hover:bg-emerald-500" : "bg-[#008069] hover:bg-[#006e5a]"
                  }`}
                >
                  {templateSending ? "Sending Template..." : "Send Template Now"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Confirmation Modal */}
      {showCalModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCalModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-t-3xl p-5 pb-8 shadow-2xl flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 ${
              isDarkMode ? "bg-[#111b21] border-t border-[#202c33]" : "bg-white border-t border-slate-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1 shrink-0" />

            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">
                {calSuccess ? "✓ Event Created!" : "Add Session to Calendar"}
              </h2>
              <button onClick={() => setShowCalModal(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {calSuccess ? (
              <p className="text-emerald-500 text-sm font-semibold py-4 text-center">
                Session saved to KidDost calendar.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  AI extracted these session details from conversation history. Verify and tap save.
                </p>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={calTitle}
                    onChange={(e) => setCalTitle(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ${
                      isDarkMode ? "bg-[#202c33] border border-[#2a3942] text-slate-100" : "bg-slate-100 border border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={calDate}
                    onChange={(e) => setCalDate(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ${
                      isDarkMode ? "bg-[#202c33] border border-[#2a3942] text-slate-100" : "bg-slate-100 border border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Start Time</label>
                    <input
                      type="time"
                      value={calStart}
                      onChange={(e) => setCalStart(e.target.value)}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ${
                        isDarkMode ? "bg-[#202c33] border border-[#2a3942] text-slate-100" : "bg-slate-100 border border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">End Time</label>
                    <input
                      type="time"
                      value={calEnd}
                      onChange={(e) => setCalEnd(e.target.value)}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ${
                        isDarkMode ? "bg-[#202c33] border border-[#2a3942] text-slate-100" : "bg-slate-100 border border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Assigned Member</label>
                  <input
                    type="text"
                    value={calMember}
                    onChange={(e) => setCalMember(e.target.value)}
                    placeholder="e.g. Priya, Rahul..."
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none ${
                      isDarkMode ? "bg-[#202c33] border border-[#2a3942] text-slate-100" : "bg-slate-100 border border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Notes / Address</label>
                  <textarea
                    value={calNotes}
                    onChange={(e) => setCalNotes(e.target.value)}
                    placeholder="Society name, flat number, special instructions..."
                    rows={2}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none ${
                      isDarkMode ? "bg-[#202c33] border border-[#2a3942] text-slate-100" : "bg-slate-100 border border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                {/* Trial Pill Toggle */}
                <button
                  type="button"
                  onClick={() => setCalTrial(!calTrial)}
                  className={`flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold border transition-all ${
                    calTrial
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-500"
                      : isDarkMode
                      ? "bg-[#202c33] border-[#2a3942] text-slate-400"
                      : "bg-slate-100 border-slate-200 text-slate-600"
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-white ${
                    calTrial ? "bg-amber-500" : "bg-slate-400"
                  }`}>
                    {calTrial ? "✓" : ""}
                  </div>
                  Introductory / Trial Session (₹500)
                </button>

                <button
                  onClick={saveCalEvent}
                  disabled={calSaving || !calTitle.trim() || !calDate}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-sm ${
                    isDarkMode ? "bg-emerald-600 hover:bg-emerald-500" : "bg-[#008069] hover:bg-[#006e5a]"
                  }`}
                >
                  {calSaving ? "Saving..." : "Save Session"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
