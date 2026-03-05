import { useState } from "react";
import { ChatList } from "./components/ChatList";
import { ChatDetail } from "./components/ChatDetail";

export default function App() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  return (
    <div 
      className={`h-screen max-w-md mx-auto shadow-2xl ${
        isDarkMode ? "bg-black" : "bg-white"
      }`} 
      style={isDarkMode ? { boxShadow: '0 0 100px rgba(59, 130, 246, 0.3)' } : { boxShadow: '0 0 50px rgba(0, 0, 0, 0.1)' }}
    >
      {selectedChat ? (
        <ChatDetail
          chatId={selectedChat}
          onBack={() => setSelectedChat(null)}
          isDarkMode={isDarkMode}
        />
      ) : (
        <ChatList 
          onSelectChat={(chatId) => setSelectedChat(chatId)}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      )}
    </div>
  );
}
