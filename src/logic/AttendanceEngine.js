// src/logic/AttendanceEngine.js

import { startOfWeek, addDays, format, parseISO, isSameDay, isWeekend as fnsIsWeekend, eachDayOfInterval } from 'date-fns';

// --- 1. Data Models ---

export const LectureStatus = {
    PRESENT: 'Present',
    ABSENT: 'Absent',
    CANCELLED: 'Cancelled',
    DUTY: 'Duty',
    UPCOMING: 'Upcoming'
};

export class Lecture {
    constructor({ subject, status = LectureStatus.UPCOMING, isStrict = false, isPractical = false }) {
        this.subject = subject;
        this.status = status;
        this.isStrict = Boolean(isStrict);
        this.isPractical = Boolean(isPractical);
    }
}

export class Day {
    constructor(date, lectures = []) {
        this.date = date; // Now storing as YYYY-MM-DD string for stability
        this.lectures = lectures;
    }
}

// --- 2. Helpers ---

export function toDate(d) {
    if (d instanceof Date) return new Date(d);
    return new Date(d);
}

// FIX: Handle both Date objects and Strings robustly
export function dateKey(date) {
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date;
    }
    const d = toDate(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const getSubjectName = (lecture) => {
    if (typeof lecture.subject === 'string') return lecture.subject;
    return lecture.subject?.name || 'Unknown';
};

// --- 3. Core Engine: Generate Semester ---

export function generateSemester(startStr, endStr, weeklyTimetable, options = {}) {
    if (!startStr || !endStr) return [];

    const start = toDate(startStr);
    const end = toDate(endStr);

    const holidayDates = Array.isArray(options.holidayDates) ? options.holidayDates : [];
    const weekendDays = Array.isArray(options.weekendDays) ? options.weekendDays : [0];
    const saturdayMode = options.saturdayMode || 'all_off';
    const extraClasses = Array.isArray(options.extraClasses) ? options.extraClasses : [];

    const holidaySet = new Set(holidayDates.map((d) => dateKey(d)));
    const days = [];

    // Normalize to 00:00 local time to avoid timezone skips
    let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (current <= last) {
        const dKey = dateKey(current); // Use string key
        const nativeDay = current.getDay();
        const timetableIndex = nativeDay === 0 ? 6 : nativeDay - 1;

        const isHoliday = holidaySet.has(dKey);
        let isWeekend = weekendDays.includes(nativeDay);

        // Saturday Logic
        if (nativeDay === 6) {
            if (saturdayMode === 'all_off') {
                isWeekend = true;
            } else if (saturdayMode === 'alternate') {
                const dayOfMonth = current.getDate();
                const weekNum = Math.floor((dayOfMonth - 1) / 7) + 1;
                if (weekNum === 2 || weekNum === 4) {
                    isWeekend = true;
                }
            }
        }

        let lectures = [];

        // Normal Schedule
        if (!isHoliday && !isWeekend && weeklyTimetable[timetableIndex]) {
            // ✅ FILTER OUT null/invalid slots so tpl.name does not crash
            const templates = (weeklyTimetable[timetableIndex] || []).filter(
                (tpl) => tpl && (tpl.name || tpl.subject)
            );

            lectures = templates.map(tpl =>
                new Lecture({
                    subject: tpl.name || tpl.subject || 'Unknown',
                    isStrict: !!tpl.isStrict,
                    isPractical: !!tpl.isPractical,
                    status: LectureStatus.UPCOMING,
                })
            );
        }

        // Initialize Day with String Date
        const dayObj = new Day(dKey, lectures);
        days.push(dayObj);

        // Extra Classes (Merged)
        extraClasses.forEach(ec => {
            if (!ec.date || !ec.subjectName) return;
            if (ec.date === dKey) {
                dayObj.lectures.push(new Lecture({
                    subject: ec.subjectName,
                    isStrict: false,
                    isPractical: ec.type === 'Practical',
                    status: LectureStatus.UPCOMING
                }));
            }
        });

        // Next day
        current.setDate(current.getDate() + 1);
    }

    return days;
}

// --- 4. Core Engine: Statistics & Math ---

// UPDATED: Check if lecture is in the past and still UPCOMING
const isPastDate = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
};

const isConducted = (status, dateStr) => {
    // Explicit conducted statuses
    if (
        status === LectureStatus.PRESENT ||
        status === LectureStatus.ABSENT ||
        status === LectureStatus.DUTY
    ) {
        return true;
    }

    // UPDATED: If it's in the past and still UPCOMING, count it as conducted (will be treated as Absent)
    if (status === LectureStatus.UPCOMING && isPastDate(dateStr)) {
        return true;
    }

    return false;
};

const isAttended = (status, dateStr) => {
    // Duty should NOT be treated as present; only real presence counts.
    if (status === LectureStatus.PRESENT) {
        return true;
    }

    // UPDATED: Past UPCOMING lectures count as NOT attended (i.e., Absent)
    return false;
};

export const calculateSafeBunks = (present, total, targetPercent = 0.75) => {
    if (total === 0) return 0;
    const currentPercent = present / total;
    if (currentPercent < targetPercent) return 0;
    const maxBunks = Math.floor((present / targetPercent) - total);
    return Math.max(0, maxBunks);
};

export const calculateRecoveryClasses = (present, total, targetPercent = 0.75) => {
    if (total === 0) return 0;
    const currentPercent = present / total;
    if (currentPercent >= targetPercent) return 0;
    const numerator = (targetPercent * total) - present;
    const denominator = 1 - targetPercent;
    if (denominator <= 0) return 999;
    const needed = Math.ceil(numerator / denominator);
    return Math.max(0, needed);
};

export function computeAttendanceStats(days, opts = {}) {
    const {
        subjectName,
        minAttendanceTheory = 75,
        minAttendancePractical = 75,
        simulationOverrides = null
    } = opts;

    let present = 0;
    let total = 0;
    let councilDuty = 0;
    let isStrict = false;

    let theory = { present: 0, total: 0 };
    let practical = { present: 0, total: 0 };

    days.forEach((day) => {
        // day.date is now a string "YYYY-MM-DD"
        const dKey = day.date;

        day.lectures.forEach((lec) => {
            const lecSubName = getSubjectName(lec);
            if (subjectName && lecSubName !== subjectName) return;

            let effectiveStatus = lec.status;

            // Simulation Override – per-lecture key (subject + theory/practical)
            if (simulationOverrides) {
                const simKey = `${dKey}-${lecSubName}#${lec.isPractical ? 'P' : 'T'}`;
                if (simulationOverrides[simKey]) {
                    effectiveStatus = simulationOverrides[simKey];
                }
            }

            if (lec.isStrict) isStrict = true;

            // UPDATED: Pass dateStr to isConducted
            if (isConducted(effectiveStatus, dKey)) {
                total++;
                if (lec.isPractical) practical.total++;
                else theory.total++;

                // UPDATED: Pass dateStr to isAttended
                if (isAttended(effectiveStatus, dKey)) {
                    present++;
                    if (effectiveStatus === LectureStatus.DUTY) councilDuty++;
                    if (lec.isPractical) practical.present++;
                    else theory.present++;
                }
            }
        });
    });

    const theoryPercent = theory.total === 0 ? 100 : Math.round((theory.present / theory.total) * 100);
    const practicalPercent = practical.total === 0 ? 100 : Math.round((practical.present / practical.total) * 100);

    // Overall attendance is defined as the average of theory and practical percentages
    const overallParts = [];
    if (theory.total > 0) overallParts.push(theoryPercent);
    if (practical.total > 0) overallParts.push(practicalPercent);
    const attendancePercent =
        overallParts.length === 0
            ? 100
            : Math.round(overallParts.reduce((sum, v) => sum + v, 0) / overallParts.length);

    const theoryTarget = minAttendanceTheory / 100;
    const practicalTarget = minAttendancePractical / 100;
    const overallTarget = theoryTarget;

    return {
        present,
        total,
        councilDuty,
        attendancePercent,
        isStrict,
        overallSafeBunks: calculateSafeBunks(present, total, overallTarget),
        overallRecovery: calculateRecoveryClasses(present, total, overallTarget),
        theory: {
            ...theory,
            percent: theoryPercent,
            safeBunks: calculateSafeBunks(theory.present, theory.total, theoryTarget),
            recoveryClasses: calculateRecoveryClasses(theory.present, theory.total, theoryTarget)
        },
        practical: {
            ...practical,
            percent: practicalPercent,
            safeBunks: calculateSafeBunks(practical.present, practical.total, practicalTarget),
            recoveryClasses: calculateRecoveryClasses(practical.present, practical.total, practicalTarget)
        },
        isTheorySafe: theoryPercent >= minAttendanceTheory,
        isPracticalSafe: practicalPercent >= minAttendancePractical
    };
}
