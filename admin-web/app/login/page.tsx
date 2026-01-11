'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '../../services/supabase';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                alert('登入失敗: ' + error.message);
            } else {
                router.push('/');
                router.refresh();
            }
        } catch (err: any) {
            alert('發生錯誤: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-[#252525] p-8 rounded-xl shadow-2xl border-t-4 border-[#F1C40F]">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-[#F1C40F] tracking-wider mb-2">🚧 和芳工程行</h1>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">薪資管理系統 Admin Portal</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 text-sm font-bold mb-2 uppercase">Email / 帳號</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#333] border border-gray-600 rounded px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#F1C40F] focus:ring-1 focus:ring-[#F1C40F] transition-colors"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm font-bold mb-2 uppercase">Password / 密碼</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#333] border border-gray-600 rounded px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#F1C40F] focus:ring-1 focus:ring-[#F1C40F] transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#F1C40F] text-black font-black text-lg py-4 rounded hover:bg-[#D4AC0D] transition-colors shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
                    >
                        {loading ? 'Logging in...' : '登入 SYSTEM LOGIN'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-gray-600 text-xs">Only authorized personnel allowed.</p>
                </div>
            </div>
        </div>
    );
}
