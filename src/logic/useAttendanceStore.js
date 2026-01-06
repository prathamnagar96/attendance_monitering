// src/logic/useAttendanceStore.js
import { create } from 'zustand';
import { openDB } from 'idb';
import {
    generateSemester,
    computeAttendanceStats,
    dateKey,
    LectureStatus
} from './AttendanceEngine';

const DB_NAME = 'AttendanceDB';
const DB_VERSION = 2;
const STORES = {
    TIMETABLE: 'timetable',
    ATTENDANCELOG: 'attendanceLog',
    SUBJECTS: 'subjects',
    SETTINGS: 'settings',
    NOTES: 'notes'
};

const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (!db.objectStoreNames.contains(STORES.TIMETABLE)) db.createObjectStore(STORES.TIMETABLE);
            if (!db.objectStoreNames.contains(STORES.ATTENDANCELOG)) db.createObjectStore(STORES.ATTENDANCELOG, { keyPath: 'date' });
            if (!db.objectStoreNames.contains(STORES.SUBJECTS)) db.createObjectStore(STORES.SUBJECTS, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) db.createObjectStore(STORES.SETTINGS);
            if (!db.objectStoreNames.contains(STORES.NOTES)) {
                db.createObjectStore(STORES.NOTES);
            }
        },
    });
};

const mapTimetableToEngine = (timetable) => {
    const MAP = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const weekArr = [[], [], [], [], [], [], []];
    if (!timetable) return weekArr;
    Object.keys(timetable).forEach(dayName => {
        const short = dayName.substring(0, 3);
        const idx = MAP[short];
        if (idx !== undefined) {
            weekArr[idx] = timetable[dayName];
        }
    });
    return weekArr;
};

const scheduleNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Attendance Alert', { body: message });
    }
};

export const useAttendanceStore = create((set, get) => ({
    subjects: [],
    timetable: {},
    history: {},
    notes: {},
    semesterDays: [],
    settings: {
        minAttendanceTheory: 75,
        minAttendancePractical: 75,
        semesterStart: '',
        semesterEnd: '',
        holidayDates: [],
        weekendDays: [0],
        calculationMode: 'overall',
        saturdayMode: 'all_off',
        extraClasses: [],
        theme: 'light',          // NEW: Theme setting
        periodsPerDay: 6,        // NEW: dynamic lecture slots per day
    },
    isLoading: true,
    isConfigured: false,
    db: null,
    isSimulationMode: false,
    simulationChanges: {},

    init: async () => {
        try {
            const db = await initDB();
            const [timetable, subjects, settings, logData, notesData] = await Promise.all([
                db.get(STORES.TIMETABLE, 'weeklySchedule'),
                db.getAll(STORES.SUBJECTS),
                db.get(STORES.SETTINGS, 'userSettings'),
                db.getAll(STORES.ATTENDANCELOG),
                db.getAllKeys(STORES.NOTES).then(keys =>
                    Promise.all(keys.map(k => db.get(STORES.NOTES, k).then(v => ({ key: k, val: v }))))
                ),
            ]);

            const historyMap = {};
            if (logData) {
                logData.forEach(entry => {
                    historyMap[entry.date] = entry.records;
                });
            }

            const notesMap = {};
            if (notesData) {
                notesData.forEach(item => {
                    notesMap[item.key] = item.val;
                });
            }

            const currentSettings = settings || {
                minAttendanceTheory: 75,
                minAttendancePractical: 75,
                holidayDates: [],
                weekendDays: [0],
                calculationMode: 'overall',
                saturdayMode: 'all_off',
                extraClasses: [],
                theme: 'light',
                periodsPerDay: 6,              // NEW default for fresh installs
            };

            // ensure periodsPerDay always present
            if (currentSettings.periodsPerDay == null) {
                currentSettings.periodsPerDay = 6;
            }

            const hasConfig = !!currentSettings.semesterStart;

            set({
                db,
                timetable: timetable || {},
                subjects: subjects || [],
                history: historyMap,
                notes: notesMap,
                settings: currentSettings,
                isConfigured: hasConfig
            });

            // Apply theme on load
            if (currentSettings.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            if (hasConfig) {
                await get().recalculateAttendance();
            }

            set({ isLoading: false });
        } catch (err) {
            console.error('Failed to init DB:', err);
            set({ isLoading: false });
        }
    },

    getTimetable: () => get().timetable,

    recalculateAttendance: async () => {
        const { settings, timetable, history, notes, subjects } = get();
        if (!settings.semesterStart || !settings.semesterEnd) return;

        const resolvedExtraClasses = (settings.extraClasses || []).map(ec => {
            const sub = subjects.find(s => s.id === ec.subjectId);
            return {
                ...ec,
                subjectName: sub ? sub.name : (ec.subjectName || 'Unknown')
            };
        });

        const mappedTimetable = mapTimetableToEngine(timetable);
        const semesterDays = generateSemester(
            settings.semesterStart,
            settings.semesterEnd,
            mappedTimetable,
            {
                holidayDates: settings.holidayDates,
                weekendDays: settings.weekendDays,
                saturdayMode: settings.saturdayMode,
                extraClasses: resolvedExtraClasses
            }
        );

        semesterDays.forEach(day => {
            const dKey = dateKey(day.date);
            const dayLog = history[dKey];

            day.lectures.forEach(lec => {
                const subName = typeof lec.subject === 'string' ? lec.subject : lec.subject.name;

                if (dayLog && dayLog[subName]) {
                    lec.status = dayLog[subName];
                }

                const noteKey = `${dKey}-${subName}`;
                if (notes[noteKey]) {
                    lec.note = notes[noteKey];
                }
            });
        });

        set({ semesterDays });
    },

    getSubjectStats: (subjectId) => {
        const { subjects, semesterDays, settings, isSimulationMode, simulationChanges } = get();
        const sub = subjects.find(s => s.id === subjectId);
        if (!sub) return { present: 0, total: 0 };
        return computeAttendanceStats(semesterDays, {
            subjectName: sub.name,
            minAttendanceTheory: settings.minAttendanceTheory,
            minAttendancePractical: settings.minAttendancePractical,
            simulationOverrides: isSimulationMode ? simulationChanges : null
        });
    },

    markAttendance: async (arg1, arg2, arg3, arg4) => {
        let dateStr, subjectName, newStatus, note;

        if (arg3 !== undefined) {
            dateStr = arg1;
            subjectName = arg2;
            newStatus = arg3;
            note = arg4;
        } else {
            const subId = arg1;
            newStatus = arg2;
            note = arg3;
            const { subjects } = get();
            const sub = subjects.find(s => s.id === subId);
            if (!sub) return;
            subjectName = sub.name;
            dateStr = dateKey(new Date());
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(dateStr);
        targetDate.setHours(0, 0, 0, 0);

        if (targetDate > today) {
            throw new Error("Future attendance only in Preview mode");
        }

        const { history, notes, db } = get();

        const dayLog = history[dateStr] || {};
        const newDayLog = { ...dayLog, [subjectName]: newStatus };
        const newHistory = { ...history, [dateStr]: newDayLog };

        let newNotes = { ...notes };
        const noteKey = `${dateStr}-${subjectName}`;
        if (note !== undefined) {
            if (note) newNotes[noteKey] = note;
            else delete newNotes[noteKey];
        }

        set({ history: newHistory, notes: newNotes });

        if (db) {
            await db.put(STORES.ATTENDANCELOG, { date: dateStr, records: newDayLog });
            if (note !== undefined) {
                if (note) await db.put(STORES.NOTES, note, noteKey);
                else await db.delete(STORES.NOTES, noteKey);
            }

            await get().recalculateAttendance();
            await get().checkAttendanceHealth();
        }
    },

    saveSettings: async (newSettings) => {
        const { db } = get();
        const merged = { ...get().settings, ...newSettings };

        // Apply theme change immediately
        if (newSettings.theme) {
            if (newSettings.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }

        set({ settings: merged, isConfigured: !!merged.semesterStart });
        if (db) await db.put(STORES.SETTINGS, merged, 'userSettings');
        await get().recalculateAttendance();
    },

    addExtraClass: async (extraClass) => {
        const { settings } = get();
        const currentExtra = settings.extraClasses || [];
        const updatedExtra = [...currentExtra, extraClass];
        await get().saveSettings({ extraClasses: updatedExtra });
    },

    // NEW: batch-add subjects in a single IndexedDB transaction
    addSubjects: async (subjectEntries) => {
        const { subjects, db } = get();
        const existingNames = new Set(subjects.map(s => s.name));
        const newSubs = [];

        (subjectEntries || []).forEach((entry) => {
            // Support simple string names
            if (typeof entry === 'string') {
                const trimmed = entry.trim();
                if (!trimmed || existingNames.has(trimmed)) return;

                newSubs.push({
                    id: trimmed.toLowerCase().replace(/\s+/g, '_'),
                    name: trimmed,
                });
                existingNames.add(trimmed);
                return;
            }

            // Support rich subject objects from onboarding
            if (!entry || typeof entry !== 'object') return;

            const trimmedName = String(entry.name || '').trim();
            if (!trimmedName || existingNames.has(trimmedName)) return;

            newSubs.push({
                id: entry.id || trimmedName.toLowerCase().replace(/\s+/g, '_'),
                name: trimmedName,
                type: entry.type,
                isPractical: !!entry.isPractical,
                trackTheory: !!entry.trackTheory,
                isStrict: !!entry.isStrict,
                createdAt: entry.createdAt || new Date().toISOString(),
            });
            existingNames.add(trimmedName);
        });

        if (!newSubs.length) return;

        set({ subjects: [...subjects, ...newSubs] });

        let dbInstance = db;
        if (!dbInstance) {
            dbInstance = await initDB();
            set({ db: dbInstance });
        }

        const tx = dbInstance.transaction([STORES.SUBJECTS], 'readwrite');
        const store = tx.objectStore(STORES.SUBJECTS);
        for (const sub of newSubs) {
            await store.put(sub);
        }
        await tx.done;
    },

    addSubject: async (name, isStrict, isPractical) => {
        const { subjects, db } = get();
        if (subjects.find(s => s.name === name)) return;
        const newSub = { id: Date.now() + Math.random(), name, isStrict, isPractical };
        const newSubjects = [...subjects, newSub];
        set({ subjects: newSubjects });
        if (db) await db.put(STORES.SUBJECTS, newSub);
    },

    saveTimetable: async (newTimetable) => {
        const { db } = get();
        set({ timetable: newTimetable });
        if (db) await db.put(STORES.TIMETABLE, newTimetable, 'weeklySchedule');
        await get().recalculateAttendance();
    },

    // CRITICAL FIX: Batch semester initialization helper
    initializeSemester: async (startDate, endDate, subjectsArray = []) => {
        try {
            // Clear existing state
            set({ subjects: [], semesterDays: [] });

            // Generate semester days
            const days = [];
            const start = new Date(startDate);
            const end = new Date(endDate);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                days.push({ date: dateStr, lectures: [] });
            }

            // BATCH CREATE SUBJECTS - SINGLE OPERATION
            const createdSubjects = (subjectsArray || []).map((subjectData) => ({
                id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: subjectData.name,
                type: subjectData.type,          // "theory", "practical", "both"
                isPractical: subjectData.isPractical,
                trackTheory: subjectData.trackTheory,
                isStrict: false,
                createdAt: new Date().toISOString(),
            }));

            // ATOMIC STATE UPDATE (preserve other settings fields)
            set({
                subjects: createdSubjects,
                semesterDays: days,
                settings: {
                    ...get().settings,
                    semesterStart: startDate,
                    semesterEnd: endDate,
                    minAttendanceTheory: 75,
                    minAttendancePractical: 75,
                },
            });

            return { success: true, subjects: createdSubjects };
        } catch (error) {
            console.error("Semester init failed:", error);
            throw error;
        }
    },

    // NEW: helper used by onboarding to set semester start/end
    setSemesterDates: async (semesterStart, semesterEnd) => {
        await get().saveSettings({ semesterStart, semesterEnd });
    },

    resetData: async () => {
        const { db } = get();
        if (db) {
            const tx = db.transaction(
                [STORES.TIMETABLE, STORES.ATTENDANCELOG, STORES.SUBJECTS, STORES.SETTINGS, STORES.NOTES],
                'readwrite'
            );
            await tx.objectStore(STORES.TIMETABLE).clear();
            await tx.objectStore(STORES.ATTENDANCELOG).clear();
            await tx.objectStore(STORES.SUBJECTS).clear();
            await tx.objectStore(STORES.SETTINGS).clear();
            await tx.objectStore(STORES.NOTES).clear();
            await tx.done;

            set({
                subjects: [],
                timetable: {},
                history: {},
                notes: {},
                semesterDays: [],
                isConfigured: false,
                isSimulationMode: false,
                simulationChanges: {},
                settings: {
                    minAttendanceTheory: 75,
                    minAttendancePractical: 75,
                    holidayDates: [],
                    weekendDays: [0],
                    calculationMode: 'overall',
                    saturdayMode: 'all_off',
                    extraClasses: [],
                    theme: 'light',
                    periodsPerDay: 6,      // NEW: reset to default
                }
            });
        }
    },

    // --- Simulation controls (FIXED) ---
    toggleSimulationMode: () => {
        const { isSimulationMode } = get();

        // If turning OFF -> clear simulationChanges too (so UI doesn't keep stale overrides)
        if (isSimulationMode) {
            set({ isSimulationMode: false, simulationChanges: {} });
        } else {
            set({ isSimulationMode: true, simulationChanges: {} });
        }
    },

    toggleSimulation: (date, subjectName, status) => {
        const { simulationChanges } = get();
        const key = `${date}-${subjectName}`;
        const next = { ...simulationChanges, [key]: status };
        set({ simulationChanges: next });
    },

    clearSimulation: () => {
        set({ simulationChanges: {}, isSimulationMode: false });
    },

    checkAttendanceHealth: async () => {
        const { subjects, settings, getSubjectStats } = get();
        const minTheory = settings.minAttendanceTheory || 75;
        const minPractical = settings.minAttendancePractical || 75;

        subjects.forEach(sub => {
            const stats = getSubjectStats(sub.id);
            if (stats.theory && stats.theory.total > 0) {
                const theoryPercent = stats.theory.percent;
                if (theoryPercent < minTheory && theoryPercent >= minTheory - 5) {
                    scheduleNotification(`Warning: ${sub.name} (Theory) is at ${theoryPercent}%. Attend the next class!`);
                }
            }
            if (stats.practical && stats.practical.total > 0) {
                const practicalPercent = stats.practical.percent;
                if (practicalPercent < minPractical && practicalPercent >= minPractical - 5) {
                    scheduleNotification(`Warning: ${sub.name} (Practical) is at ${practicalPercent}%. Attend the next class!`);
                }
            }
        });
    }
}));
