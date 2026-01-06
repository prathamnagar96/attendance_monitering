import React from 'react';

export const ProgressBar = ({ value = 0, max = 100, className = '' }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className={`h-2 w-full overflow-hidden rounded-full bg-secondary ${className}`}>
            <div
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};
