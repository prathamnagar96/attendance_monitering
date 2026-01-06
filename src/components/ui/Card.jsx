import React from 'react';

export const Card = ({ children, className = '' }) => (
    <div className={`rounded-xl border bg-card text-card-foreground shadow-sm ${className}`}>
        {children}
    </div>
);

export const CardHeader = ({ children, className = '' }) => (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

export const CardContent = ({ children, className = '' }) => (
    <div className={`p-6 pt-0 ${className}`}>{children}</div>
);
