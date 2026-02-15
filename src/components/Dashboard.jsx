// src/components/Dashboard.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ShieldAlert, BookOpen, AlertTriangle, Beaker, Clock, ShieldOff, TrendingUp, TrendingDown } from 'lucide-react';
import { useAttendanceStore } from '../logic/useAttendanceStore';
import { calculateSafeBunks, calculateRecoveryClasses, dateKey, LectureStatus } from '../logic/AttendanceEngine';
import Button from './ui/Button';

export default function Dashboard() {
    const navigate = useNavigate();
    const { subjects, markAttendance, settings, getSubjectStats, semesterDays } = useAttendanceStore();
    const minTheory = settings.minAttendanceTheory || 75;
    const minPractical = settings.minAttendancePractical || 75;
    const calculationMode = settings.calculationMode || 'overall';
    const [selectedSubject, setSelectedSubject] = useState(null);

    // 🔍 Helper: for a subject, analyze remaining semester
    const todayKey = dateKey(new Date());
    const getFutureInfo = (subjectName, presentSoFar, totalSoFar) => {
        const futureDates = [];

        semesterDays.forEach(day => {
            if (!day?.date || day.date <= todayKey) return;
            day.lectures.forEach(l => {
                const name = typeof l.subject === 'string' ? l.subject : l.subject?.name;
                if (name === subjectName) {
                    futureDates.push(day.date);
                }
            });
        });

        futureDates.sort(); // "YYYY-MM-DD" so lexicographic = chronological
        const remainingLectures = futureDates.length;

        const targetRatio = (minTheory || 75) / 100;
        const finalTotal = totalSoFar + remainingLectures;
        const finalPresentIfAll = presentSoFar + remainingLectures;
        const projectedEndPercent = finalTotal === 0 ? 100 : Math.round((finalPresentIfAll / finalTotal) * 100);
        const canReachTarget = projectedEndPercent >= (minTheory || 75);

        const safeNow = calculateSafeBunks(presentSoFar, totalSoFar, targetRatio);

        let bunkBoundaryDate = null;
        if (remainingLectures > 0) {
            if (safeNow <= 0) {
                // Already at/under limit – must attend everything from today
                bunkBoundaryDate = todayKey;
            } else if (remainingLectures > safeNow) {
                // After bunking `safeNow` future lectures, from this date onward all must be attended
                bunkBoundaryDate = futureDates[safeNow];
            }
        }

        return {
            remainingLectures,
            projectedEndPercent,
            canReachTarget,
            bunkBoundaryDate,
            safeNow,
        };
    };

    const stats = useMemo(() => {
        let globalPresent = 0;
        let globalTotal = 0;
        let globalTheoryPresent = 0;
        let globalTheoryTotal = 0;
        let globalPracticalPresent = 0;
        let globalPracticalTotal = 0;
        let unmarkedCount = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count unmarked past lectures
        semesterDays.forEach(day => {
            const d = new Date(day.date);
            if (d < today) {
                day.lectures.forEach(l => {
                    if (l.status === LectureStatus.UPCOMING) unmarkedCount++;
                });
            }
        });

        const uniqueNames = [...new Set(subjects.map(s => s.name.trim()))];
        const cards = [];

        uniqueNames.forEach(name => {
            const instances = subjects.filter(s => s.name.trim() === name);
            if (instances.length === 0) return;

            let subPresent = 0;
            let subTotal = 0;
            let subTheory = { p: 0, t: 0 };
            let subPractical = { p: 0, t: 0 };

            instances.forEach(inst => {
                const s = getSubjectStats(inst.id);
                subPresent += s.present;
                subTotal += s.total;

                if (s.theory) {
                    subTheory.p += s.theory.present;
                    subTheory.t += s.theory.total;
                    globalTheoryPresent += s.theory.present;
                    globalTheoryTotal += s.theory.total;
                }
                if (s.practical) {
                    subPractical.p += s.practical.present;
                    subPractical.t += s.practical.total;
                    globalPracticalPresent += s.practical.present;
                    globalPracticalTotal += s.practical.total;
                }
            });

            globalPresent += subPresent;
            globalTotal += subTotal;

            const isStrictSubject = instances.some(s => s.isStrict);

            const theoryPct = subTheory.t === 0 ? 0 : Math.round((subTheory.p / subTheory.t) * 100);
            const practicalPct = subPractical.t === 0 ? 0 : Math.round((subPractical.p / subPractical.t) * 100);

            const theorySafeBunks = subTheory.t === 0
                ? 0
                : calculateSafeBunks(subTheory.p, subTheory.t, minTheory / 100);
            const theoryRecovery = subTheory.t === 0
                ? 0
                : calculateRecoveryClasses(subTheory.p, subTheory.t, minTheory / 100);

            const practicalSafeBunks = subPractical.t === 0
                ? 0
                : calculateSafeBunks(subPractical.p, subPractical.t, minPractical / 100);
            const practicalRecovery = subPractical.t === 0
                ? 0
                : calculateRecoveryClasses(subPractical.p, subPractical.t, minPractical / 100);

            // 🔮 Future trajectory for this subject (shared for both parts)
            const combinedPercent = subTotal === 0 ? 0 : Math.round((subPresent / subTotal) * 100);
            const future = getFutureInfo(name, subPresent, subTotal);

            // Separate card for Theory
            if (subTheory.t > 0) {
                cards.push({
                    id: `${name}-theory`,
                    name,
                    part: 'theory',
                    label: 'Theory',
                    present: subTheory.p,
                    total: subTheory.t,
                    percent: theoryPct,
                    isSafe: theoryPct >= minTheory,
                    safeBunks: theorySafeBunks,
                    recoveryNeeded: theoryRecovery,
                    instances,
                    isStrictSubject,
                    combinedPercent,
                    future,
                });
            }

            // Separate card for Practical
            if (subPractical.t > 0) {
                cards.push({
                    id: `${name}-practical`,
                    name,
                    part: 'practical',
                    label: 'Practical',
                    present: subPractical.p,
                    total: subPractical.t,
                    percent: practicalPct,
                    isSafe: practicalPct >= minPractical,
                    safeBunks: practicalSafeBunks,
                    recoveryNeeded: practicalRecovery,
                    instances,
                    isStrictSubject,
                    combinedPercent,
                    future,
                });
            }
        });

        // Global theory/practical percentages
        const globalTheoryPercent =
            globalTheoryTotal === 0 ? 100 : Math.round((globalTheoryPresent / globalTheoryTotal) * 100);
        const globalPracticalPercent =
            globalPracticalTotal === 0 ? 100 : Math.round((globalPracticalPresent / globalPracticalTotal) * 100);

        // Overall attendance should be the average of theory and practical
        const percentParts = [];
        if (globalTheoryTotal > 0) percentParts.push(globalTheoryPercent);
        if (globalPracticalTotal > 0) percentParts.push(globalPracticalPercent);
        const globalPercent =
            percentParts.length === 0
                ? 100
                : Math.round(percentParts.reduce((sum, v) => sum + v, 0) / percentParts.length);

        // Safe bunks / recovery are still based on combined counts against the main threshold
        const globalTarget = (minTheory || 75) / 100;
        const globalSafeBunks = calculateSafeBunks(globalPresent, globalTotal, globalTarget);
        const globalRecovery = calculateRecoveryClasses(globalPresent, globalTotal, globalTarget);

        return {
            cards,
            globalPresent,
            globalTotal,
            globalPercent,
            globalSafeBunks,
            globalRecovery,
            theory: {
                present: globalTheoryPresent,
                total: globalTheoryTotal,
                percent: globalTheoryPercent,
            },
            practical: {
                present: globalPracticalPresent,
                total: globalPracticalTotal,
                percent: globalPracticalPercent,
            },
            unmarkedCount,
        };
    }, [subjects, semesterDays, getSubjectStats, minTheory, minPractical, getFutureInfo]);

    const getTodaySlots = (instances) => {
        const todayKeyLocal = dateKey(new Date());
        const slots = [];
        const dayData = semesterDays.find(d => d.date === todayKeyLocal);
        if (!dayData) return slots;

        dayData.lectures.forEach(l => {
            const name = typeof l.subject === 'string' ? l.subject : l.subject?.name;
            if (!name) return;

            const owningInstance = instances.find(inst => inst.name === name);
            if (!owningInstance) return;

            const logKey = `${name}#${l.isPractical ? 'P' : 'T'}`;
            slots.push({
                subjectId: owningInstance.id,
                subjectName: name,
                logKey,
                time: 'Today',
                type: l.isPractical ? 'Practical' : 'Lecture',
                attended: l.status
            });
        });
        return slots;
    };

    const handleCardClick = (card) => {
        const todaySlots = getTodaySlots(card.instances);
        setSelectedSubject({ name: card.name, slots: todaySlots });
    };

    // Mark today’s slot using per-lecture key so theory/practical are independent
    const markSlot = async (slotIndex, status) => {
        if (!selectedSubject) return;
        const slot = selectedSubject.slots[slotIndex];
        if (!slot) return;

        let note = '';
        if (status === 'Duty') {
            note = prompt("Enter Duty Details:", "");
            if (note === null) return;
        }

        try {
            const todayKeyLocal = dateKey(new Date());
            await markAttendance(todayKeyLocal, slot.logKey, status, note);

            // Keep modal UI in sync
            setSelectedSubject(prev => ({
                ...prev,
                slots: prev.slots.map((s, idx) =>
                    idx === slotIndex ? { ...s, attended: status } : s
                ),
            }));
        } catch (err) {
            console.error('Failed to mark attendance from Dashboard:', err);
            alert(err.message || 'Could not mark attendance. Check console for details.');
        }
    };

    if (stats.cards.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-6">
                <div className="text-center">
                    <BookOpen size={64} className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No subjects found.</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Set up your timetable to get started.</p>
                    <Button
                        onClick={() => navigate('/editor')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
                    >
                        Create Timetable
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black pb-6" style={{ paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>
            {/* Global Stats Header */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-6">
                <h2 className="text-white text-lg font-bold mb-4">Overall Attendance</h2>
                <p className="text-[11px] text-blue-100 mb-3">
                    {calculationMode === 'individual'
                        ? 'Rule: Theory and Practical must each meet their own minimum.'
                        : 'Rule: Theory and Practical are combined as an overall average.'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <p className="text-xs text-blue-100 mb-1">Overall</p>
                        <p className="text-2xl font-bold text-white">{stats.globalPercent}%</p>
                        <p className="text-xs text-blue-100 mt-1">{stats.globalPresent}/{stats.globalTotal}</p>
                        <p className="text-[11px] text-blue-100 mt-1">
                            Safe bunks (overall): <span className="font-semibold">{stats.globalSafeBunks}</span>
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <p className="text-xs text-blue-100 mb-1">Theory</p>
                        <p className="text-2xl font-bold text-white">{stats.theory.percent}%</p>
                        <p className="text-xs text-blue-100 mt-1">{stats.theory.present}/{stats.theory.total}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <p className="text-xs text-blue-100 mb-1">Practical</p>
                        <p className="text-2xl font-bold text-white">{stats.practical.percent}%</p>
                        <p className="text-xs text-blue-100 mt-1">{stats.practical.present}/{stats.practical.total}</p>
                    </div>
                </div>

                {/* Show either safe bunks or required classes based on overall status */}
                <p className="text-[11px] text-blue-100 mt-2">
                    {stats.globalRecovery > 0 ? (
                        <>
                            Need <span className="font-semibold">{stats.globalRecovery}</span> more
                            {" "}
                            class{stats.globalRecovery !== 1 ? "es" : ""} overall to reach the minimum.
                        </>
                    ) : (
                        <>
                            Safe bunks (overall):{" "}
                            <span className="font-semibold">{stats.globalSafeBunks}</span>
                        </>
                    )}
                </p>
                {stats.unmarkedCount > 0 && (
                    <div className="mt-4 bg-yellow-500/20 backdrop-blur-sm border border-yellow-400/30 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle size={18} className="text-yellow-300 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-100">
                            {stats.unmarkedCount} past lecture{stats.unmarkedCount > 1 ? 's' : ''} unmarked. Update them in Calendar.
                        </p>
                    </div>
                )}
            </div>

            {/* Subject Cards */}
            <div className="px-4 py-6 space-y-4">
                {stats.cards.map(card => {
                    const statusColor = card.isSafe
                        ? 'border-green-500 dark:border-green-400'
                        : 'border-red-500 dark:border-red-400';
                    const bgColor = card.isSafe
                        ? 'bg-green-50 dark:bg-green-900/10'
                        : 'bg-red-50 dark:bg-red-900/10';

                    return (
                        <div
                            key={card.id || `${card.name}-${card.part}`}
                            onClick={() => handleCardClick(card)}
                            className={`${bgColor} border-l-4 ${statusColor} bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">
                                        {card.name}
                                        {card.label && (
                                            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                                {card.label}
                                            </span>
                                        )}
                                        {card.isStrictSubject && (
                                            <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                                                Strict
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {card.present} / {card.total} classes
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-3xl font-bold ${card.isSafe ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {card.percent}%
                                    </p>
                                </div>
                            </div>

                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${card.isSafe ? 'bg-green-500' : 'bg-red-500'}`}
                                    style={{ width: `${card.percent}%` }}
                                />
                            </div>
                            {card.isSafe ? (
                                <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20 rounded-lg p-2">
                                        <TrendingUp size={16} />
                                        <span className="font-medium">
                                            You can safely bunk {card.safeBunks} class{card.safeBunks !== 1 ? 'es' : ''} in this {card.label || 'subject'}.
                                        </span>
                                    </div>
                                    {card.future.bunkBoundaryDate && (
                                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                            From <span className="font-semibold">{card.future.bunkBoundaryDate}</span> you must attend all remaining classes to stay above the target.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded-lg p-2">
                                        <TrendingDown size={16} />
                                        <span className="font-medium">
                                            Need {card.recoveryNeeded} more class{card.recoveryNeeded !== 1 ? 'es' : ''} to recover in this {card.label || 'subject'}.
                                        </span>
                                    </div>
                                    {card.future.remainingLectures > 0 && (
                                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                            If you attend all {card.future.remainingLectures} remaining classes, you&apos;ll finish around{" "}
                                            <span className="font-semibold">{card.future.projectedEndPercent}%</span>.
                                            {!card.future.canReachTarget && " This is still below the target — ask for extra classes."}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Quick Mark Modal */}
            {selectedSubject && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div onClick={() => setSelectedSubject(null)} className="absolute inset-0 bg-black/50" />
                    <div
                        className="relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl"
                        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                    >
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                                Mark today's attendance: {selectedSubject.name}
                            </h3>

                            {selectedSubject.slots.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No class scheduled today</p>
                            ) : (
                                <div className="space-y-3">
                                    {selectedSubject.slots.map((slot, idx) => (
                                        <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{slot.type}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Status: {slot.attended}</p>
                                            <div className="grid grid-cols-4 gap-2">
                                                <button
                                                    onClick={() => markSlot(idx, 'Present')}
                                                    className="py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                >
                                                    <Check size={14} /> Present
                                                </button>
                                                <button
                                                    onClick={() => markSlot(idx, 'Absent')}
                                                    className="py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                >
                                                    <X size={14} /> Absent
                                                </button>
                                                <button
                                                    onClick={() => markSlot(idx, 'Duty')}
                                                    className="py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                >
                                                    <ShieldOff size={14} /> Duty
                                                </button>
                                                <button
                                                    onClick={() => markSlot(idx, 'Cancelled')}
                                                    className="py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                >
                                                    Cancelled
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button
                                onClick={() => setSelectedSubject(null)}
                                variant="secondary"
                                className="w-full mt-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
