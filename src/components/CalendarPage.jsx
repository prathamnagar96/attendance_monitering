// src/components/CalendarPage.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { ArrowLeft, Calendar as CalendarIcon, Info, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";
import { useAttendanceStore } from "../logic/useAttendanceStore";
import { LectureStatus, dateKey } from "../logic/AttendanceEngine";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymd(d) {
    return dateKey(d);
}

function isSameYMD(a, b) {
    return a === b;
}

function startOfMonth(dateStr) {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(dateStr) {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function mondayFirstIndex(jsDay) {
    return jsDay === 0 ? 6 : jsDay - 1;
}

function buildMonthGrid(anchorDateStr) {
    const start = startOfMonth(anchorDateStr);
    const end = endOfMonth(anchorDateStr);
    const startIdx = mondayFirstIndex(start.getDay());
    const days = [];

    for (let i = 0; i < startIdx; i++) {
        days.push(null);
    }

    for (let d = 1; d <= end.getDate(); d++) {
        const cur = new Date(start.getFullYear(), start.getMonth(), d);
        days.push(cur);
    }

    while (days.length % 7 !== 0) days.push(null);

    const rows = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
}

// Haptic feedback utility
function triggerHaptic(style = "light") {
    if (navigator.vibrate) {
        const pattern = style === "medium" ? [10] : style === "heavy" ? [20] : [5];
        navigator.vibrate(pattern);
    }
}

// Toast notification component
function Toast({ message, visible, onClose }) {
    useEffect(() => {
        if (visible) {
            const timer = setTimeout(onClose, 3500);
            return () => clearTimeout(timer);
        }
    }, [visible, onClose]);

    if (!visible) return null;

    return (
        <div className="fixed top-20 left-4 right-4 z-50 animate-slide-down" style={{ paddingTop: "var(--sat)" }}>
            <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-2xl flex items-start gap-3 max-w-md mx-auto">
                <span className="text-lg">📅</span>
                <p className="text-sm font-medium flex-1">{message}</p>
                <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white text-lg leading-none"
                    aria-label="Close notification"
                >
                    ×
                </button>
            </div>
        </div>
    );
}

// Skeleton loader for month grid
function MonthGridSkeleton() {
    return (
        <div className="space-y-2 animate-pulse">
            <div className="grid grid-cols-7 gap-2">
                {[...Array(7)].map((_, i) => (
                    <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                ))}
            </div>
            {[...Array(5)].map((_, rowIdx) => (
                <div key={rowIdx} className="grid grid-cols-7 gap-2">
                    {[...Array(7)].map((_, colIdx) => (
                        <div key={colIdx} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                    ))}
                </div>
            ))}
        </div>
    );
}

// Lectures loading skeleton
function LecturesLoadingSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
                    <div className="flex gap-2">
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-20" />
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-20" />
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-20" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function StatusButton({ active, tone, children, onClick, ariaLabel }) {
    const activeCls =
        tone === "green"
            ? "bg-green-600 text-white border-transparent"
            : tone === "red"
                ? "bg-red-600 text-white border-transparent"
                : "bg-blue-600 text-white border-transparent";

    const handleClick = () => {
        triggerHaptic("light");
        onClick();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={ariaLabel || children}
            aria-pressed={active}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${active
                ? activeCls
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
        >
            {children}
        </button>
    );
}

export default function CalendarPage() {
    const navigate = useNavigate();

    const {
        semesterDays,
        subjects,
        history,
        notes,
        markAttendance,
        settings,
        getSubjectStats,
        isSimulationMode,
        simulationChanges,
        toggleSimulationMode,
        toggleSimulation,
        clearSimulation,
        addExtraClass,
        addSubjects,              // ✅ NEW: hydrate from onboarding if needed
    } = useAttendanceStore();

    const todayStr = ymd(new Date());

    const [monthAnchor, setMonthAnchor] = useState(todayStr);
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const [extraSubjectId, setExtraSubjectId] = useState('');
    const [extraType, setExtraType] = useState('Theory');

    const scrollRef = useRef(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const hydratedFromOnboarding = useRef(false);

    // Loading simulation
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    // ✅ NEW: if user skipped editor but did onboarding, pull subjects from onboardingComplete
    useEffect(() => {
        if (hydratedFromOnboarding.current) return;
        if (subjects.length > 0) {
            hydratedFromOnboarding.current = true;
            return;
        }

        if (typeof window !== "undefined" && window.onboardingComplete?.subjects?.length) {
            hydratedFromOnboarding.current = true;
            (async () => {
                try {
                    await addSubjects(window.onboardingComplete.subjects);
                } catch (e) {
                    console.error("Failed to hydrate subjects from onboarding in Calendar:", e);
                }
            })();
        }
    }, [subjects.length, addSubjects]);

    const monthStart = useMemo(() => startOfMonth(monthAnchor), [monthAnchor]);

    const monthLabel = useMemo(() => {
        const d = new Date(monthAnchor);
        return d.toLocaleString(undefined, { month: "long", year: "numeric" });
    }, [monthAnchor]);

    const monthRows = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);

    const dayObj = useMemo(
        () => semesterDays.find((d) => d.date === selectedDate),
        [semesterDays, selectedDate]
    );

    const lectures = useMemo(() => dayObj?.lectures ?? [], [dayObj]);

    const subjectByName = useMemo(() => {
        const m = new Map();
        subjects.forEach((s) => m.set(s.name, s));
        return m;
    }, [subjects]);

    const effectiveStatusFor = (dateStr, subjectName, fallback) => {
        const simKey = `${dateStr}-${subjectName}`;
        if (isSimulationMode && simulationChanges?.[simKey]) {
            return simulationChanges[simKey];
        }

        if (history?.[dateStr]?.[subjectName]) {
            return history[dateStr][subjectName];
        }

        return fallback || LectureStatus.UPCOMING;
    };

    const dayMarkers = useMemo(() => {
        const map = new Map();
        semesterDays.forEach((d) => {
            if (!d?.date) return;
            const dateStr = d.date;
            let p = 0, a = 0, du = 0, u = 0, total = 0;

            d.lectures.forEach((lec) => {
                const subjectName =
                    typeof lec.subject === "string" ? lec.subject : lec.subject?.name;
                if (!subjectName) return;

                const st = effectiveStatusFor(dateStr, subjectName, lec.status);
                total++;

                if (st === LectureStatus.PRESENT) p++;
                else if (st === LectureStatus.ABSENT) a++;
                else if (st === LectureStatus.DUTY) du++;
                else u++;
            });

            map.set(dateStr, { p, a, du, u, total });
        });
        return map;
    }, [semesterDays, history, isSimulationMode, simulationChanges]);

    const globalSummary = useMemo(() => {
        let present = 0;
        let total = 0;

        subjects.forEach((sub) => {
            const st = getSubjectStats(sub.id);
            present += st.present || 0;
            total += st.total || 0;
        });

        const percent = total === 0 ? 100 : Math.round((present / total) * 100);
        return { present, total, percent };
    }, [subjects, getSubjectStats, isSimulationMode, simulationChanges, settings]);

    const goPrevMonth = () => {
        triggerHaptic("light");
        const d = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
        setMonthAnchor(ymd(d));
    };

    const goNextMonth = () => {
        triggerHaptic("light");
        const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
        setMonthAnchor(ymd(d));
    };

    const onPickDay = (d) => {
        if (!d) return;
        triggerHaptic("light");
        const dateStr = ymd(d);
        setSelectedDate(dateStr);
    };

    const showToast = (message) => {
        setToastMessage(message);
        setToastVisible(true);
    };

    const onSetStatus = async (subjectName, status) => {
        if (!subjectName) return;

        // Future date check for non-preview mode
        if (!isSimulationMode) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(selectedDate);
            targetDate.setHours(0, 0, 0, 0);

            if (targetDate > today) {
                showToast("Future dates → Preview mode only (not saved permanently)");
                return;
            }
        }

        triggerHaptic("medium");

        if (isSimulationMode) {
            toggleSimulation(selectedDate, subjectName, status);
            return;
        }

        const noteKey = `${selectedDate}-${subjectName}`;
        const existingNote = notes?.[noteKey] || "";
        try {
            await markAttendance(selectedDate, subjectName, status, existingNote);
        } catch (e) {
            showToast(e.message || "Cannot save this attendance change.");
        }
    };

    const onSetNote = async (subjectName, text) => {
        if (isSimulationMode) return;

        const noteKey = `${selectedDate}-${subjectName}`;
        const existingStatus =
            history?.[selectedDate]?.[subjectName] || LectureStatus.UPCOMING;

        try {
            await markAttendance(selectedDate, subjectName, existingStatus, text);
        } catch (e) {
            showToast(e.message || "Cannot save note.");
        }
    };

    // ✅ NEW: handler to add an extra lecture on selectedDate
    const handleAddExtraLecture = async () => {
        if (!selectedDate || !extraSubjectId) return;
        if (isSimulationMode) {
            // Do not mutate data in preview mode
            setToastMessage("Turn OFF Preview to add real extra lectures.");
            setToastVisible(true);
            return;
        }

        try {
            await addExtraClass({
                date: selectedDate,
                subjectId: extraSubjectId,
                type: extraType, // "Theory" or "Practical" – engine treats "Practical" specially
            });
            triggerHaptic("medium");
            setToastMessage("Extra lecture added for " + selectedDate);
            setToastVisible(true);
        } catch (e) {
            console.error("Failed to add extra lecture:", e);
            setToastMessage(e.message || "Could not add extra lecture.");
            setToastVisible(true);
        }
    };

    // Pull to refresh handler
    const handleTouchStart = (e) => {
        if (scrollRef.current?.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e) => {
        if (scrollRef.current?.scrollTop === 0) {
            const touchY = e.touches[0].clientY;
            const deltaY = touchY - touchStartY.current;

            if (deltaY > 100 && !isRefreshing) {
                setIsRefreshing(true);
                triggerHaptic("medium");

                // Simulate refresh
                setTimeout(() => {
                    setIsRefreshing(false);
                    showToast("Calendar refreshed");
                }, 1000);
            }
        }
    };

    // Swipe navigation for month
    const handleSwipeStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleSwipeEnd = (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX.current;

        if (Math.abs(deltaX) > 80) {
            if (deltaX > 0) {
                goPrevMonth();
            } else {
                goNextMonth();
            }
        }
    };

    const hasSemesterDay = !!dayObj;
    const hasNoSemester = semesterDays.length === 0;

    return (
        <div className="fixed top-0 left-0 right-0 bottom-0 z-30 bg-gray-50 dark:bg-black font-sans text-gray-900 dark:text-gray-100">
            {/* Toast */}
            <Toast
                message={toastMessage}
                visible={toastVisible}
                onClose={() => setToastVisible(false)}
            />

            {/* Header */}
            <header
                className="absolute top-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm"
                style={{ paddingTop: "var(--sat)" }}
                role="banner"
            >
                <div className="px-4 py-3 flex items-center justify-between h-[60px]">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Go back"
                        type="button"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <h1 className="text-base font-bold uppercase tracking-tight">Calendar</h1>

                    <div className="w-10 flex justify-center">
                        {isRefreshing && (
                            <RefreshCw size={18} className="animate-spin text-blue-600" />
                        )}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main
                ref={scrollRef}
                className="absolute inset-0 z-10 overflow-y-auto scrollbar-hide"
                style={{
                    paddingTop: "calc(var(--sat) + 60px)",
                    paddingBottom: "calc(80px + var(--sab))",
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                role="main"
            >
                <div className="p-4 space-y-4">
                    {/* Empty state */}
                    {hasNoSemester ? (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center shadow-sm">
                            <CalendarIcon size={48} className="mx-auto mb-4 text-gray-400" />
                            <h2 className="text-lg font-bold mb-2">No semester configured</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Set up your timetable to start tracking attendance
                            </p>
                            <Button
                                onClick={() => navigate("/scan")}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Get Started
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Month grid */}
                            <section
                                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm"
                                aria-label="Calendar month view"
                                onTouchStart={handleSwipeStart}
                                onTouchEnd={handleSwipeEnd}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        type="button"
                                        onClick={goPrevMonth}
                                        className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        aria-label="Previous month"
                                    >
                                        {"<"}
                                    </button>

                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <CalendarIcon size={18} className="text-blue-600 dark:text-blue-400" />
                                            <p className="text-sm font-bold">{monthLabel}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Tap a date • Swipe to navigate
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={goNextMonth}
                                        className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        aria-label="Next month"
                                    >
                                        {">"}
                                    </button>
                                </div>

                                {isLoading ? (
                                    <MonthGridSkeleton />
                                ) : (
                                    <>
                                        <div className="grid grid-cols-7 gap-2 mb-2" role="row">
                                            {WEEKDAYS.map((w) => (
                                                <div
                                                    key={w}
                                                    className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 text-center"
                                                    role="columnheader"
                                                >
                                                    {w}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="space-y-2" role="grid">
                                            {monthRows.map((row, rIdx) => (
                                                <div key={rIdx} className="grid grid-cols-7 gap-2" role="row">
                                                    {row.map((d, cIdx) => {
                                                        if (!d) return <div key={cIdx} className="h-12" role="gridcell" />;

                                                        const dateStr = ymd(d);
                                                        const marker = dayMarkers.get(dateStr);
                                                        const isSelected = isSameYMD(dateStr, selectedDate);
                                                        const isToday = isSameYMD(dateStr, todayStr);
                                                        const inSemester = semesterDays.some((sd) => sd.date === dateStr);

                                                        return (
                                                            <button
                                                                key={cIdx}
                                                                type="button"
                                                                onClick={() => onPickDay(d)}
                                                                role="gridcell"
                                                                aria-label={`${d.toLocaleDateString()}, ${marker?.total || 0} lectures`}
                                                                aria-selected={isSelected}
                                                                className={`h-12 rounded-xl border text-sm flex flex-col items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSelected
                                                                    ? "bg-blue-600 text-white border-blue-600 scale-105"
                                                                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 hover:border-blue-400 dark:hover:border-blue-500"
                                                                    } ${!inSemester ? "opacity-40" : ""}`}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`${isToday && !isSelected ? "text-blue-600 dark:text-blue-400 font-bold" : ""}`}>
                                                                        {d.getDate()}
                                                                    </span>
                                                                </div>

                                                                {marker?.total > 0 && (
                                                                    <div className="flex gap-1 mt-1" aria-hidden="true">
                                                                        {marker.p > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-green-500"}`} />}
                                                                        {marker.a > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-red-500"}`} />}
                                                                        {marker.du > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`} />}
                                                                        {marker.u > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-gray-400"}`} />}
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Preview toggle */}
                                        <div className="mt-4 flex items-start justify-between gap-3">
                                            <div className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                                <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                                                <span>
                                                    Preview shows impact without saving. When OFF, marks are saved immediately.
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    triggerHaptic("medium");
                                                    if (isSimulationMode) clearSimulation();
                                                    else toggleSimulationMode();
                                                }}
                                                aria-label={isSimulationMode ? "Disable preview mode" : "Enable preview mode"}
                                                aria-pressed={isSimulationMode}
                                                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${isSimulationMode
                                                    ? "bg-purple-600 text-white hover:bg-purple-700"
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                    }`}
                                            >
                                                {isSimulationMode ? "Preview ON" : "Preview OFF"}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </section>

                            {/* Global summary */}
                            <section
                                className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg p-4 text-white shadow-sm"
                                aria-label="Overall attendance summary"
                            >
                                {isLoading ? (
                                    <div className="animate-pulse">
                                        <div className="h-3 bg-white/30 rounded w-32 mb-2" />
                                        <div className="h-8 bg-white/30 rounded w-24" />
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs opacity-90 mb-1">
                                            Overall attendance {isSimulationMode ? "(Preview)" : ""}
                                        </p>
                                        <div className="flex items-end justify-between">
                                            <p className="text-3xl font-extrabold">{globalSummary.percent}%</p>
                                            <p className="text-xs opacity-90">
                                                {globalSummary.present}/{globalSummary.total}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </section>

                            {/* Day lectures */}
                            <section
                                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm"
                                aria-label="Lectures for selected date"
                            >
                                <p className="text-sm font-bold mb-3">
                                    {selectedDate} {hasSemesterDay ? "" : "(Outside semester range)"}
                                </p>

                                {isLoading ? (
                                    <LecturesLoadingSkeleton />
                                ) : lectures.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No lectures scheduled on this date.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {lectures.map((lec, idx) => {
                                            const subjectName =
                                                typeof lec.subject === "string" ? lec.subject : lec.subject?.name;
                                            if (!subjectName) return null;

                                            const eff = effectiveStatusFor(selectedDate, subjectName, lec.status);
                                            const noteKey = `${selectedDate}-${subjectName}`;
                                            const currentNote = notes?.[noteKey] || "";

                                            return (
                                                <article
                                                    key={`${subjectName}-${idx}`}
                                                    className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-800"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                                {subjectName}
                                                            </h3>
                                                            <p className="text-xs text-gray-500 dark:text-gray-300">
                                                                {lec.isPractical ? "Practical" : "Lecture"} • Status: {eff}
                                                            </p>
                                                        </div>

                                                        {subjectByName.get(subjectName)?.isStrict && (
                                                            <span className="text-[11px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
                                                                Strict
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 flex gap-2 flex-wrap" role="group" aria-label="Attendance status buttons">
                                                        <StatusButton
                                                            tone="green"
                                                            active={eff === LectureStatus.PRESENT}
                                                            onClick={() => onSetStatus(subjectName, LectureStatus.PRESENT)}
                                                            ariaLabel={`Mark ${subjectName} as present`}
                                                        >
                                                            Present
                                                        </StatusButton>

                                                        <StatusButton
                                                            tone="red"
                                                            active={eff === LectureStatus.ABSENT}
                                                            onClick={() => onSetStatus(subjectName, LectureStatus.ABSENT)}
                                                            ariaLabel={`Mark ${subjectName} as absent`}
                                                        >
                                                            Absent
                                                        </StatusButton>

                                                        <StatusButton
                                                            tone="blue"
                                                            active={eff === LectureStatus.DUTY}
                                                            onClick={() => onSetStatus(subjectName, LectureStatus.DUTY)}
                                                            ariaLabel={`Mark ${subjectName} as duty`}
                                                        >
                                                            Duty
                                                        </StatusButton>
                                                    </div>

                                                    <div className="mt-3">
                                                        <label htmlFor={`note-${subjectName}-${idx}`} className="sr-only">
                                                            Note for {subjectName}
                                                        </label>
                                                        <input
                                                            id={`note-${subjectName}-${idx}`}
                                                            value={currentNote}
                                                            onChange={(e) => onSetNote(subjectName, e.target.value)}
                                                            placeholder="Duty reason / note"
                                                            disabled={isSimulationMode}
                                                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        {isSimulationMode && (
                                                            <p className="text-[11px] mt-1 text-gray-500 dark:text-gray-300">
                                                                Preview ON: notes are disabled (nothing is saved).
                                                            </p>
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* ✅ NEW: Extra lecture form */}
                                {subjects.length > 0 && (
                                    <div className="mt-5 border-t border-gray-200 dark:border-gray-800 pt-4">
                                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                                            Extra lecture (one-off) for {selectedDate}
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <select
                                                value={extraSubjectId}
                                                onChange={(e) => setExtraSubjectId(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Select subject</option>
                                                {subjects.map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={extraType}
                                                onChange={(e) => setExtraType(e.target.value)}
                                                className="w-28 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="Theory">Theory</option>
                                                <option value="Practical">Practical</option>
                                            </select>
                                            <Button
                                                onClick={handleAddExtraLecture}
                                                disabled={!extraSubjectId}
                                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg"
                                            >
                                                Add Extra
                                            </Button>
                                        </div>
                                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                            Extra lectures are added only for this date and counted in all stats.
                                        </p>
                                    </div>
                                )}
                            </section>

                            {/* Quick actions */}
                            <section
                                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm"
                                aria-label="Quick actions"
                            >
                                <p className="text-sm font-bold mb-2">Actions</p>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => {
                                            triggerHaptic("light");
                                            navigate("/scan");
                                        }}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        Scan timetable
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            triggerHaptic("light");
                                            navigate("/editor");
                                        }}
                                        className="flex-1 bg-gray-800 hover:bg-gray-900 text-white focus:ring-2 focus:ring-gray-500"
                                    >
                                        Edit timetable
                                    </Button>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer
                className="absolute bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg"
                style={{
                    // place footer just above 64px bottom nav + safe area inset
                    bottom: "calc(64px + var(--sab, 0px))",
                    paddingBottom: "16px",
                }}
                role="contentinfo"
            >
                <div className="p-4 text-xs text-gray-600 dark:text-gray-300">
                    {isSimulationMode
                        ? "Preview ON: changes affect stats but are not saved."
                        : "Preview OFF: changes are saved immediately."}
                </div>
            </footer>
        </div>
    );
}
