"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mic, Volume2, ShieldCheck, ChevronRight, Lock, KeyRound, Sparkles } from 'lucide-react';

export default function HomePage() {
  const [session, setSession] = useState<{ role: string; label: string } | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('doraebin_token');
    const savedRole = localStorage.getItem('doraebin_role');
    const savedLabel = localStorage.getItem('doraebin_label');

    if (savedToken && savedRole) {
      setSession({
        role: savedRole,
        label: savedLabel || 'Thành viên'
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 relative overflow-hidden font-sans">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse delay-75"></div>

      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
            <Mic className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-sm font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent tracking-tight">Doraebin Voice Lab</span>
        </div>
        
        <Link 
          href="/admin" 
          className="p-2 border border-slate-900 rounded-xl hover:bg-slate-900/60 hover:border-slate-800 text-slate-400 hover:text-slate-200 transition"
        >
          <Lock className="w-4 h-4" />
        </Link>
      </header>

      {/* Main Showcase Hero */}
      <main className="max-w-md w-full mx-auto flex flex-col items-center justify-center gap-8 py-20 z-10">
        
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10 border border-slate-800 rounded-3xl flex items-center justify-center shadow-2xl relative">
            <div className="absolute inset-0 bg-indigo-500/5 rounded-3xl blur-md"></div>
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-350 bg-clip-text text-transparent">
            Doraebin Voice Lab
          </h1>
          <p className="text-sm text-slate-450 leading-relaxed max-w-sm">
            Nền tảng nghiên cứu, thu thập mẫu phát âm tiếng Việt và đánh giá độ chính xác của các mô hình nhận dạng giọng nói tự động.
          </p>
        </div>

        {/* Dynamic Card Container */}
        <div className="w-full bg-slate-900/40 backdrop-blur-xl border border-slate-850 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
          {session ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-2xl">
                <p className="text-xs text-slate-400">Chào mừng quay trở lại,</p>
                <p className="text-sm text-emerald-400 font-extrabold mt-0.5">{session.label}</p>
              </div>

              {session.role === 'student' ? (
                <Link
                  href="/student"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition duration-200"
                >
                  <Mic className="w-4 h-4" />
                  Vào Phòng Thu Âm
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  href="/evaluator"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition duration-200"
                >
                  <Volume2 className="w-4 h-4" />
                  Vào Bàn Thẩm Định
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
              
              <button 
                onClick={() => {
                  localStorage.clear();
                  setSession(null);
                }}
                className="text-[11px] text-slate-500 hover:text-slate-350 transition underline underline-offset-4 mt-1"
              >
                Đăng xuất tài khoản hiện tại
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex gap-3 items-start bg-slate-950/60 p-4 border border-slate-950 rounded-2xl">
                <KeyRound className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <h4 className="text-xs font-bold text-slate-200">Yêu cầu mã xác thực</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Vui lòng nhấp vào **Liên kết truy cập (Join Link)** do giáo viên hoặc Quản trị viên cấp để đăng nhập hệ thống tự động.
                  </p>
                </div>
              </div>

              <Link
                href="/admin"
                className="w-full py-3 bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 font-bold rounded-2xl flex items-center justify-center gap-1.5 transition text-xs"
              >
                Quản trị viên Đăng nhập
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Footer credits */}
      <footer className="max-w-5xl w-full mx-auto text-center py-4 z-10">
        <p className="text-[10px] text-slate-650">© 2026 Doraebin Voice Lab. All rights reserved.</p>
      </footer>
    </div>
  );
}
