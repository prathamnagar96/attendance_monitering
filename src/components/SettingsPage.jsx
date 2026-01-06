// src/components/SettingsPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    Calendar,
    Plus,
    Save,
    Sun,
    Moon,
    Trash2,
    ShieldCheck,
    Search,
    GripVertical,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAttendanceStore } from "../logic/useAttendanceStore";
import { FIXED_HOLIDAYS } from "../logic/staticHolidays";
import Button from "./ui/Button";


export default function SettingsPage() {
    const navigate = useNavigate();
    const { settings, saveSettings, resetData } = useAttendanceStore();
    const scrollRef = useRef(null);


    const [localSettings, setLocalSettings] = useState(() => ({
        ...settings,
        holidayDates: Array.isArray(settings?.holidayDates) ? settings.holidayDates : [],
        theme: settings?.theme || (document.documentElement.classList.contains("dark") ? "dark" : "light"),
        periodsPerDay: settings?.periodsPerDay ?? 6,   // NEW: default for local state
    }));


    const [newHoliday, setNewHoliday] = useState("");
    const [savedFlash, setSavedFlash] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [holidaySearch, setHolidaySearch] = useState("");
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [darkMode, setDarkMode] = useState(() =>
        document.documentElement.classList.contains("dark")
    );


    // Auto-save with debounce
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (JSON.stringify(localSettings) !== JSON.stringify(settings)) {
                handleSave();
            }
        }, 1000);


        return () => clearTimeout(timeout);
    }, [localSettings]);


    useEffect(() => {
        setLocalSettings({
            ...settings,
            holidayDates: Array.isArray(settings?.holidayDates) ? settings.holidayDates : [],
            theme:
                settings?.theme ||
                (document.documentElement.classList.contains("dark") ? "dark" : "light"),
            periodsPerDay: settings?.periodsPerDay ?? 6, // ✅ keep periodsPerDay in sync
        });
    }, [settings]);


    const filteredHolidays = useMemo(() => {
        if (!holidaySearch) return localSettings.holidayDates || [];
        const term = holidaySearch.toLowerCase();
        return (localSettings.holidayDates || []).filter(date =>
            date.toLowerCase().includes(term) ||
            getHolidayName(date).toLowerCase().includes(term)
        );
    }, [localSettings.holidayDates, holidaySearch]);


    const handleChange = useCallback((field, value) => {
        setLocalSettings((prev) => ({ ...prev, [field]: value }));
    }, []);


    const toggleDarkMode = () => {
        document.documentElement.classList.toggle("dark");
        const next = !darkMode;
        setDarkMode(next);
        localStorage.setItem("darkMode", next ? "true" : "false");

        // ✅ FIX: Update localSettings.theme so saveSettings persists it
        setLocalSettings((prev) => ({ ...prev, theme: next ? "dark" : "light" }));
    };


    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveSettings(localSettings);
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1200);
        } finally {
            setIsSaving(false);
        }
    };


    const addHoliday = () => {
        if (!newHoliday || (localSettings.holidayDates || []).includes(newHoliday)) return;
        setLocalSettings((prev) => ({
            ...prev,
            holidayDates: [...(prev.holidayDates || []), newHoliday].sort(),
        }));
        setNewHoliday("");
    };


    const removeHoliday = (date) => {
        setLocalSettings((prev) => ({
            ...prev,
            holidayDates: (prev.holidayDates || []).filter((d) => d !== date),
        }));
    };


    const moveHoliday = (fromIndex, toIndex) => {
        const holidays = [...(localSettings.holidayDates || [])];
        const [moved] = holidays.splice(fromIndex, 1);
        holidays.splice(toIndex, 0, moved);
        setLocalSettings((prev) => ({ ...prev, holidayDates: holidays }));
    };


    const autoFillHolidays = async () => {
        if (!localSettings.semesterStart || !localSettings.semesterEnd) {
            alert("Please set Semester Start and End dates first.");
            return;
        }
        const start = new Date(localSettings.semesterStart);
        const end = new Date(localSettings.semesterEnd);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            alert("Invalid semester dates.");
            return;
        }


        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        const newDates = [];


        for (let year = startYear; year <= endYear; year++) {
            Object.keys(FIXED_HOLIDAYS).forEach((mmdd) => {
                const dateStr = `${year}-${mmdd}`;
                const d = new Date(dateStr);
                if (d >= start && d <= end) newDates.push(dateStr);
            });
        }


        if (newDates.length === 0) {
            alert("No fixed public holidays found in this date range.");
            return;
        }


        setLocalSettings((prev) => {
            const cur = prev.holidayDates || [];
            const merged = Array.from(new Set([...cur, ...newDates])).sort();
            return { ...prev, holidayDates: merged };
        });


        alert(`Added ${newDates.length} fixed holidays.`);
    };


    const getHolidayName = useCallback((dateStr) => {
        const mmdd = dateStr.slice(5);
        return FIXED_HOLIDAYS[mmdd] || "User Holiday";
    }, []);


    // Pull to refresh
    useEffect(() => {
        let startY = 0;
        let startScroll = 0;


        const handleTouchStart = (e) => {
            startY = e.touches[0].clientY;
            startScroll = scrollRef.current?.scrollTop || 0;
        };


        const handleTouchMove = (e) => {
            if (scrollRef.current?.scrollTop !== 0) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;


            if (diff > 60) {
                handlePullToRefresh();
            }
        };


        const content = scrollRef.current;
        if (content) {
            content.addEventListener("touchstart", handleTouchStart);
            content.addEventListener("touchmove", handleTouchMove);
        }


        return () => {
            if (content) {
                content.removeEventListener("touchstart", handleTouchStart);
                content.removeEventListener("touchmove", handleTouchMove);
            }
        };
    }, []);


    const handlePullToRefresh = async () => {
        await saveSettings(localSettings);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
    };


    return (
        <div className="fixed inset-0 z-30 bg-gray-50 dark:bg-black font-sans text-gray-900 dark:text-gray-100 min-h-screen">
            {/* Header */}
            <div
                className="absolute top-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm"
                style={{ paddingTop: "var(--sat, 0px)" }}
            >
                <div className="px-4 py-3 flex items-center justify-between h-[60px]">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-base font-bold uppercase tracking-tight">Settings</h1>
                    <button
                        onClick={toggleDarkMode}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        aria-label={`Toggle ${darkMode ? 'light' : 'dark'} mode`}
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>


            {/* Content */}
            <div
                ref={scrollRef}
                className="absolute inset-0 z-10 overflow-y-auto scrollbar-hide bottom-nav-safe"
                style={{
                    paddingTop: "calc(var(--sat, 0px) + 60px)",
                }}
            >
                <div className="p-4 space-y-6">
                    {/* Semester Dates */}
                    <section className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-800/50 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                            Semester Dates
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="semester-start" className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                                    Start Date
                                </label>
                                <input
                                    id="semester-start"
                                    type="date"
                                    value={localSettings.semesterStart || ""}
                                    onChange={(e) => handleChange("semesterStart", e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="semester-end" className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                                    End Date
                                </label>
                                <input
                                    id="semester-end"
                                    type="date"
                                    value={localSettings.semesterEnd || ""}
                                    onChange={(e) => handleChange("semesterEnd", e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                                    required
                                />
                            </div>
                        </div>
                    </section>


                    {/* Attendance Criteria */}
                    <section className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-800/50 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <ShieldCheck size={20} className="text-green-600 dark:text-green-400" />
                            Attendance Criteria
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label
                                    htmlFor="theory-slider"
                                    className="flex w-full text-sm font-semibold mb-3 items-center justify-between"
                                >
                                    Theory Minimum: {localSettings.minAttendanceTheory ?? 75}%
                                </label>
                                <input
                                    id="theory-slider"
                                    type="range"
                                    min="25"
                                    max="100"
                                    step="1"
                                    value={localSettings.minAttendanceTheory ?? 75}
                                    onChange={(e) => handleChange("minAttendanceTheory", parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer appearance-none slider"
                                    style={{
                                        background: `linear-gradient(to right, #10b981 0%, #10b981 ${(localSettings.minAttendanceTheory ?? 75)}%, #e5e7eb ${localSettings.minAttendanceTheory ?? 75}%, #e5e7eb 100%)`
                                    }}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="practical-slider"
                                    className="flex w-full text-sm font-semibold mb-3 items-center justify-between"
                                >
                                    Practical Minimum: {localSettings.minAttendancePractical ?? 75}%
                                </label>
                                <input
                                    id="practical-slider"
                                    type="range"
                                    min="25"
                                    max="100"
                                    step="1"
                                    value={localSettings.minAttendancePractical ?? 75}
                                    onChange={(e) => handleChange("minAttendancePractical", parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer appearance-none slider"
                                    style={{
                                        background: `linear-gradient(to right, #10b981 0%, #10b981 ${(localSettings.minAttendancePractical ?? 75)}%, #e5e7eb ${localSettings.minAttendancePractical ?? 75}%, #e5e7eb 100%)`
                                    }}
                                />
                            </div>

                            {/* NEW: Lectures per day slider */}
                            <div>
                                <label
                                    htmlFor="periods-per-day-slider"
                                    className="flex w-full text-sm font-semibold mb-3 items-center justify-between"
                                >
                                    Lectures per day: {localSettings.periodsPerDay ?? 6}
                                </label>
                                <input
                                    id="periods-per-day-slider"
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={localSettings.periodsPerDay ?? 6}
                                    onChange={(e) =>
                                        handleChange("periodsPerDay", parseInt(e.target.value, 10) || 6)
                                    }
                                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer appearance-none slider"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(localSettings.periodsPerDay ?? 6) * 10}%, #e5e7eb ${(localSettings.periodsPerDay ?? 6) * 10}%, #e5e7eb 100%)`,
                                    }}
                                />
                            </div>
                        </div>
                    </section>


                    {/* Holidays */}
                    <section className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-800/50 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Calendar size={20} className="text-purple-600 dark:text-purple-400" />
                                Holidays
                            </h2>
                            <button
                                onClick={autoFillHolidays}
                                className="text-sm bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-xl font-medium transition-all duration-200 inline-flex items-center gap-1"
                            >
                                Auto-Fill Fixed
                            </button>
                        </div>


                        {/* Add Holiday */}
                        <div className="flex gap-2 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="date"
                                    value={newHoliday}
                                    onChange={(e) => setNewHoliday(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                                />
                            </div>
                            <button
                                onClick={addHoliday}
                                disabled={!newHoliday}
                                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl transition-all duration-200 inline-flex items-center justify-center"
                                aria-label="Add holiday"
                            >
                                <Plus size={18} />
                            </button>
                        </div>


                        {/* Holiday Search */}
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    value={holidaySearch}
                                    onChange={(e) => setHolidaySearch(e.target.value)}
                                    placeholder="Search holidays..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                                />
                            </div>
                        </div>


                        {/* Holidays List */}
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {filteredHolidays.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <Calendar size={48} className="mx-auto mb-2 opacity-25" />
                                    <p className="text-sm font-medium">No holidays found</p>
                                    <p className="text-xs">Add dates or use Auto-Fill</p>
                                </div>
                            ) : (
                                filteredHolidays.map((date) => (
                                    <div
                                        key={date}
                                        draggable
                                        onDragStart={(e) => {
                                            setDraggedIndex(filteredHolidays.indexOf(date));
                                            e.dataTransfer.effectAllowed = "move";
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            const dropIndex = filteredHolidays.indexOf(date);
                                            if (draggedIndex !== null && draggedIndex !== dropIndex) {
                                                moveHoliday(draggedIndex, dropIndex);
                                            }
                                            setDraggedIndex(null);
                                        }}
                                        className="group w-full"
                                    >
                                        <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-4 py-3 rounded-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-move">
                                            <GripVertical
                                                size={16}
                                                className="text-gray-400 group-hover:text-gray-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate" title={date}>{date}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={getHolidayName(date)}>
                                                    {getHolidayName(date)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => removeHoliday(date)}
                                                className="p-1.5 text-red-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                aria-label={`Remove ${date}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>


                    {/* Danger Zone */}
                    <section className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-2 border-red-200/50 dark:border-red-800/50 rounded-2xl p-6 shadow-lg">
                        <h2 className="text-lg font-bold text-red-800 dark:text-red-300 mb-4 flex items-center gap-2">
                            <AlertTriangle size={20} />
                            Danger Zone
                        </h2>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-6 leading-relaxed">
                            Resetting will permanently delete your timetable, all subjects, and attendance records. This action cannot be undone.
                        </p>
                        <button
                            onClick={() => {
                                if (confirm("⚠️ Are you absolutely sure? This will delete ALL your data permanently.\n\nThis includes timetable, subjects, and all attendance logs.")) {
                                    resetData();
                                    alert("✅ All data has been reset.");
                                }
                            }}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-bold uppercase tracking-wide text-sm shadow-lg transform hover:scale-[1.02] active:scale-100 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} />
                            Reset All Data
                        </button>
                    </section>
                </div>
            </div>


            {/* Sticky Save Button */}
            <div
                className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-2xl"
                style={{
                    // 64px = bottom nav height (h-16). Keep a small inner padding.
                    bottom: "calc(64px + var(--sab, 0px))",
                    paddingBottom: "16px",
                }}
            >
                <div className="px-4 py-4 max-w-md mx-auto">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 rounded-2xl font-bold uppercase tracking-wider text-sm shadow-xl transform hover:shadow-2xl hover:scale-[1.02] active:scale-100 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : savedFlash ? (
                            <>
                                <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
                                    <span className="text-xs font-bold">✓</span>
                                </div>
                                Saved
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Settings
                            </>
                        )}
                    </Button>
                    {savedFlash && (
                        <p className="text-xs text-green-600 dark:text-green-400 text-center mt-1 font-medium animate-pulse">
                            Auto-saved successfully ✓
                        </p>
                    )}
                </div>
            </div>


            <style>{`
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    background: #10b981;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
                    transition: all 0.2s;
                }
                .slider::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
                }
                .slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    background: #10b981;
                    border-radius: 50%;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}
