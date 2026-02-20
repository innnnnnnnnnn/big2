"use client";

import { useEffect, useState } from "react";

export interface AppUser {
    id: string;
    name: string;
}

export const useAppSession = () => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

    useEffect(() => {
        const stored = localStorage.getItem("big2_user");
        if (stored) {
            try {
                setUser(JSON.parse(stored));
                setStatus("authenticated");
            } catch (e) {
                setStatus("unauthenticated");
            }
        } else {
            setStatus("unauthenticated");
        }
    }, []);

    const login = (name: string) => {
        const newUser = { id: `user_${Math.random().toString(36).substr(2, 9)}`, name };
        localStorage.setItem("big2_user", JSON.stringify(newUser));
        setUser(newUser);
        setStatus("authenticated");
    };

    const logout = () => {
        localStorage.removeItem("big2_user");
        setUser(null);
        setStatus("authenticated"); // Re-trigger effect or just set unauthenticated
        window.location.href = "/big2/auth/signin"; // Force redirect
    };

    return { session: user ? { user } : null, status, login, logout };
};
