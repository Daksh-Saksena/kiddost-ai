import { useState } from "react";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Check,
  CheckCheck,
} from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "me" | "other";
  time: string;
  read?: boolean;
}

interface ChatDetailProps {
  chatId: string;
  onBack: () => void;
  isDarkMode: boolean;
}

const chatData: Record<
  string,
  { name: string; avatar: string; messages: Message[] }
> = {
  "1": {
    name: "Sarah Wilson",
    avatar:
      "https://images.unsplash.com/photo-1649589244330-09ca58e4fa64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MjU4MzU1N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    messages: [
      {
        id: "1",
        text: "Hey! How are you doing?",
        sender: "other",
        time: "10:30 AM",
      },
      {
        id: "2",
        text: "I'm doing great! How about you?",
        sender: "me",
        time: "10:32 AM",
        read: true,
      },
      {
        id: "3",
        text: "Pretty good! Just working on some projects",
        sender: "other",
        time: "10:33 AM",
      },
      {
        id: "4",
        text: "That sounds exciting! What are you working on?",
        sender: "me",
        time: "10:35 AM",
        read: false,
      },
    ],
  },
  "2": {
    name: "Michael Chen",
    avatar:
      "https://images.unsplash.com/photo-1746791006255-6337e86080f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBidXNpbmVzc3xlbnwxfHx8fDE3NzI2NTMwODN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    messages: [
      {
        id: "1",
        text: "Don't forget about the meeting today",
        sender: "other",
        time: "9:40 AM",
      },
      {
        id: "2",
        text: "Thanks for the reminder!",
        sender: "me",
        time: "9:42 AM",
        read: true,
      },
      {
        id: "3",
        text: "The meeting is at 3 PM",
        sender: "other",
        time: "9:45 AM",
      },
    ],
  },
  "3": {
    name: "Emma Davis",
    avatar:
      "https://images.unsplash.com/photo-1609043238951-9bb29775f27c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHBlcnNvbiUyMHNtaWxpbmd8ZW58MXx8fHwxNzcyNjg0MTg3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    messages: [
      {
        id: "1",
        text: "Thanks for your help!",
        sender: "other",
        time: "Yesterday",
      },
      {
        id: "2",
        text: "No problem, happy to help!",
        sender: "me",
        time: "Yesterday",
        read: true,
      },
    ],
  },
  "4": {
    name: "James Rodriguez",
    avatar:
      "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMG1hbGV8ZW58MXx8fHwxNzcyNjc4MzI0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    messages: [
      {
        id: "1",
        text: "Want to grab lunch tomorrow?",
        sender: "me",
        time: "Yesterday",
        read: false,
      },
      {
        id: "2",
        text: "Sounds good to me 👍",
        sender: "other",
        time: "Yesterday",
      },
    ],
  },
  "5": {
    name: "Lisa Anderson",
    avatar:
      "https://images.unsplash.com/photo-1609091289242-735df7a2207a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGNhc3VhbCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MjY3OTk1OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    messages: [
      {
        id: "1",
        text: "Can you send me the files?",
        sender: "other",
        time: "Tuesday",
      },
    ],
  },
};

export function ChatDetail({
  chatId,
  onBack,
  isDarkMode,
}: ChatDetailProps) {
  const chat = chatData[chatId];
  const [messages, setMessages] = useState<Message[]>(
    chat.messages,
  );
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (inputValue.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputValue,
        sender: "me",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages([...messages, newMessage]);
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`flex flex-col h-full relative overflow-hidden ${
        isDarkMode ? "bg-black" : "bg-[#efeae2]"
      }`}
    >
      {/* Animated background stars - only in dark mode */}
      {isDarkMode && (
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute w-1 h-1 bg-blue-400 rounded-full top-[10%] left-[20%]"
            style={{
              boxShadow: "0 0 3px rgba(96, 165, 250, 0.8)",
            }}
          ></div>
          <div
            className="absolute w-1 h-1 bg-cyan-400 rounded-full top-[30%] left-[80%]"
            style={{
              boxShadow: "0 0 3px rgba(34, 211, 238, 0.8)",
            }}
          ></div>
          <div
            className="absolute w-1 h-1 bg-blue-300 rounded-full top-[60%] left-[15%]"
            style={{
              boxShadow: "0 0 3px rgba(147, 197, 253, 0.8)",
            }}
          ></div>
          <div
            className="absolute w-1 h-1 bg-cyan-300 rounded-full top-[80%] left-[70%]"
            style={{
              boxShadow: "0 0 3px rgba(103, 232, 249, 0.8)",
            }}
          ></div>
        </div>
      )}

      {/* Header */}
      <div
        className={`text-white px-4 py-3 flex items-center relative z-10 ${
          isDarkMode
            ? "bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900"
            : "bg-[#008069]"
        }`}
      >
        {isDarkMode && (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
        )}
        <button
          onClick={onBack}
          className={`mr-3 relative z-10 ${isDarkMode ? "hover:scale-110" : ""} transition-transform`}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="relative">
          <img
            src={chat.avatar}
            alt={chat.name}
            className="w-11 h-11 rounded-full object-cover"
          />
        </div>
        <div className="flex-1 ml-3 relative z-10">
          <h2 className="font-medium">{chat.name}</h2>
          <p
            className={`text-xs ${isDarkMode ? "text-white" : "text-gray-200"}`}
          >
            Online
          </p>
        </div>
        <button
          className={`relative z-10 ${isDarkMode ? "hover:scale-110" : ""} transition-transform`}
        >
          <MoreVertical className="w-6 h-6" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 relative z-10">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "me"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isDarkMode
                  ? message.sender === "me"
                    ? "bg-gradient-to-r from-blue-800 to-blue-700 text-white backdrop-blur-sm"
                    : "bg-gray-900/80 text-gray-100 border border-blue-500/20 backdrop-blur-sm"
                  : message.sender === "me"
                    ? "bg-[#d9fdd3]"
                    : "bg-white"
              }`}
              style={
                isDarkMode
                  ? message.sender === "me"
                    ? {
                        boxShadow:
                          "0 0 15px rgba(37, 99, 235, 0.2)",
                      }
                    : {
                        boxShadow:
                          "0 0 15px rgba(59, 130, 246, 0.1)",
                      }
                  : {}
              }
            >
              <p
                className={`text-sm ${isDarkMode ? "" : "text-gray-900"}`}
              >
                {message.text}
              </p>
              <div
                className={`flex items-center justify-end gap-1 mt-1.5 text-xs ${
                  isDarkMode
                    ? message.sender === "me"
                      ? "text-blue-200"
                      : "text-blue-400"
                    : "text-gray-500"
                }`}
              >
                <span>{message.time}</span>
                {message.sender === "me" &&
                  (message.read ? (
                    <CheckCheck className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Check className="w-4 h-4" />
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        className={`px-4 py-3 flex items-center gap-3 relative z-10 ${
          isDarkMode
            ? "bg-gradient-to-t from-gray-900 to-black border-t border-blue-900/30"
            : "bg-[#f0f0f0]"
        }`}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            isDarkMode
              ? "Transmit message..."
              : "Type a message"
          }
          className={`flex-1 rounded-full px-5 py-3 outline-none text-sm ${
            isDarkMode
              ? "bg-gray-900/70 border border-blue-500/30 text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-sm"
              : "bg-white text-gray-900"
          } transition-all`}
        />
        <button
          onClick={handleSend}
          className={`p-3 rounded-full active:scale-95 transition-all ${
            isDarkMode
              ? "bg-gradient-to-r from-blue-800 to-blue-700 text-white hover:from-blue-700 hover:to-blue-600"
              : "bg-[#008069] text-white hover:bg-[#017a5f]"
          }`}
          style={
            isDarkMode
              ? { boxShadow: "0 0 15px rgba(37, 99, 235, 0.3)" }
              : {}
          }
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}