"use client";

import { Search, Moon, Sun } from "lucide-react";

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread?: number;
}

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export function ChatList({ onSelectChat, isDarkMode, onToggleTheme, chats }: ChatListProps & { chats: Chat[] }) {
  return (
    <div className={`flex flex-col h-full ${isDarkMode ? "bg-black" : "bg-white"}`}>
      {/* Header */}
      <div className={`text-white px-4 py-4 relative overflow-hidden ${
        isDarkMode
          ? "bg-gray-950 border-b border-blue-900/30"
          : "bg-[#008069]"
      }`}>
        <div className="flex items-center justify-between">
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
            placeholder={isDarkMode ? "Search transmissions..." : "Search or start new chat"}
            className={`flex-1 ml-3 bg-transparent outline-none text-sm ${
              isDarkMode ? "text-gray-300 placeholder:text-gray-600" : "text-gray-900 placeholder:text-gray-500"
            }`}
          />
        </div>
      </div>

      {/* Chat List */}
      <div className={`flex-1 overflow-y-auto ${isDarkMode ? "bg-black" : "bg-white"}`}>
        {chats.map((chat) => (
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
                {chat.unread && (
                  <span className={`ml-2 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ${
                    isDarkMode ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-[#25d366]"
                  }`} style={isDarkMode ? { boxShadow: '0 0 15px rgba(59, 130, 246, 0.7)' } : {}}>
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
