// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAttendanceStore } from "./logic/useAttendanceStore";

// Components
import Dashboard from "./components/Dashboard";
import CalendarPage from "./components/CalendarPage";
import SettingsPage from "./components/SettingsPage";
import OCRScanner from "./components/OCRScanner";
import TimetableEditor from "./components/TimetableEditor";
import Onboarding from "./components/Onboarding";
import AppShell from "./components/layout/AppShell";

const Loader = () => (
    <div className="flex items-center justify-center h-screen bg-light-bg dark:bg-dark-bg">
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-700 dark:text-gray-200 font-semibold">
                Loading Attendance...
            </p>
        </div>
    </div>
);

export default function App() {
    const { init, isLoading, isConfigured, settings } = useAttendanceStore();

    useEffect(() => {
        init();
    }, [init]);

    // ✅ Request notification permission early (safe on web + WebView)
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("Notification" in window)) return;
        if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => {
                // ignore failures; app will just skip native notifications
            });
        }
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        if (settings.theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
    }, [settings.theme]);

    if (isLoading) return <Loader />;

    return (
        <div className="min-h-screen bg-light-bg dark:bg-dark-bg transition-colors">
            <Routes>
                <Route path="/" element={<AppShell />}>
                    <Route
                        index
                        element={
                            isConfigured ? <Dashboard /> : <Navigate to="/onboarding" />
                        }
                    />
                    <Route
                        path="dashboard"
                        element={
                            isConfigured ? <Dashboard /> : <Navigate to="/onboarding" />
                        }
                    />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="scan" element={<OCRScanner />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="editor" element={<TimetableEditor />} />
                    <Route path="onboarding" element={<Onboarding />} />
                </Route>
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </div>
    );
}
