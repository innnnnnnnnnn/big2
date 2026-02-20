"use client";

import { useAppSession } from "../../../hooks/useAppSession";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const SignInPage = () => {
    const [guestName, setGuestName] = useState("");
    const { login } = useAppSession();
    const router = useRouter();

    const handleGuestLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (guestName.trim()) {
            login(guestName);
            router.push("/lobby");
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1a1a1a] rounded-3xl p-8 border border-white/10 shadow-2xl">
                <h1 className="text-4xl font-black text-center mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                    神貓大老二
                </h1>
                <p className="text-white/60 text-center mb-10">Shenmao Big Two Online</p>

                <div className="space-y-4">
                    <form onSubmit={handleGuestLogin} className="pb-6 border-b border-white/5 mb-6">
                        <div className="text-white/40 text-sm mb-2 text-center">快速試玩 (訪客登入)</div>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                placeholder="輸入暱稱..."
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 text-white focus:border-yellow-500 outline-none"
                            />
                            <button
                                type="submit"
                                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
                            >
                                開始!
                            </button>
                        </div>
                    </form>

                </div>

                <div className="mt-12 text-center text-white/30 text-sm">
                    登入即表示您同意服務條款。
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
