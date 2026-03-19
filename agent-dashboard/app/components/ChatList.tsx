"use client";

import { useState } from "react";
import { Search, Moon, Sun, LogOut, Trash2 } from "lucide-react";

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread?: number;
  agent?: string | null;
  labels?: string[];
}

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onDeleteAccount?: () => void;
  chats: Chat[];
}

export function ChatList({ onSelectChat, isDarkMode, onToggleTheme, onLogout, onDeleteAccount, chats }: ChatListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<'latest' | 'az' | 'agent'>('latest');

  const filtered = query.trim()
    ? chats.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(query.toLowerCase())
      )
    : chats;

  const sorted = sort === 'az'
    ? [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    : sort === 'agent'
    ? [...filtered].sort((a, b) => (a.agent || 'AI').localeCompare(b.agent || 'AI'))
    : filtered;

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? "bg-black" : "bg-white"}`}>
      {/* Header */}
      <div className={`text-white px-4 py-4 relative overflow-hidden ${
        isDarkMode
          ? "bg-gray-950 border-b border-blue-900/30"
          : "bg-[#008069]"
      }`}>
        <div className="flex items-center justify-between">
          <button
            onClick={onLogout}
            title="Logout"
            className={`p-2 rounded-full transition-all ${
              isDarkMode ? "hover:bg-blue-900/30 text-gray-400 hover:text-white" : "hover:bg-white/10"
            }`}
          >
            <LogOut className="w-5 h-5" />
          </button>
          {onDeleteAccount && (
            <button
              onClick={onDeleteAccount}
              title="Delete Account"
              className={`p-2 rounded-full transition-all ${
                isDarkMode ? "hover:bg-red-900/30 text-red-500/70 hover:text-red-400" : "hover:bg-red-500/10 text-red-300 hover:text-red-200"
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-xl flex-1 text-center">Chats</h1>
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-full transition-all ${
              isDarkMode ? "hover:bg-blue-900/30" : "hover:bg-white/10"
            }`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className={`px-4 py-3 ${
        isDarkMode
          ? "bg-gradient-to-b from-gray-900 to-black border-b border-blue-900/30"
          : "bg-white border-b border-gray-200"
      }`}>
        <div className={`flex items-center rounded-xl px-4 py-2.5 ${
          isDarkMode
            ? "bg-gray-900/50 border border-blue-500/20 backdrop-blur-sm"
            : "bg-gray-100"
        }`}>
          <Search className={`w-5 h-5 ${isDarkMode ? "text-blue-400" : "text-gray-500"}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isDarkMode ? "Search transmissions..." : "Search or start new chat"}
            className={`flex-1 ml-3 bg-transparent outline-none text-sm ${
              isDarkMode ? "text-gray-300 placeholder:text-gray-600" : "text-gray-900 placeholder:text-gray-500"
            }`}
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-500 hover:text-gray-300 text-xs ml-2">✕</button>
          )}
        </div>
        {/* Sort pills */}
        <div className="flex gap-2 mt-2">
          {(['latest', 'az', 'agent'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-xs px-3 py-1 rounded-full transition-all ${
                sort === s
                  ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-[#008069] text-white'
                  : isDarkMode ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s === 'latest' ? 'Latest' : s === 'az' ? 'A – Z' : 'Agent'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className={`flex-1 overflow-y-auto ${isDarkMode ? "bg-black" : "bg-white"}`}>
        {sorted.length === 0 && (
          <p className={`text-center text-sm mt-10 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
            {query ? "No chats match your search." : "No chats yet."}
          </p>
        )}
        {sorted.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`flex items-center px-4 py-4 cursor-pointer transition-all duration-200 ${
              isDarkMode
                ? "border-b border-blue-900/20 hover:bg-gradient-to-r hover:from-blue-950/50 hover:to-transparent active:from-blue-900/50"
                : "border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100"
            }`}
          >
            <div className="relative">
              <img src={chat.avatar} alt={chat.name} className="w-14 h-14 rounded-full object-cover" />
            </div>
            <div className="flex-1 ml-4 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className={`font-medium truncate ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>{chat.name}</h3>
                <span className={`text-xs ml-2 flex-shrink-0 ${isDarkMode ? "text-blue-400" : "text-gray-500"}`}>{chat.time}</span>
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <p className={`text-sm truncate ${isDarkMode ? "text-gray-500" : "text-gray-600"}`}>{chat.lastMessage}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {chat.agent && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isDarkMode ? 'bg-blue-900/50 text-blue-300 border border-blue-700/40' : 'bg-gray-100 text-gray-600'
                    }`}>{chat.agent}</span>
                  )}
                  {chat.unread ? (
                    <span className={`text-white text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ${
                      isDarkMode ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-[#25d366]"
                    }`} style={isDarkMode ? { boxShadow: '0 0 15px rgba(59, 130, 246, 0.7)' } : {}}>
                      {chat.unread}
                    </span>
                  ) : null}
                </div>
              </div>
              {chat.labels && chat.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {chat.labels.map(l => (
                    <span key={l} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isDarkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-green-100 text-green-700'
                    }`}>{l}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

