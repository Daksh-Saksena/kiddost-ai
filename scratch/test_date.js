const created_at = "2026-05-11T13:50:28.266216+00:00";
const msgDate = new Date(created_at);
const dateStr = msgDate.toDateString();
const today = new Date();
const yesterday = new Date();
yesterday.setDate(today.getDate() - 1);

console.log("msgDate:", msgDate);
console.log("dateStr:", dateStr);
console.log("today:", today.toDateString());
console.log("yesterday:", yesterday.toDateString());
console.log("isToday:", dateStr === today.toDateString());
console.log("isYesterday:", dateStr === yesterday.toDateString());
