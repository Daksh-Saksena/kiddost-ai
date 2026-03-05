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

export function ChatList({ onSelectChat, isDarkMode, onToggleTheme }: ChatListProps) {
  const chats: Chat[] = [
    {
      id: "1",
      name: "Sarah Wilson",
      avatar: "https://images.unsplash.com/photo-1649589244330-09ca58e4fa64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MjU4MzU1N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      lastMessage: "Hey! How are you doing?",
      time: "10:30 AM",
      unread: 2,
    },
    {
      id: "2",
      name: "Michael Chen",
      avatar: "https://images.unsplash.com/photo-1746791006255-6337e86080f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBidXNpbmVzc3xlbnwxfHx8fDE3NzI2NTMwODN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      lastMessage: "The meeting is at 3 PM",
      time: "9:45 AM",
    },
    {
      id: "3",
      name: "Emma Davis",
      avatar: "https://images.unsplash.com/photo-1609043238951-9bb29775f27c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHBlcnNvbiUyMHNtaWxpbmd8ZW58MXx8fHwxNzcyNjg0MTg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      lastMessage: "Thanks for your help!",
      time: "Yesterday",
    },
    {
      id: "4",
      name: "James Rodriguez",
      avatar: "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMG1hbGV8ZW58MXx8fHwxNzcyNjc4MzI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      lastMessage: "Sounds good to me 👍",
      time: "Yesterday",
    },
    {
      id: "5",
      name: "Lisa Anderson",
      avatar: "https://images.unsplash.com/photo-1609091289242-735df7a2207a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGNhc3VhbCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MjY3OTk1OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      lastMessage: "Can you send me the files?",
      time: "Tuesday",
      unread: 1,
    },
  ];

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? "bg-black" : "bg-white"}`}>
      {/* Header */}
      <div className={`text-white px-4 py-4 relative overflow-hidden ${
        isDarkMode 
          ? "bg-gray-950 border-b border-blue-900/30" 
          : "bg-[#008069]"
      }`}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl flex-1 text-center">
            Chats
          </h1>
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-full transition-all ${
              isDarkMode 
                ? "hover:bg-blue-900/30" 
                : "hover:bg-white/10"
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
              isDarkMode 
                ? "text-gray-300 placeholder:text-gray-600" 
                : "text-gray-900 placeholder:text-gray-500"
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
              <img
                src={chat.avatar}
                alt={chat.name}
                className="w-14 h-14 rounded-full object-cover"
              />
            </div>
            <div className="flex-1 ml-4 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className={`font-medium truncate ${
                  isDarkMode ? "text-gray-100" : "text-gray-900"
                }`}>
                  {chat.name}
                </h3>
                <span className={`text-xs ml-2 flex-shrink-0 ${
                  isDarkMode ? "text-blue-400" : "text-gray-500"
                }`}>
                  {chat.time}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <p className={`text-sm truncate ${
                  isDarkMode ? "text-gray-500" : "text-gray-600"
                }`}>
                  {chat.lastMessage}
                </p>
                {chat.unread && (
                  <span className={`ml-2 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ${
                    isDarkMode 
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500" 
                      : "bg-[#25d366]"
                  }`}
                        style={isDarkMode ? { boxShadow: '0 0 15px rgba(59, 130, 246, 0.7)' } : {}}>
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
