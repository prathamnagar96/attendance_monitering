// src/components/TimetableEditor.jsx - CLEAN VERSION
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ArrowLeft, Plus, Save, Trash2, Search, Calendar, ChevronDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAttendanceStore } from "../logic/useAttendanceStore";
import Button from "./ui/Button";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// NEW: helper to build an empty timetable with N slots per day
const buildEmptyTimetable = (periodCount) =>
    DAYS.reduce((acc, d) => {
        acc[d] = Array(periodCount).fill(null);
        return acc;
    }, {});

function cleanSubjectName(raw) {
    if (!raw) return "";
    const t = String(raw)
        .replace(/BREAK|LUNCH/gi, "")
        .replace(/[^a-zA-Z0-9+&().,\- ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (t.length < 2) return "";
    if (t.toUpperCase().includes("FREE")) return "";
    return t;
}

export default function TimetableEditor() {
    const navigate = useNavigate();
    const location = useLocation();
    const scrollRef = useRef(null);

    const {
        saveTimetable,
        getTimetable,
        addSubject,
        addSubjects,
        isLoading: isStoreLoading,
        settings,                         // ✅ get settings, including periodsPerDay
        subjects: storeSubjects,          // ✅ always read subjects from global store
    } = useAttendanceStore();

    const periodsPerDay = settings?.periodsPerDay ?? 6;

    const [timetable, setTimetable] = useState(() => buildEmptyTimetable(periodsPerDay));
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [savedStatus, setSavedStatus] = useState("");
    const [showSubjects, setShowSubjects] = useState(false);
    const [subjectSearch, setSubjectSearch] = useState("");
    const [newSubjectName, setNewSubjectName] = useState("");
    const [newSubjectType, setNewSubjectType] = useState("theory");

    // When periodsPerDay setting changes, resize existing timetable arrays
    useEffect(() => {
        setTimetable((prev) => {
            const next = {};
            DAYS.forEach((day) => {
                const existing = Array.isArray(prev[day]) ? prev[day] : [];
                if (existing.length === periodsPerDay) {
                    next[day] = existing;
                } else if (existing.length > periodsPerDay) {
                    next[day] = existing.slice(0, periodsPerDay);
                } else {
                    next[day] = [...existing, ...Array(periodsPerDay - existing.length).fill(null)];
                }
            });
            return next;
        });
        setIsDirty(true);
    }, [periodsPerDay]);

    // ✅ Load subjects from global store, with onboarding fallback on very first run
    useEffect(() => {
        if (Array.isArray(storeSubjects) && storeSubjects.length > 0) {
            setSubjects(storeSubjects);
            return;
        }

        const data = typeof window !== "undefined" ? window.onboardingComplete : null;
        if (data?.subjects && Array.isArray(data.subjects)) {
            setSubjects(data.subjects);
            console.log("🎉 Editor loaded subjects from onboarding:", data.subjects.length);
        }
    }, [storeSubjects]);

    // Add a new subject after onboarding from within the editor
    const handleAddNewSubject = useCallback(async () => {
        const name = newSubjectName.trim();
        if (!name) {
            alert("Enter subject name");
            return;
        }

        const exists = subjects.some(
            (s) => s.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
            alert("Subject already exists");
            return;
        }

        const entry = {
            name,
            type: newSubjectType,
            isPractical:
                newSubjectType === "practical" || newSubjectType === "both",
            trackTheory:
                newSubjectType === "theory" || newSubjectType === "both",
            isStrict: false,
        };

        try {
            await addSubjects([entry]);
            setNewSubjectName("");
            setShowSubjects(false);
        } catch (e) {
            console.error("Failed to add subject from editor:", e);
            alert("Could not add subject. Please try again.");
        }
    }, [newSubjectName, newSubjectType, subjects, addSubjects]);

    // Haptic feedback
    const triggerHaptic = useCallback(() => {
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }, []);

    // Load timetable
    useEffect(() => {
        if (isStoreLoading) return;

        const stored = getTimetable?.();
        const next = buildEmptyTimetable(periodsPerDay);

        // Stored timetable
        if (stored) {
            DAYS.forEach((d) => {
                if (Array.isArray(stored[d])) {
                    const existing = stored[d];
                    if (existing.length >= periodsPerDay) {
                        next[d] = existing.slice(0, periodsPerDay).map((slot) => slot || null);
                    } else {
                        next[d] = [
                            ...existing.map((slot) => slot || null),
                            ...Array(periodsPerDay - existing.length).fill(null),
                        ];
                    }
                }
            });
            setTimetable(next);
        }

        setLoading(false);
    }, [isStoreLoading, getTimetable, location.state, periodsPerDay]);

    const filteredSubjects = useMemo(() => {
        return subjects.filter(s =>
            s.name.toLowerCase().includes(subjectSearch.toLowerCase())
        );
    }, [subjects, subjectSearch]);

    // ✅ FIXED: Update cell with onboarding subject data
    const updateCell = useCallback(
        (day, period, subject) => {
            setTimetable(prev => {
                const newTt = { ...prev };
                const dayArr = Array.isArray(newTt[day])
                    ? [...newTt[day]]
                    : Array(periodsPerDay).fill(null);

                // 1) Prefer explicit slotMode coming from UI (Theory/Practical buttons)
                let slotMode = subject.slotMode;

                // 2) If not provided, derive from subject metadata
                if (!slotMode) {
                    if (subject.type === "practical") {
                        slotMode = "practical";
                    } else if (subject.type === "both") {
                        // default for "both" until user chooses
                        slotMode = subject.isPractical ? "practical" : "theory";
                    } else if (subject.isPractical !== undefined) {
                        slotMode = subject.isPractical ? "practical" : "theory";
                    } else {
                        slotMode = "theory";
                    }
                }

                const isPractical = slotMode === "practical";

                dayArr[period] = {
                    ...subject,
                    slotMode,
                    isPractical,
                };

                newTt[day] = dayArr;
                return newTt;
            });
            setIsDirty(true);
            triggerHaptic();
        },
        [triggerHaptic, periodsPerDay]
    );

    const clearCell = useCallback(
        (day, period) => {
            setTimetable(prev => {
                const newTt = { ...prev };
                const dayArr = Array.isArray(newTt[day])
                    ? [...newTt[day]]
                    : Array(periodsPerDay).fill(null);
                dayArr[period] = null;
                newTt[day] = dayArr;
                return newTt;
            });
            setIsDirty(true);
        },
        [periodsPerDay]
    );

    // ✅ FIXED: Save function with better error handling + batch subjects
    const handleSave = useCallback(async () => {
        // Count how many slots actually have a class
        const hasAny = Object.values(timetable || {}).some(
            (daySlots) => Array.isArray(daySlots) && daySlots.some(Boolean)
        );

        if (!hasAny) {
            setSavedStatus("Add classes first");
            setTimeout(() => setSavedStatus(""), 1500);
            return;
        }

        if (!isDirty) {
            setSavedStatus("Already saved");
            setTimeout(() => setSavedStatus(""), 1500);
            return;
        }

        try {
            console.log(
                "💾 Saving timetable with",
                Object.values(timetable).flat().filter(Boolean).length,
                "classes"
            );

            const uniqueSubjects = new Map();
            Object.values(timetable).forEach((daySlots) => {
                daySlots.forEach((slot) => {
                    if (!slot?.name?.trim()) return;
                    const key = `${slot.name}::${slot.isStrict ? 1 : 0}::${slot.isPractical ? 1 : 0}`;
                    uniqueSubjects.set(key, {
                        name: slot.name,
                        isStrict: !!slot.isStrict,
                        isPractical: !!slot.isPractical,
                    });
                });
            });

            for (const sub of uniqueSubjects.values()) {
                await addSubject(sub.name, sub.isStrict, sub.isPractical);
            }

            await saveTimetable(timetable);

            setIsDirty(false);
            setSavedStatus("✅ Timetable Saved!");
            console.log("🎉 Save successful");
            setTimeout(() => setSavedStatus(""), 2000);
            triggerHaptic();
        } catch (err) {
            console.error("❌ Save failed:", err);
            setSavedStatus("❌ Save failed - check console");
            setTimeout(() => setSavedStatus(""), 3000);
        }
    }, [timetable, isDirty, addSubject, saveTimetable, triggerHaptic]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-8">
                <div className="animate-pulse space-y-4 w-full max-w-md">
                    <div className="h-32 bg-white/50 dark:bg-gray-800/60 rounded-2xl animate-pulse" />
                    <div className="space-y-3">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="h-24 bg-white/30 dark:bg-gray-800/40 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b dark:border-gray-800 shadow-sm"
                style={{ paddingTop: "var(--sat, 0px)" }}>
                <div className="px-4 py-3 flex items-center justify-between h-[60px]">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl h-11 w-11 flex items-center justify-center text-gray-800 dark:text-gray-100"
                        aria-label="Go back">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-bold uppercase tracking-tight flex-1 text-center text-gray-900 dark:text-gray-100">
                        Timetable Editor
                    </h1>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className="p-3 text-blue-600 dark:text-blue-400 disabled:text-gray-400 dark:disabled:text-gray-600 font-semibold text-sm uppercase h-11 w-11 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-xl disabled:hover:bg-transparent">
                        <Save size={18} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div
                className="p-4 pb-40 space-y-6 min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100"
                style={{ paddingTop: "calc(var(--sat, 0px) + 60px)" }}
            >
                {/* Subjects Button */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => setShowSubjects((prev) => !prev)}
                        className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl h-14">
                        <Plus size={20} />
                        Add Subject ({subjects.length})
                    </button>
                </div>

                {showSubjects && (
                    <div className="mb-6 bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
                        <p className="text-sm font-semibold mb-3 text-gray-800 dark:text-gray-100">
                            Add a new subject
                        </p>
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={newSubjectName}
                                onChange={(e) => setNewSubjectName(e.target.value)}
                                placeholder="e.g., Machine Learning"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                            <div className="flex gap-2 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setNewSubjectType("theory")}
                                    className={`flex-1 px-3 py-2 rounded-xl font-semibold border text-center ${newSubjectType === "theory"
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900"
                                        }`}
                                >
                                    Theory
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewSubjectType("practical")}
                                    className={`flex-1 px-3 py-2 rounded-xl font-semibold border text-center ${newSubjectType === "practical"
                                        ? "bg-purple-600 text-white border-purple-600"
                                        : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900"
                                        }`}
                                >
                                    Practical
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewSubjectType("both")}
                                    className={`flex-1 px-3 py-2 rounded-xl font-semibold border text-center ${newSubjectType === "both"
                                        ? "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900"
                                        }`}
                                >
                                    Both
                                </button>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Button
                                    onClick={handleAddNewSubject}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm py-2 rounded-xl"
                                >
                                    Save Subject
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setShowSubjects(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ REMOVED: Extra Classes Section */}

                {/* Timetable Grid */}
                <div className="space-y-3">
                    {DAYS.map((day) => (
                        <div key={day} className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border dark:border-gray-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl">
                            <h3 className="font-bold text-lg uppercase tracking-widest mb-6 flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                                {day}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                {Array.from({ length: periodsPerDay }, (_, idx) => {
                                    const period = idx + 1;
                                    const cell = timetable[day]?.[idx] || null;
                                    const subjectMeta = cell ? subjects.find(s => s.name === cell.name) : null;
                                    const subjectType = subjectMeta?.type;
                                    const slotMode =
                                        cell?.slotMode || (cell?.isPractical ? "practical" : "theory");

                                    return (
                                        <div
                                            key={period}
                                            className="relative bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex flex-col justify-between min-h-[120px] sm:min-h-[100px]"
                                        >
                                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                                Period {period}
                                            </div>
                                            <select
                                                className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={cell?.name || ""}
                                                onChange={(e) => {
                                                    const name = e.target.value;
                                                    if (!name) {
                                                        clearCell(day, idx);
                                                        return;
                                                    }
                                                    const sub = subjects.find(s => s.name === name);
                                                    if (sub) {
                                                        updateCell(day, idx, sub);
                                                    }
                                                }}
                                            >
                                                <option value="">Empty</option>
                                                {subjects.map((sub) => (
                                                    <option key={sub.name} value={sub.name}>
                                                        {sub.name}
                                                    </option>
                                                ))}
                                            </select>

                                            {cell?.name && (
                                                <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                                                    {subjectType === "both" ? (
                                                        <div className="flex gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCell(day, idx, { ...cell, slotMode: "theory", isPractical: false })}
                                                                className={`px-2 py-1 text-xs rounded-full font-semibold ${slotMode === "theory"
                                                                    ? "bg-blue-600 text-white"
                                                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                                                    }`}
                                                            >
                                                                Theory
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCell(day, idx, { ...cell, slotMode: "practical", isPractical: true })}
                                                                className={`px-2 py-1 text-xs rounded-full font-semibold ${slotMode === "practical"
                                                                    ? "bg-purple-600 text-white"
                                                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                                                    }`}
                                                            >
                                                                Practical
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full font-semibold">
                                                            {cell?.isPractical ? "Practical" : "Theory"}
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => clearCell(day, idx)}
                                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                                        title="Clear slot">
                                                        <Trash2 size={14} className="text-red-500" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Save Bar */}
            <div
                className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t dark:border-gray-800 shadow-2xl"
                style={{
                    // Place bar just above bottom nav + safe area
                    bottom: "calc(64px + var(--sab, 0px))",
                    paddingBottom: "16px",
                }}
            >
                <div className="px-6 py-4">
                    <Button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className="w-full h-16 uppercase font-bold tracking-widest text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-2xl shadow-xl focus:outline-none transition-all disabled:shadow-none"
                    >
                        <Save size={20} className="mr-3" />
                        {isDirty ? "Save Changes" : "Saved ✓"}
                    </Button>
                    {savedStatus && (
                        <div className="mt-3 text-center text-xs text-emerald-600 font-semibold animate-pulse">
                            {savedStatus}
                        </div>
                    )}
                </div>
            </div>

            {/* ✅ REMOVED: Subjects bottom sheet + Extra Classes modal */}
        </>
    );
}
