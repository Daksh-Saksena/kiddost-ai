"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, CalendarDays, Sparkles, Send } from "lucide-react";

const SERVER = "https://kiddost-ai.onrender.com";

interface CalendarEvent {
  id: string;
  phone: string | null;
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  end_time: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  is_trial?: boolean;
}

interface CalendarProps {
  isDarkMode: boolean;
  onBack: () => void;
  agentName?: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toDateStr(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  const ampm = hr >= 12 ? "PM" : "AM";
  return `${hr % 12 || 12}:${m} ${ampm}`;
}

export function Calendar({ isDarkMode, onBack, agentName }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRepeat, setFormRepeat] = useState(1);
  const [formTrial, setFormTrial] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI command bar state
  const [aiCmd, setAiCmd] = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const fetchEvents = async () => {
    const from = `${year}-${pad(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
    try {
      const res = await fetch(`${SERVER}/calendar/events?from=${from}&to=${to}`);
      const json = await res.json();
      setEvents(json.events || []);
    } catch { setEvents([]); }
  };

  useEffect(() => { fetchEvents(); }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  const eventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr);
  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const openCreateModal = (date?: string) => {
    setEditEvent(null);
    setFormTitle("");
    setFormDate(date || selectedDate || toDateStr(year, month, today.getDate()));
    setFormStart("");
    setFormEnd("");
    setFormNotes("");
    setFormPhone("");
    setFormRepeat(1);
    setFormTrial(false);
    setShowModal(true);
  };

  const openEditModal = (ev: CalendarEvent) => {
    setEditEvent(ev);
    setFormTitle(ev.title);
    setFormDate(ev.date);
    setFormStart(ev.start_time || "");
    setFormEnd(ev.end_time || "");
    setFormNotes(ev.notes || "");
    setFormPhone(ev.phone || "");
    setFormTrial(ev.is_trial || false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formDate) return;
    setSaving(true);
    try {
      if (editEvent) {
        await fetch(`${SERVER}/calendar/events/${editEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formTitle.trim(), date: formDate, start_time: formStart || null, end_time: formEnd || null, notes: formNotes.trim() || null, phone: formPhone.trim() || null, is_trial: formTrial }),
        });
      } else {
        await fetch(`${SERVER}/calendar/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formTitle.trim(), date: formDate, start_time: formStart || null, end_time: formEnd || null, notes: formNotes.trim() || null, phone: formPhone.trim() || null, created_by: agentName || null, repeat_count: formRepeat > 1 ? formRepeat : undefined, is_trial: formTrial }),
        });
      }
      setShowModal(false);
      fetchEvents();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${SERVER}/calendar/events/${id}`, { method: "DELETE" });
      fetchEvents();
      if (selectedEvents.length <= 1) setSelectedDate(null);
    } catch { /* silent */ }
  };

  const runAiCommand = async () => {
    const cmd = aiCmd.trim();
    if (!cmd || aiRunning) return;
    setAiRunning(true);
    setAiResult(null);
    try {
      const res = await fetch(`${SERVER}/calendar/ai-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const json = await res.json();
      setAiResult(json.summary || json.error || "Done");
      setAiCmd("");
      fetchEvents();
      setTimeout(() => setAiResult(null), 4000);
    } catch {
      setAiResult("Something went wrong");
      setTimeout(() => setAiResult(null), 3000);
    } finally {
      setAiRunning(false);
    }
  };

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const bg = isDarkMode ? "bg-black" : "bg-white";
  const text = isDarkMode ? "text-gray-100" : "text-gray-900";
  const subtext = isDarkMode ? "text-gray-400" : "text-gray-500";
  const border = isDarkMode ? "border-blue-900/30" : "border-gray-200";
  const cardBg = isDarkMode ? "bg-gray-900" : "bg-gray-50";
  const inputCls = `w-full rounded-xl px-4 py-3 text-sm outline-none transition-all ${isDarkMode ? "bg-gray-800 border border-blue-500/30 text-white placeholder:text-gray-600 focus:border-blue-500" : "bg-gray-100 border border-gray-200 text-gray-900 focus:border-[#008069]"}`;

  return (
    <div className={`flex flex-col h-full ${bg}`}>
      {/* Header */}
      <div className={`px-4 py-4 flex items-center gap-3 border-b ${border} ${isDarkMode ? "bg-gray-950" : "bg-[#008069]"}`}>
        <button onClick={onBack} className="text-white hover:opacity-70 transition-opacity">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <CalendarDays className="w-5 h-5 text-white" />
        <h1 className="text-lg font-semibold text-white flex-1">Calendar</h1>
        <button onClick={() => openCreateModal()} className="text-white hover:opacity-70 transition-opacity" title="New event">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Month navigation */}
      <div className={`flex items-center justify-between px-5 py-3 ${isDarkMode ? "bg-gray-950" : "bg-white"}`}>
        <button onClick={prevMonth} className={`p-1.5 rounded-full hover:bg-gray-800/50 ${subtext}`}><ChevronLeft className="w-5 h-5" /></button>
        <h2 className={`text-base font-semibold ${text}`}>{MONTHS[month]} {year}</h2>
        <button onClick={nextMonth} className={`p-1.5 rounded-full hover:bg-gray-800/50 ${subtext}`}><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Day headers */}
      <div className={`grid grid-cols-7 px-3 pb-1 ${isDarkMode ? "bg-gray-950" : "bg-white"}`}>
        {DAYS.map(d => (
          <div key={d} className={`text-center text-xs font-medium py-1 ${subtext}`}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={`grid grid-cols-7 gap-px px-3 pb-3 ${isDarkMode ? "bg-gray-950" : "bg-white"}`}>
        {grid.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dateStr = toDateStr(year, month, day);
          const hasEvents = eventsForDate(dateStr).length > 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
              className={`relative flex flex-col items-center py-2 rounded-xl transition-all ${
                isSelected
                  ? isDarkMode ? "bg-blue-600 text-white" : "bg-[#008069] text-white"
                  : isToday
                  ? isDarkMode ? "bg-blue-900/40 text-blue-300" : "bg-green-50 text-[#008069] font-bold"
                  : isDarkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-800 hover:bg-gray-100"
              }`}
            >
              <span className="text-sm">{day}</span>
              {hasEvents && (() => {
                const dayEvents = eventsForDate(dateStr);
                const hasTrial = dayEvents.some(e => e.is_trial);
                return <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? "bg-white" : hasTrial ? "bg-orange-400" : isDarkMode ? "bg-blue-400" : "bg-[#008069]"}`} />;
              })()}
            </button>
          );
        })}
      </div>

      {/* Events list for selected date */}
      <div className={`flex-1 overflow-y-auto px-4 py-3 border-t ${border}`}>
        {selectedDate ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold ${text}`}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </h3>
              <button onClick={() => openCreateModal(selectedDate)} className={`text-xs px-3 py-1.5 rounded-full font-medium ${isDarkMode ? "bg-blue-600 text-white" : "bg-[#008069] text-white"}`}>
                + Add
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className={`text-sm ${subtext}`}>No events on this day.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedEvents.map(ev => (
                  <div key={ev.id} className={`rounded-xl p-3 ${cardBg} border ${ev.is_trial ? 'border-orange-400' : border}`} style={ev.is_trial ? { borderLeftWidth: 3, borderLeftColor: '#f97316' } : {}}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${text}`}>
                          {ev.is_trial && <span className="inline-block text-[10px] font-bold bg-orange-400 text-white px-1.5 py-0.5 rounded mr-1.5 align-middle">TRIAL</span>}
                          {ev.title}
                        </p>
                        {(ev.start_time || ev.end_time) && (
                          <p className={`text-xs mt-0.5 ${subtext}`}>
                            {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                          </p>
                        )}
                        {ev.phone && <p className={`text-xs mt-0.5 ${subtext}`}>{ev.phone}</p>}
                        {ev.notes && <p className={`text-xs mt-1 ${subtext}`}>{ev.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <button onClick={() => openEditModal(ev)} className={`p-1.5 rounded-lg ${isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-200 text-gray-500"}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(ev.id)} className={`p-1.5 rounded-lg ${isDarkMode ? "hover:bg-red-900/30 text-red-400" : "hover:bg-red-50 text-red-500"}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <CalendarDays className={`w-10 h-10 mb-2 ${subtext}`} />
            <p className={`text-sm ${subtext}`}>Tap a date to view events</p>
          </div>
        )}
      </div>

      {/* AI Command Bar */}
      <div className={`px-3 py-2 border-t ${border} ${isDarkMode ? "bg-gray-950" : "bg-white"}`}>
        {aiResult && (
          <div className={`mb-2 px-3 py-2 rounded-xl text-xs font-medium ${isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-green-50 text-green-700"}`}>
            <Sparkles className="w-3 h-3 inline mr-1.5" />{aiResult}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 flex-shrink-0 ${aiRunning ? "animate-spin" : ""} ${isDarkMode ? "text-blue-400" : "text-[#008069]"}`} />
          <input
            type="text"
            value={aiCmd}
            onChange={e => setAiCmd(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runAiCommand()}
            placeholder={aiRunning ? "Thinking..." : "AI: \"remove all sessions of Aarav\"..."}
            disabled={aiRunning}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm outline-none transition-all ${isDarkMode ? "bg-gray-900 border border-blue-500/30 text-white placeholder:text-gray-600 focus:border-blue-500" : "bg-gray-100 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#008069]"}`}
          />
          <button
            onClick={runAiCommand}
            disabled={aiRunning || !aiCmd.trim()}
            className={`p-2.5 rounded-full transition-all disabled:opacity-30 active:scale-95 ${isDarkMode ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-[#008069] text-white hover:bg-[#006d5b]"}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div
            className={`w-full max-w-md rounded-t-2xl p-6 pb-10 shadow-2xl flex flex-col gap-4 ${isDarkMode ? "bg-gray-900 border-t border-blue-900/40" : "bg-white border-t border-gray-200"}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className={`font-semibold text-base ${text}`}>{editEvent ? "Edit Event" : "New Event"}</h2>
              <button onClick={() => setShowModal(false)} className="hover:opacity-70"><X className={`w-5 h-5 ${subtext}`} /></button>
            </div>

            <div>
              <label className={`text-xs font-medium mb-1 block ${subtext}`}>TITLE *</label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. KidDost Session" className={inputCls} />
            </div>

            <div>
              <label className={`text-xs font-medium mb-1 block ${subtext}`}>DATE *</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-xs font-medium mb-1 block ${subtext}`}>START TIME</label>
                <input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={`text-xs font-medium mb-1 block ${subtext}`}>END TIME</label>
                <input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={`text-xs font-medium mb-1 block ${subtext}`}>PHONE (optional)</label>
              <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+919606746900" className={inputCls} />
            </div>

            <button
              type="button"
              onClick={() => setFormTrial(!formTrial)}
              className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-medium transition-all border ${
                formTrial
                  ? "bg-orange-50 border-orange-400 text-orange-600 dark:bg-orange-900/20 dark:border-orange-500 dark:text-orange-400"
                  : isDarkMode ? "bg-gray-800 border-blue-500/30 text-gray-400" : "bg-gray-100 border-gray-200 text-gray-500"
              }`}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${formTrial ? "bg-orange-400 text-white" : isDarkMode ? "bg-gray-700" : "bg-gray-300"}`}>
                {formTrial ? "✓" : ""}
              </div>
              Trial Session
              {formTrial && <span className="ml-auto text-xs font-bold bg-orange-400 text-white px-2 py-0.5 rounded">TRIAL</span>}
            </button>

            <div>
              <label className={`text-xs font-medium mb-1 block ${subtext}`}>NOTES</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Any extra details..." rows={2} className={`${inputCls} resize-none`} />
            </div>

            {!editEvent && (
              <div>
                <label className={`text-xs font-medium mb-1 block ${subtext}`}>REPEAT WEEKLY</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={formRepeat}
                    onChange={e => setFormRepeat(parseInt(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className={`text-sm font-semibold min-w-[3rem] text-center ${text}`}>
                    {formRepeat === 1 ? 'Once' : `${formRepeat}x`}
                  </span>
                </div>
                {formRepeat > 1 && (
                  <p className={`text-xs mt-1 ${subtext}`}>
                    Creates {formRepeat} weekly sessions starting {formDate || 'selected date'}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  {[1, 4, 8, 11].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormRepeat(n)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        formRepeat === n
                          ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-[#008069] text-white'
                          : isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {n === 1 ? 'Once' : `${n}x`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !formTitle.trim() || !formDate}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 active:scale-95 ${isDarkMode ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-[#008069] text-white hover:bg-[#006d5b]"}`}
            >
              {saving ? "Saving..." : editEvent ? "Update Event" : formRepeat > 1 ? `Create ${formRepeat} Sessions` : "Create Event"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
