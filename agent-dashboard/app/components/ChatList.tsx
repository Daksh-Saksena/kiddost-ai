"use client";

import React, { useState, useMemo } from "react";
import { Search, Moon, Sun, LogOut, Trash2, PenSquare, X, Pin, CalendarDays, AlertCircle, MessageSquare, Sparkles, Filter } from "lucide-react";

const SERVER = 'https://kiddost-ai.onrender.com';

const KNOWN_TEMPLATES = [
  { id: 'session', name: 'Session Today?', body: 'Hi, Would you like to go ahead with the session today?' },
  { id: 'confirm_booking', name: 'Confirm Booking', body: 'Hi! Would you like to go ahead and confirm your booking for tomorrow?' },
  { id: 'slots_available', name: 'Slots Available', body: 'Hi! We have slots available {{1}} . Would you like to try a session and see how it works for you?' }
];

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread?: number;
  agent?: string | null;
  labels?: string[];
  pinned?: boolean;
  needsHuman?: boolean;
  lastMsgAt?: string | null;
}

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onDeleteAccount?: () => void;
  chats: Chat[];
  onTogglePin: (chatId: string) => void;
  onOpenCalendar: () => void;
  allRecentMessages?: any[];
  loading?: boolean;
}

export function ChatList({
  onSelectChat,
  isDarkMode,
  onToggleTheme,
  onLogout,
  onDeleteAccount,
  chats,
  onTogglePin,
  onOpenCalendar,
  allRecentMessages = [],
  loading = false,
}: ChatListProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<'all' | 'needsHuman' | 'unread' | 'pinned'>('all');
  const [sort, setSort] = useState<'latest' | 'az' | 'agent'>('latest');
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newTemplateSending, setNewTemplateSending] = useState(false);
  const [newConvoError, setNewConvoError] = useState('');
  const [newConvoSuccess, setNewConvoSuccess] = useState(false);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    return raw.startsWith('+') ? raw : `+${digits}`;
  };

  const sendNewConvo = async (templateId: string) => {
    const phone = formatPhone(newPhone.trim());
    if (!phone || newTemplateSending) return;
    setNewTemplateSending(true);
    setNewConvoError('');
    try {
      const res = await fetch(`${SERVER}/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, templateId, variables: [] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setNewConvoSuccess(true);
      setTimeout(() => {
        setShowNewConvo(false);
        setNewPhone('');
        setNewConvoSuccess(false);
      }, 1500);
    } catch (e: any) {
      setNewConvoError(e.message || 'Could not send');
    } finally {
      setNewTemplateSending(false);
    }
  };

  // Pre-calculate filter counts with useMemo for zero-lag updates
  const needsHumanCount = useMemo(() => chats.filter(c => c.needsHuman).length, [chats]);
  const unreadCount = useMemo(() => chats.filter(c => (c.unread || 0) > 0).length, [chats]);
  const pinnedCount = useMemo(() => chats.filter(c => c.pinned).length, [chats]);

  // 1. Filter chats by active tab
  const filterApplied = useMemo(() => {
    if (activeFilter === 'needsHuman') return chats.filter(c => c.needsHuman);
    if (activeFilter === 'unread') return chats.filter(c => (c.unread || 0) > 0);
    if (activeFilter === 'pinned') return chats.filter(c => c.pinned);
    return chats;
  }, [chats, activeFilter]);

  // 2. Filter chats by search query (instant memoized search)
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filterApplied;
    return filterApplied.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.lastMessage.toLowerCase().includes(q)) return true;
      return allRecentMessages.some(
        (m) => m.phone === c.id && m.content && m.content.toLowerCase().includes(q)
      );
    });
  }, [filterApplied, query, allRecentMessages]);

  // 3. Sort chats
  const sorted = useMemo(() => {
    const list = [...searchResults];
    if (sort === 'az') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sort === 'agent') {
      return list.sort((a, b) => (a.agent || 'AI').localeCompare(b.agent || 'AI'));
    }
    // Default 'latest': pinned first, then chronological
    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
      const timeA = a.lastMsgAt ? new Date(a.lastMsgAt).getTime() : 0;
      const timeB = b.lastMsgAt ? new Date(b.lastMsgAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [searchResults, sort]);

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? "bg-[#0b141a] text-slate-100" : "bg-white text-slate-900"}`}>
      {/* Sleek Mobile Header */}
      <header className={`px-4 pt-3.5 pb-3 sticky top-0 z-30 transition-colors shadow-sm ${
        isDarkMode
          ? "bg-[#111b21] border-b border-[#202c33]"
          : "bg-[#008069] text-white"
      }`}>
        <div className="flex items-center justify-between gap-2">
          {/* Left: Clean title */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Chats</h1>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onOpenCalendar}
              title="Calendar"
              className={`p-2 rounded-full transition-all active:scale-95 ${
                isDarkMode ? "text-slate-300 hover:text-white hover:bg-[#202c33]" : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              <CalendarDays className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setShowNewConvo(true);
                setNewPhone('');
                setNewConvoError('');
                setNewConvoSuccess(false);
              }}
              title="New Conversation"
              className={`p-2 rounded-full transition-all active:scale-95 ${
                isDarkMode ? "text-slate-300 hover:text-white hover:bg-[#202c33]" : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              <PenSquare className="w-5 h-5" />
            </button>

            <button
              onClick={onToggleTheme}
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
              className={`p-2 rounded-full transition-all active:scale-95 ${
                isDarkMode ? "text-amber-400 hover:bg-[#202c33]" : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={onLogout}
              title="Logout"
              className={`p-2 rounded-full transition-all active:scale-95 ${
                isDarkMode ? "text-slate-400 hover:text-white hover:bg-[#202c33]" : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Sticky Search & Filter Control Bar */}
      <div className={`px-3 py-2.5 sticky top-[57px] z-20 transition-colors border-b ${
        isDarkMode
          ? "bg-[#111b21]/95 backdrop-blur-md border-[#202c33]"
          : "bg-white/95 backdrop-blur-md border-slate-100"
      }`}>
        {/* Search Bar Input */}
        <div className={`flex items-center rounded-xl px-3.5 py-2.5 transition-all ${
          isDarkMode
            ? "bg-[#202c33] text-slate-100 focus-within:ring-2 focus-within:ring-emerald-500/30"
            : "bg-slate-100 text-slate-900 focus-within:ring-2 focus-within:ring-[#008069]/20"
        }`}>
          <Search className={`w-4 h-4 shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone or message..."
            className="flex-1 ml-2.5 bg-transparent outline-none text-[15px] placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips Bar (Mobile Horizontal Scrolling) */}
        <div className="flex items-center gap-2 mt-2.5 overflow-x-auto no-scrollbar pb-0.5">
          {/* ALL */}
          <button
            onClick={() => setActiveFilter('all')}
            className={`text-[13px] px-3.5 py-1.5 rounded-full font-medium shrink-0 transition-all flex items-center gap-1.5 ${
              activeFilter === 'all'
                ? isDarkMode
                  ? "bg-slate-100 text-slate-900 shadow-sm font-semibold"
                  : "bg-[#008069] text-white shadow-sm font-semibold"
                : isDarkMode
                ? "bg-[#202c33] text-slate-400 hover:text-slate-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeFilter === 'all'
                ? isDarkMode ? "bg-slate-300 text-slate-900" : "bg-emerald-800 text-white"
                : isDarkMode ? "bg-[#111b21] text-slate-400" : "bg-slate-200 text-slate-600"
            }`}>
              {chats.length}
            </span>
          </button>

          {/* NEEDS HUMAN */}
          <button
            onClick={() => setActiveFilter('needsHuman')}
            className={`text-[13px] px-3.5 py-1.5 rounded-full font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
              activeFilter === 'needsHuman'
                ? "bg-rose-600 text-white shadow-sm"
                : needsHumanCount > 0
                ? isDarkMode
                  ? "bg-rose-950/60 text-rose-300 border border-rose-800/40 hover:bg-rose-900/60"
                  : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                : isDarkMode
                ? "bg-[#202c33] text-slate-400 hover:text-slate-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {needsHumanCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            )}
            Needs Attention
            {needsHumanCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeFilter === 'needsHuman' ? "bg-rose-800 text-white" : "bg-rose-500 text-white"
              }`}>
                {needsHumanCount}
              </span>
            )}
          </button>

          {/* UNREAD */}
          <button
            onClick={() => setActiveFilter('unread')}
            className={`text-[13px] px-3.5 py-1.5 rounded-full font-medium shrink-0 transition-all flex items-center gap-1.5 ${
              activeFilter === 'unread'
                ? isDarkMode
                  ? "bg-emerald-600 text-white shadow-sm font-semibold"
                  : "bg-[#008069] text-white shadow-sm font-semibold"
                : unreadCount > 0
                ? isDarkMode
                  ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-semibold"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
                : isDarkMode
                ? "bg-[#202c33] text-slate-400 hover:text-slate-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] shrink-0" />
            )}
            Unread
            {unreadCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeFilter === 'unread' ? "bg-emerald-800 text-white" : "bg-[#25D366] text-white"
              }`}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* PINNED */}
          <button
            onClick={() => setActiveFilter('pinned')}
            className={`text-[13px] px-3.5 py-1.5 rounded-full font-medium shrink-0 transition-all flex items-center gap-1.5 ${
              activeFilter === 'pinned'
                ? isDarkMode
                  ? "bg-amber-500 text-slate-900 font-semibold shadow-sm"
                  : "bg-amber-500 text-white font-semibold shadow-sm"
                : isDarkMode
                ? "bg-[#202c33] text-slate-400 hover:text-slate-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Pin className="w-3.5 h-3.5" fill={pinnedCount > 0 ? "currentColor" : "none"} />
            Pinned
            {pinnedCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeFilter === 'pinned' ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800"
              }`}>
                {pinnedCount}
              </span>
            )}
          </button>

          {/* Sort Switcher (Latest / A-Z / Agent) */}
          <div className="ml-auto flex items-center pl-1 shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className={`text-xs px-3 py-1.5 rounded-full border outline-none cursor-pointer font-semibold ${
                isDarkMode
                  ? "bg-[#202c33] border-[#2a3942] text-slate-200"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <option value="latest">Latest</option>
              <option value="az">A – Z</option>
              <option value="agent">Agent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chat List View */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading && chats.length === 0 ? (
          /* Sleek Skeleton Loading state */
          <div className="divide-y divide-slate-100 dark:divide-[#202c33]/50">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center px-4 py-3.5 animate-pulse gap-3.5">
                <div className="w-13 h-13 rounded-full bg-slate-200 dark:bg-[#202c33] shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-[#202c33] rounded w-2/5" />
                  <div className="h-3.5 bg-slate-100 dark:bg-[#202c33]/70 rounded w-4/5" />
                </div>
                <div className="h-3 bg-slate-100 dark:bg-[#202c33]/70 rounded w-10 shrink-0" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
              isDarkMode ? "bg-[#202c33] text-slate-500" : "bg-slate-100 text-slate-400"
            }`}>
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="font-semibold text-base mb-1">
              {query ? "No matching chats" : activeFilter === 'needsHuman' ? "All clear! No chats need attention" : "No chats yet"}
            </h3>
            <p className={`text-xs max-w-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              {query
                ? "Try searching for a different name, phone number, or message keyword."
                : activeFilter === 'needsHuman'
                ? "AI is handling all current conversations smoothly."
                : "New incoming WhatsApp leads will appear here automatically."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#202c33]/50">
            {sorted.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`flex items-center px-4 py-3.5 cursor-pointer transition-all active:scale-[0.99] select-none ${
                  isDarkMode
                    ? "hover:bg-[#202c33]/40 active:bg-[#202c33]/80"
                    : "hover:bg-slate-50 active:bg-slate-100"
                } ${chat.needsHuman ? (isDarkMode ? "bg-rose-950/15" : "bg-rose-50/40") : ""}`}
              >
                {/* Avatar with Status Badge */}
                <div className="relative shrink-0 mr-3.5">
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-13 h-13 rounded-full object-cover shadow-sm"
                  />
                  {chat.needsHuman && (
                    /* Solid static red dot */
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white dark:border-[#111b21]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className={`font-bold text-[17px] truncate leading-tight ${
                      isDarkMode ? "text-slate-100" : "text-slate-900"
                    }`}>
                      {chat.name}
                    </h3>
                    <span className={`text-xs font-semibold shrink-0 ${
                      chat.unread ? (isDarkMode ? "text-emerald-400" : "text-[#008069]") : (isDarkMode ? "text-slate-500" : "text-slate-400")
                    }`}>
                      {chat.time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[14px] truncate flex-1 leading-snug ${
                      chat.unread
                        ? (isDarkMode ? "font-semibold text-slate-100" : "font-semibold text-slate-900")
                        : (isDarkMode ? "text-slate-400" : "text-slate-600")
                    }`}>
                      {chat.lastMessage || "No messages yet"}
                    </p>

                    {/* Uniform Right Action Group: [Number of Notifications] -> [AI or Admin] -> [Pin] */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Number of notifications pill (left of AI/Admin) */}
                      {Boolean(chat.unread) && (
                        <span className="text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center bg-[#25D366] shadow-sm">
                          {chat.unread}
                        </span>
                      )}

                      {/* AI or Admin / Agent badge (middle: left of Pin, right of Notifications) */}
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full min-w-[34px] text-center tracking-wide ${
                        chat.agent
                          ? isDarkMode
                            ? "bg-[#202c33] text-blue-300 border border-blue-900/40"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                          : chat.needsHuman
                          ? isDarkMode
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                          : isDarkMode
                          ? "bg-[#202c33] text-slate-300 border border-[#2a3942]"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                        {chat.agent || (chat.needsHuman ? "Admin" : "AI")}
                      </span>

                      {/* Pin Button (far right) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(chat.id);
                        }}
                        title={chat.pinned ? "Unpin chat" : "Pin chat"}
                        className={`p-1 rounded-full transition-colors ${
                          chat.pinned
                            ? "text-amber-500 hover:text-amber-600"
                            : isDarkMode
                            ? "text-slate-600 hover:text-slate-400"
                            : "text-slate-300 hover:text-slate-600"
                        }`}
                      >
                        <Pin className="w-4 h-4" fill={chat.pinned ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>

                  {/* Contact Labels */}
                  {chat.labels && chat.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {chat.labels.map((l) => (
                        <span
                          key={l}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                            isDarkMode
                              ? "bg-slate-800 text-emerald-300 border border-emerald-900/40"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Conversation Modal Bottom Sheet */}
      {showNewConvo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setShowNewConvo(false)}
        >
          <div
            className={`w-full max-w-md rounded-t-3xl p-5 pb-8 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-200 ${
              isDarkMode ? "bg-[#111b21] border-t border-[#202c33]" : "bg-white border-t border-slate-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Handle */}
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-1" />

            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">Start New Conversation</h2>
              <button
                onClick={() => setShowNewConvo(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold tracking-wider mb-1.5 block uppercase text-slate-400">
                Phone Number
              </label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(e.target.value);
                  setNewConvoError('');
                }}
                placeholder="e.g. 9606746900 or +919606746900"
                className={`w-full rounded-xl px-4 py-3 text-base outline-none transition-all ${
                  isDarkMode
                    ? "bg-[#202c33] border border-[#2a3942] text-slate-100 placeholder:text-slate-500 focus:border-emerald-500"
                    : "bg-slate-100 border border-slate-200 text-slate-900 focus:border-[#008069]"
                }`}
              />
            </div>

            <button
              onClick={() => {
                const phone = formatPhone(newPhone.trim());
                if (!phone) return;
                setShowNewConvo(false);
                setNewPhone('');
                onSelectChat(phone);
              }}
              disabled={!newPhone.trim()}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all shadow-sm ${
                isDarkMode
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-[#008069] text-white hover:bg-[#006e5a]"
              }`}
            >
              Open Direct Chat
            </button>

            <div>
              <label className="text-[11px] font-bold tracking-wider mb-2 block uppercase text-slate-400">
                Or Send Outbound Template
              </label>
              <div className="flex flex-col gap-2">
                {KNOWN_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => sendNewConvo(t.id)}
                    disabled={!newPhone.trim() || newTemplateSending || newConvoSuccess}
                    className={`w-full text-left rounded-xl px-4 py-3 border transition-all disabled:opacity-40 active:scale-[0.99] ${
                      isDarkMode
                        ? "bg-[#202c33] border-[#2a3942] hover:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 hover:border-[#008069]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-emerald-500">
                      {newConvoSuccess ? "✓ Sent!" : newTemplateSending ? "Sending…" : t.name}
                    </p>
                    <p className={`text-xs mt-0.5 line-clamp-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {t.body}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {newConvoError && (
              <p className="text-rose-500 text-xs font-medium text-center">{newConvoError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
