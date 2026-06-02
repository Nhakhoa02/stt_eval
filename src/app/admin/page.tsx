"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ShieldCheck, ShieldAlert, KeyRound, Loader2, Link2, 
  Trash2, Check, Copy, UserCheck, Play, Pause, Trash, 
  FileText, Download, CheckCircle, XCircle, Search, RefreshCw, BarChart2, Languages
} from 'lucide-react';
import { i18n, Language } from '@/lib/i18n';

interface AuthToken {
  id: string;
  token: string;
  role: 'student' | 'evaluator';
  label: string;
  created_at: string;
}

interface PendingRecord {
  id: string;
  word_text: string;
  audio_url: string;
  student_token: string;
  created_at: string;
}

interface ApprovedRecord {
  id: string;
  word_text: string;
  audio_url: string;
  student_token: string;
  created_at: string;
  transcripts: {
    moonshine: string;
    zipformer_2025: string;
    zipformer_30m: string;
    evaluators: { evaluator: string; text: string }[];
  };
}

export default function AdminPage() {
  // Auth states
  const [passcode, setPasscode] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [lang, setLang] = useState<Language>('vi');

  // Tab state: 'moderation' | 'analytics' | 'tokens'
  const [activeTab, setActiveTab] = useState<'moderation' | 'analytics' | 'tokens'>('moderation');

  // Token Generator states
  const [tokens, setTokens] = useState<AuthToken[]>([]);
  const [newTokenRole, setNewTokenRole] = useState<'student' | 'evaluator'>('student');
  const [newTokenLabel, setNewTokenLabel] = useState<string>('');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Moderation states
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [pendingLoading, setPendingLoading] = useState<boolean>(false);
  const [approvingIds, setApprovingIds] = useState<string[]>([]);
  const [decliningIds, setDecliningIds] = useState<string[]>([]);

  // Analytics states
  const [approvedRecords, setApprovedRecords] = useState<ApprovedRecord[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Audio playback controls
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check existing session
  useEffect(() => {
    const savedLang = localStorage.getItem('doraebin_lang') as Language;
    if (savedLang === 'vi' || savedLang === 'en') {
      setLang(savedLang);
    }
    
    const savedAdmin = localStorage.getItem('doraebin_admin');
    if (savedAdmin === 'true') {
      setIsAdmin(true);
      loadAdminData();
    }
  }, []);

  const toggleLang = () => {
    const next = lang === 'vi' ? 'en' : 'vi';
    setLang(next);
    localStorage.setItem('doraebin_lang', next);
  };

  const t = i18n[lang];

  // Load all tables on login
  const loadAdminData = () => {
    loadTokens();
    loadPendingRecords();
    loadAnalytics();
  };

  // 1. Admin login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    
    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAdmin(true);
        localStorage.setItem('doraebin_admin', 'true');
        loadAdminData();
      } else {
        setLoginError(data.error || 'Mã xác thực không đúng.');
      }
    } catch (err) {
      setLoginError('Đã xảy ra lỗi kết nối đến server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('doraebin_admin');
  };

  // 2. Token access managers
  const loadTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('auth_tokens')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setTokens(data);
      }
    } catch (err) {
      console.error('Error loading tokens:', err);
    }
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      // Generate secure unique token prefix
      const prefix = newTokenRole === 'student' ? 'STU' : 'EVAL';
      const uniquePart = Math.random().toString(36).substring(2, 9).toUpperCase();
      const tokenString = `${prefix}-${uniquePart}`;
      
      const { error } = await supabase
        .from('auth_tokens')
        .insert({
          token: tokenString,
          role: newTokenRole,
          label: newTokenLabel.trim() || 'Học viên/Chuyên gia mới'
        });
        
      if (error) throw error;
      
      setNewTokenLabel('');
      loadTokens();
    } catch (err: any) {
      console.error('Error generating token:', err);
      alert('Không thể tạo token: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDeleteToken = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá liên kết này? Người dùng sẽ không thể truy cập nữa.')) return;
    
    try {
      const { error } = await supabase
        .from('auth_tokens')
        .delete().eq('id', id);
        
      if (error) throw error;
      loadTokens();
    } catch (err) {
      alert('Lỗi khi xoá token.');
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  // 3. Audio Pending Moderations
  const loadPendingRecords = async () => {
    setPendingLoading(true);
    try {
      const { data, error } = await supabase
        .from('audio_records')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        setPendingRecords(data);
      }
    } catch (err) {
      console.error('Error loading pending records:', err);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApprove = async (record: PendingRecord) => {
    setApprovingIds(prev => [...prev, record.id]);
    
    try {
      // A. Call the Next.js API route to download from Supabase, forward to Modal, and save model transcripts
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_record_id: record.id,
          audio_url: record.audio_url
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Inference engine failed.');
      }
      
      // B. Update the audio record status to approved
      const { error: updateError } = await supabase
        .from('audio_records')
        .update({ status: 'approved' })
        .eq('id', record.id);
        
      if (updateError) throw updateError;
      
      // C. Update list views
      setPendingRecords(prev => prev.filter(r => r.id !== record.id));
      loadAnalytics(); // Reload spreadsheet
      
    } catch (err: any) {
      console.error('Approval failed:', err);
      alert(`Duyệt ghi âm thất bại: ${err.message || 'Lỗi kết nối Modal STT.'}`);
    } finally {
      setApprovingIds(prev => prev.filter(id => id !== record.id));
    }
  };

  const handleDecline = async (id: string) => {
    if (!confirm('Từ chối bản thu âm này sẽ xoá hoàn toàn khỏi cơ sở dữ liệu. Bạn chắc chứ?')) return;
    
    setDecliningIds(prev => [...prev, id]);
    
    try {
      // Delete the record. CASCADE deletes associated transcripts automatically
      const { error } = await supabase
        .from('audio_records')
        .delete().eq('id', id);
        
      if (error) throw error;
      
      setPendingRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Không thể từ chối bản thu.');
    } finally {
      setDecliningIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá vĩnh viễn bản ghi âm và tất cả kết quả liên quan không?')) return;
    
    try {
      const { error } = await supabase
        .from('audio_records')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setApprovedRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Không thể xoá bản ghi âm.');
    }
  };

  // 4. Analytics and Spreadsheet Compile
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      // A. Fetch approved audio records
      const { data: recordsData, error: recordsError } = await supabase
        .from('audio_records')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
        
      if (recordsError) throw recordsError;
      if (!recordsData) return;
      
      // B. Fetch all transcripts associated with these approved records
      const { data: transcriptsData, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('*');
        
      if (transcriptsError) throw transcriptsError;
      
      // C. Map transcripts back to approved audios
      const compiled: ApprovedRecord[] = recordsData.map(record => {
        const related = transcriptsData?.filter(t => t.audio_record_id === record.id) || [];
        
        const moonshine = related.find(t => t.source === 'model:moonshine_base_vi_quantized')?.transcript_text || '';
        const zipformer_2025 = related.find(t => t.source === 'model:zipformer_vi_2025_04_20')?.transcript_text || '';
        const zipformer_30m = related.find(t => t.source === 'model:zipformer_vi_30m_2026_02_09')?.transcript_text || '';
        
        // Find evaluators (excluding model sources)
        const evaluators = related
          .filter(t => !t.source.startsWith('model:'))
          .map(t => ({
            evaluator: t.source.replace('evaluator:', ''),
            text: t.transcript_text
          }));
          
        return {
          ...record,
          transcripts: {
            moonshine,
            zipformer_2025,
            zipformer_30m,
            evaluators
          }
        };
      });
      
      setApprovedRecords(compiled);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Audio Playback handler
  const togglePlayAudio = (id: string, url: string) => {
    if (activePlayingId === id) {
      if (audioRef.current) audioRef.current.pause();
      setActivePlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      setActivePlayingId(id);
      audio.play();
      audio.onended = () => setActivePlayingId(null);
    }
  };

  // Helper to map user token to label (human name)
  const getUserLabel = (token: string) => {
    const tk = tokens.find(t => t.token === token);
    return tk ? tk.label : token;
  };

  // Dynamically extract all unique evaluators (merging active tokens and transcript sources)
  const activeEvaluatorTokens = tokens
    .filter(t => t.role === 'evaluator')
    .map(t => t.token);

  const transcriptEvaluators = approvedRecords.flatMap(r => 
    r.transcripts.evaluators.map(ev => ev.evaluator)
  );

  const allEvaluators = Array.from(
    new Set([...activeEvaluatorTokens, ...transcriptEvaluators])
  ).sort();

  // Export spreadsheet to Excel-compatible CSV format
  const handleExportCSV = () => {
    if (approvedRecords.length === 0) return;
    
    // Add UTF-8 BOM so Vietnamese characters load perfectly in Microsoft Excel!
    let csvContent = "\uFEFF";
    
    // Build CSV Headers: dynamically add evaluator columns
    const headers = ["Mã Ghi Âm", "Từ Gốc", "Moonshine Quantized", "Zipformer Vi (2025)", "Zipformer Vi (30M)"];
    allEvaluators.forEach(ev => {
      const label = getUserLabel(ev);
      headers.push(`"${label.replace(/"/g, '""')}"`);
    });
    csvContent += headers.join(",") + "\n";
    
    approvedRecords.forEach(r => {
      const row = [
        r.id,
        `"${r.word_text.replace(/"/g, '""')}"`,
        `"${r.transcripts.moonshine.replace(/"/g, '""')}"`,
        `"${r.transcripts.zipformer_2025.replace(/"/g, '""')}"`,
        `"${r.transcripts.zipformer_30m.replace(/"/g, '""')}"`
      ];
      
      // Dynamic columns for human evaluators
      allEvaluators.forEach(ev => {
        const transcript = r.transcripts.evaluators.find(e => e.evaluator === ev);
        const text = transcript ? transcript.text : "";
        row.push(`"${text.replace(/"/g, '""')}"`);
      });
      
      csvContent += row.join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Doraebin_STT_Evaluation_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter compiled analytic records based on search query
  const filteredAnalytics = approvedRecords.filter(r => 
    r.word_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.transcripts.moonshine.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.transcripts.zipformer_2025.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.transcripts.zipformer_30m.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.transcripts.evaluators.some(ev => ev.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // -------------------------------------------------------------
  // RENDER: PASSWORD GATING ACCESS
  // -------------------------------------------------------------
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative">
        {/* Floating Language Switcher */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-855 hover:border-slate-800 rounded-xl text-xs font-bold text-slate-350 hover:text-slate-200 transition cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            {lang === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
          </button>
        </div>

        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>

          <div className="flex flex-col items-center text-center gap-3 mb-8">
            <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">{t.admin.loginTitle}</h1>
            <p className="text-slate-400 text-xs">{t.admin.loginSub}</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <input
                type="password"
                placeholder={t.admin.loginPlaceholder}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-650 focus:outline-none transition"
              />
              {loginError && <p className="text-rose-450 text-xs font-semibold mt-2">{loginError}</p>}
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition duration-200 cursor-pointer"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.admin.authenticate}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: MAIN ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header bar */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-900 py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">Doraebin Admin Dashboard</h1>
            <p className="text-xs text-slate-400">{t.common.status}: <span className="text-emerald-400 font-semibold">{t.common.activeSession}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Language Toggle Selector */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-955/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl text-xs font-bold text-slate-350 hover:text-slate-200 transition cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            {lang === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
          </button>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition text-sm cursor-pointer"
          >
            {t.common.logout}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-slate-950 border-b border-slate-900 sticky top-[73px] z-40 px-6 py-2">
        <div className="max-w-5xl mx-auto flex gap-2">
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'moderation'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {t.admin.tabModeration} ({pendingRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {t.admin.tabAnalytics} ({approvedRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'tokens'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {t.admin.tabTokens} ({tokens.length})
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">

        {/* -------------------------------------------------------------
            TAB: MODERATION QUEUE
            ------------------------------------------------------------- */}
        {activeTab === 'moderation' && (
          <section className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
              <div>
                <h2 className="text-xl font-bold text-slate-100">{t.admin.moderationTitle}</h2>
                <p className="text-xs text-slate-400">{t.admin.moderationSub}</p>
              </div>
              <button 
                onClick={loadPendingRecords} 
                className="p-2 text-slate-450 hover:text-slate-250 hover:bg-slate-900 rounded-lg transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {pendingLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-slate-400">{lang === 'en' ? 'Loading pending records...' : 'Đang tải danh sách chờ duyệt...'}</p>
              </div>
            ) : pendingRecords.length === 0 ? (
              <div className="py-20 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-slate-900/10">
                <CheckCircle className="w-12 h-12 text-slate-700 stroke-1 mb-3" />
                <p className="text-sm text-slate-500">{t.admin.noPending}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRecords.map((record) => {
                  const isApproving = approvingIds.includes(record.id);
                  const isDeclining = decliningIds.includes(record.id);
                  const isDisabled = isApproving || isDeclining;
                  
                  return (
                    <div 
                      key={record.id}
                      className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5 flex flex-col gap-4 shadow-lg hover:border-slate-800 transition"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <span className="text-xs text-indigo-400 uppercase font-semibold">{t.admin.studentText}</span>
                          <h4 className="text-lg font-extrabold capitalize text-slate-100 truncate">{record.word_text}</h4>
                        </div>
                        
                        {/* Inline Audio Player */}
                        <button
                          onClick={() => togglePlayAudio(record.id, record.audio_url)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border transition cursor-pointer ${
                            activePlayingId === record.id
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                              : 'bg-slate-850 border-slate-800 text-slate-350 hover:bg-slate-800'
                          }`}
                        >
                          {activePlayingId === record.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-950/40 p-2 rounded-xl border border-slate-950">
                        <span>{t.admin.studentLabel} <strong className="text-slate-300">{getUserLabel(record.student_token)}</strong></span>
                        <span>{new Date(record.created_at).toLocaleTimeString(lang === 'en' ? 'en-US' : 'vi-VN')}</span>
                      </div>

                      {/* Approval triggers */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(record)}
                          disabled={isDisabled}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                        >
                          {isApproving ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              {t.admin.approving}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t.admin.approveCallAI}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDecline(record.id)}
                          disabled={isDisabled}
                          className="px-3 py-2 bg-slate-850 hover:bg-rose-900/20 hover:border-rose-900/30 border border-slate-800 text-rose-400 font-semibold rounded-xl text-xs flex items-center justify-center gap-1 transition disabled:opacity-50 cursor-pointer"
                        >
                          {isDeclining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          {t.admin.decline}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* -------------------------------------------------------------
            TAB: ANALYTICS & SPREADSHEETS
            ------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-900">
              <div>
                <h2 className="text-xl font-bold text-slate-100">{t.admin.analyticsTitle}</h2>
                <p className="text-xs text-slate-400">{t.admin.analyticsSub}</p>
              </div>
              
              <div className="flex w-full sm:w-auto items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={approvedRecords.length === 0}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.admin.exportCSV}
                </button>
                <button 
                  onClick={loadAnalytics} 
                  className="p-2 text-slate-450 hover:text-slate-250 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Searchbar */}
            <div className="flex items-center gap-2 bg-slate-900/40 border border-slate-850 px-3 py-2 rounded-xl">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={t.admin.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>

            {analyticsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-slate-400">{lang === 'en' ? 'Synchronizing records...' : 'Đang đồng bộ dữ liệu...'}</p>
              </div>
            ) : filteredAnalytics.length === 0 ? (
              <div className="py-20 border border-dashed border-slate-800 rounded-3xl text-center p-8 bg-slate-900/10 text-slate-500">
                {t.admin.noAnalytics}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-850 rounded-2xl shadow-xl bg-slate-900/20 backdrop-blur-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-850 text-slate-350 font-bold uppercase tracking-wider">
                      <th className="p-4">{t.admin.thAudio}</th>
                      <th className="p-4">{t.admin.thWord}</th>
                      <th className="p-4 text-indigo-300">{t.admin.thMoonshine}</th>
                      <th className="p-4 text-indigo-300">{t.admin.thZipformer2025}</th>
                      <th className="p-4 text-indigo-300">{t.admin.thZipformer30M}</th>
                      {allEvaluators.map(ev => (
                        <th key={ev} className="p-4 text-emerald-350">
                          <div className="flex flex-col">
                            <span className="font-bold">{getUserLabel(ev)}</span>
                            <span className="text-[9px] text-slate-500 font-mono font-normal normal-case">{ev}</span>
                          </div>
                        </th>
                      ))}
                      <th className="p-4 text-rose-450 text-center">{t.admin.thDelete}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredAnalytics.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-900/20 transition">
                        <td className="p-4">
                          <button
                            onClick={() => togglePlayAudio(record.id, record.audio_url)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition ${
                              activePlayingId === record.id
                                ? 'bg-indigo-500/20 border-indigo-500/35 text-indigo-400'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {activePlayingId === record.id ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                          </button>
                        </td>
                        <td className="p-4 font-extrabold capitalize text-slate-100">{record.word_text}</td>
                        <td className="p-4 font-mono text-indigo-400">{record.transcripts.moonshine || '—'}</td>
                        <td className="p-4 font-mono text-indigo-450 uppercase">{record.transcripts.zipformer_2025 || '—'}</td>
                        <td className="p-4 font-mono text-indigo-450 uppercase">{record.transcripts.zipformer_30m || '—'}</td>
                        {allEvaluators.map(ev => {
                          const transcript = record.transcripts.evaluators.find(e => e.evaluator === ev);
                          return (
                            <td key={ev} className="p-4 font-mono text-emerald-400 lowercase">
                              {transcript ? transcript.text : <span className="text-slate-750 italic">{t.admin.notEvaluated}</span>}
                            </td>
                          );
                        })}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="inline-flex w-7 h-7 rounded-lg items-center justify-center border border-slate-800 bg-slate-950 hover:bg-rose-950/20 hover:border-rose-950/30 text-rose-400 transition"
                            title="Xoá vĩnh viễn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* -------------------------------------------------------------
            TAB: AUTH ACCESS TOKEN GENERATOR
            ------------------------------------------------------------- */}
        {activeTab === 'tokens' && (
          <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Left: Generator Form */}
            <div className="md:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-4">
                  <Link2 className="w-4 h-4 text-indigo-400" />
                  {t.admin.tokenTitle}
                </h3>
                
                <form onSubmit={handleGenerateToken} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">{t.admin.tokenRole}</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900">
                      <button
                        type="button"
                        onClick={() => setNewTokenRole('student')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                          newTokenRole === 'student'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-450 hover:text-slate-250'
                        }`}
                      >
                        {t.common.student}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTokenRole('evaluator')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                          newTokenRole === 'evaluator'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-450 hover:text-slate-250'
                        }`}
                      >
                        {t.common.evaluator}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">{t.admin.tokenLabel}</label>
                    <input
                      type="text"
                      placeholder={t.admin.tokenPlaceholder}
                      value={newTokenLabel}
                      onChange={(e) => setNewTokenLabel(e.target.value)}
                      className="bg-slate-950/80 border border-slate-850 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    {t.admin.createLink}
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Tokens Grid list */}
            <div className="md:col-span-8 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200">{t.admin.tokenSub}</h3>
              <div className="flex flex-col gap-3">
                {tokens.length === 0 ? (
                  <div className="py-12 border border-slate-850 rounded-2xl text-center text-slate-500 text-xs">
                    {t.admin.noTokens}
                  </div>
                ) : (
                  tokens.map((tk) => {
                    const hostUrl = typeof window !== 'undefined' ? window.location.origin : '';
                    const joinLink = `${hostUrl}/join?token=${tk.token}`;
                    const isCopied = copiedTokenId === tk.id;
                    
                    return (
                      <div 
                        key={tk.id}
                        className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tk.role === 'student'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            }`}>
                              {tk.role === 'student' ? t.common.student : t.common.evaluator}
                            </span>
                            <span className="text-xs text-slate-200 font-bold truncate">{tk.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono select-all truncate">{joinLink}</p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => copyToClipboard(tk.id, joinLink)}
                            className={`flex items-center justify-center gap-1 px-3 py-1.5 border rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                                : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? t.admin.copied : t.admin.copyLink}
                          </button>
                          <button
                            onClick={() => handleDeleteToken(tk.id)}
                            className="p-1.5 bg-slate-950 border border-slate-850 hover:bg-rose-950/20 hover:border-rose-950/30 text-rose-400 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </section>
        )}

      </main>
    </div>
  );
}
