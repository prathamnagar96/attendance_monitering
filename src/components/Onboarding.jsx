// src/components/Onboarding.jsx - FINAL VERSION
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Calendar, BookOpen, Beaker, Layers, ChevronRight, ChevronLeft, Loader2,
    Plus, X, Sparkles, Grid3X3, Shield
} from "lucide-react";
import { useAttendanceStore } from "../logic/useAttendanceStore";

export default function Onboarding() {
    const navigate = useNavigate();
    const { addSubjects, saveSettings } = useAttendanceStore();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Data
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [currentSubject, setCurrentSubject] = useState("");
    const [currentType, setCurrentType] = useState("theory");

    // Auto semester dates
    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        if (now.getMonth() >= 6) {
            setStartDate(`${year}-07-01`);
            setEndDate(`${year}-12-31`);
        } else {
            setStartDate(`${year}-01-01`);
            setEndDate(`${year}-06-30`);
        }
    }, []);

    // FIXED Type Config - Proper Colors
    const typeConfig = {
        theory: {
            icon: BookOpen,
            bg: "bg-blue-500",
            text: "text-white",
            label: "Theory",
            inactiveBg: "bg-blue-100 hover:bg-blue-200",
            inactiveText: "text-blue-700"
        },
        practical: {
            icon: Beaker,
            bg: "bg-purple-500",
            text: "text-white",
            label: "Practical",
            inactiveBg: "bg-purple-100 hover:bg-purple-200",
            inactiveText: "text-purple-700"
        },
        both: {
            icon: Layers,
            bg: "bg-emerald-500",
            text: "text-white",
            label: "Both",
            inactiveBg: "bg-emerald-100 hover:bg-emerald-200",
            inactiveText: "text-emerald-700"
        }
    };

    // Add Subject
    const addSubject = () => {
        const name = currentSubject.trim();
        if (!name) return alert("Enter subject name");
        if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            return alert("Subject already added");
        }

        const subject = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2)}`,
            name,
            type: currentType,
            isPractical: currentType === "practical" || currentType === "both",
            trackTheory: currentType === "theory" || currentType === "both",
            isStrict: false
        };

        setSubjects([...subjects, subject]);
        setCurrentSubject("");
        // Auto-focus input
        setTimeout(() => document.getElementById('subject-input')?.focus(), 100);
    };

    // Remove Subject
    const removeSubject = (index) => {
        setSubjects(prev => prev.filter((_, i) => i !== index));
    };

    // Validation
    const validStep1 = startDate && endDate && new Date(startDate) < new Date(endDate);
    const validStep2 = subjects.length > 0;

    // Complete - persist semester + subjects, then route user
    const completeSetup = async (choice) => {
        if (!validStep1 || !validStep2) return;
        setLoading(true);

        try {
            const subjectPayload = subjects.map((s) => ({
                id: s.id,
                name: s.name,
                type: s.type,
                isPractical: s.isPractical,
                trackTheory: s.trackTheory,
                isStrict: s.isStrict,
            }));

            await addSubjects(subjectPayload);
            await saveSettings({
                semesterStart: startDate,
                semesterEnd: endDate,
            });

            // Expose to TimetableEditor for first-time OCR/bootstrap
            window.onboardingComplete = {
                startDate,
                endDate,
                subjects: subjectPayload,
                choice,
            };

            if (choice === "scan") {
                navigate("/scan");
            } else if (choice === "editor") {
                navigate("/editor");
            } else {
                navigate("/dashboard");
            }
        } catch (err) {
            console.error("Onboarding setup failed:", err);
            alert("Failed to save setup. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ NEW: static color map for step 3 options (no template strings)
    const step3ColorClasses = {
        blue: {
            card: "bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 border-blue-200 hover:border-blue-300",
            icon: "bg-blue-500",
        },
        purple: {
            card: "bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 border-purple-200 hover:border-purple-300",
            icon: "bg-purple-500",
        },
        emerald: {
            card: "bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 border-emerald-200 hover:border-emerald-300",
            icon: "bg-emerald-500",
        },
    };

    return (
        <div className="min-h-screen onboarding-bg bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 p-6 flex items-center justify-center">
            <div className="w-full max-w-lg">
                {/* Progress Dots */}
                <div className="flex justify-center gap-3 mb-8">
                    {[1, 2, 3].map(s => (
                        <div
                            key={s}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${s === step
                                ? 'w-8 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg'
                                : s < step
                                    ? 'w-3 h-3 bg-emerald-500'
                                    : 'w-3 h-3 bg-gray-300'
                                }`}
                        />
                    ))}
                </div>

                {/* STEP 1: Semester Dates */}
                {step === 1 && (
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 dark:border-slate-800/60">
                        <div className="text-center mb-8">
                            <Calendar size={56} className="mx-auto mb-4 bg-blue-100 p-3 rounded-2xl text-blue-600" />
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                                Semester Setup
                            </h1>
                            <p className="text-gray-600">Enter your semester dates</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-200 rounded-2xl text-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-200 rounded-2xl text-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const year = new Date().getFullYear();
                                    setStartDate(`${year}-07-01`);
                                    setEndDate(`${year}-12-31`);
                                }}
                                className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all"
                            >
                                <Sparkles size={20} className="inline mr-2" />
                                Auto-fill Semester
                            </button>
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!validStep1}
                            className="w-full mt-8 p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 mt-4"
                        >
                            Next Step
                            <ChevronRight size={20} className="inline ml-2" />
                        </button>
                    </div>
                )}

                {/* STEP 2: Subjects - FIXED COLORS */}
                {step === 2 && (
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 dark:border-slate-800/60">
                        <div className="text-center mb-8">
                            <BookOpen size={56} className="mx-auto mb-4 bg-indigo-100 p-3 rounded-2xl text-indigo-600" />
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                                Add Subjects
                            </h1>
                            <p className="text-gray-600">Select type for each subject</p>
                        </div>

                        <div className="space-y-6">
                            {/* Subject Input */}
                            <div>
                                <input
                                    id="subject-input"
                                    type="text"
                                    value={currentSubject}
                                    onChange={e => setCurrentSubject(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && addSubject()}
                                    placeholder="e.g., Machine Learning"
                                    className="w-full p-5 border-2 border-gray-200 rounded-2xl text-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                />
                            </div>

                            {/* FIXED 3-Type Buttons - PROPER COLORS */}
                            <div className="grid grid-cols-3 gap-4">
                                {Object.entries(typeConfig).map(([key, config]) => {
                                    const Icon = config.icon;
                                    const isActive = currentType === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setCurrentType(key)}
                                            className={`p-5 rounded-2xl flex flex-col items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 group ${isActive
                                                ? `${config.bg} ${config.text} transform scale-105 ring-4 ring-offset-2 ring-white/50`
                                                : `${config.inactiveBg} ${config.inactiveText}`
                                                }`}
                                        >
                                            <Icon size={28} />
                                            <span className="font-bold text-sm">{config.label}</span>
                                            {isActive && <Shield size={16} className="absolute -top-2 -right-2 bg-white p-1 rounded-full shadow-md" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={addSubject}
                                className="w-full p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all"
                            >
                                <Plus size={24} className="inline mr-3" />
                                Add Subject
                            </button>
                        </div>

                        {/* Subjects List */}
                        {subjects.length > 0 && (
                            <div className="mt-8 p-6 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-3xl border-2 border-emerald-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-2xl font-bold text-emerald-800">
                                        Added Subjects ({subjects.length})
                                    </h3>
                                    <span className="px-3 py-1 bg-emerald-200 text-emerald-800 rounded-full text-sm font-semibold">
                                        Ready ✓
                                    </span>
                                </div>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {subjects.map((subject, index) => {
                                        const config = typeConfig[subject.type];
                                        const Icon = config.icon;
                                        return (
                                            <div key={subject.id} className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all">
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div className={`${config.bg} w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg`}>
                                                        <Icon size={24} className={config.text} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-xl text-gray-900">{subject.name}</h4>
                                                        <span className="inline-block mt-1 px-3 py-1 bg-gradient-to-r from-gray-100 to-gray-200 text-xs font-semibold rounded-full">
                                                            {config.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeSubject(index)}
                                                    className="p-3 text-red-500 hover:bg-red-100 rounded-2xl transition-all hover:scale-110"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 p-5 border-2 border-gray-300 rounded-2xl font-semibold hover:bg-gray-50 transition-all"
                            >
                                <ChevronLeft size={20} className="inline mr-2" />
                                Previous
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!validStep2}
                                className="flex-1 p-5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                            >
                                Next
                                <ChevronRight size={20} className="inline ml-2" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Timetable Choice */}
                {step === 3 && (
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 dark:border-slate-800/60">
                        <div className="text-center mb-8">
                            <Grid3X3 size={56} className="mx-auto mb-4 bg-emerald-100 p-3 rounded-2xl text-emerald-600" />
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                                All Set! 🎉
                            </h1>
                            <p className="text-gray-600 text-lg">{subjects.length} subjects ready</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            {[
                                { id: "editor", title: "Timetable Editor", desc: "Arrange subjects in time slots", icon: Grid3X3, color: "blue" },
                                { id: "scan", title: "Scan Photo", desc: "Upload timetable image (OCR)", icon: Sparkles, color: "purple" },
                                { id: "dashboard", title: "Skip Setup", desc: "Start tracking immediately", icon: Shield, color: "emerald" }
                            ].map(({ id, title, desc, icon: Icon, color }) => {
                                const palette = step3ColorClasses[color];
                                return (
                                    <button
                                        key={id}
                                        onClick={() => completeSetup(id)}
                                        disabled={loading}
                                        className={`w-full p-6 rounded-2xl shadow-lg transition-all duration-300 border-2 ${loading
                                                ? "bg-gray-100 cursor-not-allowed border-gray-200"
                                                : `${palette.card}`
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`${palette.icon} w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg`}>
                                                <Icon size={24} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-xl text-gray-900 mb-2">{title}</h3>
                                                <p className="text-gray-600">{desc}</p>
                                            </div>
                                            <ChevronRight size={24} className="text-gray-400 flex-shrink-0" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            className="w-full p-5 border-2 border-gray-300 rounded-2xl font-semibold hover:bg-gray-50 transition-all"
                        >
                            <ChevronLeft size={20} className="inline mr-2" />
                            Edit Subjects
                        </button>

                        {loading && (
                            <div className="mt-8 flex items-center justify-center gap-4 p-6 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
                                <Loader2 className="animate-spin text-emerald-600" size={28} />
                                <div>
                                    <div className="font-bold text-lg text-emerald-800">Saving Setup...</div>
                                    <div className="text-sm text-emerald-700">{subjects.length} subjects configured</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
