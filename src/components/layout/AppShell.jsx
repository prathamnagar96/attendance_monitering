import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, Settings, Calculator } from "lucide-react";
import { useAttendanceStore } from "../../logic/useAttendanceStore";

export default function AppShell() {
    const location = useLocation();
    const { isConfigured } = useAttendanceStore();
    const hideNav =
        location.pathname.startsWith("/onboarding") ||
        !isConfigured;

    return (
        <div className="min-h-screen bg-light-bg dark:bg-dark-bg transition-colors">
            <Outlet />
            {!hideNav && <BottomNav />}
        </div>
    );
}

function BottomNav() {
    const navItems = [
        { path: "/", icon: LayoutDashboard, label: "Dashboard" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
        { path: "/sgpa", icon: Calculator, label: "SGPA" },
        { path: "/settings", icon: Settings, label: "Settings" },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border z-40"
            style={{ paddingBottom: "var(--sab)" }}
        >
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {navItems.map(({ path, icon: Icon, label }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive
                                ? "text-instagram-purple"
                                : "text-light-textSecondary dark:text-dark-textSecondary"
                            }`
                        }
                    >
                        <Icon className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">{label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
