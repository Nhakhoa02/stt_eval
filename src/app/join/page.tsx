"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setStatus('error');
        setErrorMsg('Không tìm thấy mã truy cập (token) trong liên kết.');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('auth_tokens')
          .select('token, role, label')
          .eq('token', token)
          .single();

        if (error || !data) {
          setStatus('error');
          setErrorMsg('Liên kết truy cập này không hợp lệ hoặc đã hết hạn.');
          return;
        }

        // Save session credentials in localStorage
        localStorage.setItem('doraebin_token', data.token);
        localStorage.setItem('doraebin_role', data.role);
        localStorage.setItem('doraebin_label', data.label || '');

        setStatus('success');
        
        // Redirect to appropriate dashboard based on token role
        setTimeout(() => {
          if (data.role === 'student') {
            router.push('/student');
          } else if (data.role === 'evaluator') {
            router.push('/evaluator');
          }
        }, 1500);

      } catch (err) {
        setStatus('error');
        setErrorMsg('Đã xảy ra lỗi hệ thống trong quá trình xác thực.');
      }
    }

    validateToken();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Decorative Backdrop Glows */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
            <h2 className="text-xl font-semibold text-slate-100">Xác thực liên kết truy cập</h2>
            <p className="text-slate-400 text-sm">Vui lòng chờ trong khi hệ thống xác thực thông tin...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Xác thực thành công!</h2>
            <p className="text-emerald-400 text-sm font-medium">Đang chuyển hướng đến bảng điều khiển...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Lỗi xác thực</h2>
            <p className="text-rose-400 text-sm font-medium">{errorMsg}</p>
            <p className="text-slate-400 text-xs mt-2">
              Vui lòng liên hệ với Quản trị viên để nhận liên kết truy cập mới.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
          <h2 className="text-xl font-semibold text-slate-100">Đang kết nối...</h2>
        </div>
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}
