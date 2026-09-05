"use client";

import { useState } from "react";

export function useToast() {
    const [toast, setToast] = useState({
        show: false,
        title: "",
        description: "",
        variant: "default",
    });

    const show = (props) => {
        setToast({ ...toast, ...props, show: true });
    };

    const dismiss = () => {
        setToast({ ...toast, show: false });
    };

    return [toast, { show, dismiss }];
}