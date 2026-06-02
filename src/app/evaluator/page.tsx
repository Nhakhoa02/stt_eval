"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Play, Pause, Send, CheckCircle, ListTodo, LogOut, 
  ChevronRight, Volume2, ShieldAlert, Loader2, Sparkles 
} from 'lucide-react';

interface AudioRecord {
  id: string;
  audio_url: string;
  created_at: string;
}

export default function EvaluatorPage() {
  const router = useRouter();
  
  // Auth states
  const [token, setToken] = useState<string | null>(null);
  const [label, setLabel] = useState<string>('');
  const [authorized, setAuthorized] = useState<boolean>(false);
  
  // App states
  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [transcriptsMap, setTranscriptsMap] = useState<Record<string, string>>({});
  const [submittingIds, setSubmittingIds] = useState<string[]>([]);
  const [successId, setSuccessId] = useState<string | null>(null);
  
  // Audio playback controls
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Session verification
  useEffect(() => {
    const savedToken = localStorage.getItem('doraebin_token');
    const savedRole = localStorage.getItem('doraebin_role');
    const savedLabel = localStorage.getItem('doraebin_label');

    if (!savedToken || savedRole !== 'evaluator') {
      router.push('/join');
      return;
    }

    setToken(savedToken);
    setLabel(savedLabel || '');
    setAuthorized(true);
    
    // Fetch pending approved records to evaluate
    loadApprovedRecords(savedToken);
  }, [router]);

  // 2. Fetch approved audios not yet evaluated by this user
  const loadApprovedRecords = async (evaluatorToken: string) => {
    setLoading(true);
    try {
      // Step A: Fetch records already evaluated by this evaluator to filter them out
      const { data: evaluatedData, error: evaluatedError } = await supabase
        .from('transcripts')
        .select('audio_record_id')
        .eq('source', `evaluator:${evaluatorToken}`);
        
      if (evaluatedError) throw evaluatedError;
      
      const evaluatedIds = evaluatedData?.map(item => item.audio_record_id) || [];
      
      // Step B: Fetch audio records with status 'approved' that are not in evaluatedIds
      let query = supabase
        .from('audio_records')
        .select('id, audio_url, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
        
      if (evaluatedIds.length > 0) {
        // filter out evaluated files
        query = query.not('id', 'in', `(${evaluatedIds.join(',')})`);
      }
      
      const { data: recordsData, error: recordsError } = await query;
      
      if (recordsError) throw recordsError;
      
      setRecords(recordsData || []);
    } catch (err) {
      console.error('Error loading approved records:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Audio playing triggers
  const togglePlayAudio = (record: AudioRecord) => {
    if (activePlayingId === record.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setActivePlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(record.audio_url);
      audioRef.current = audio;
      setActivePlayingId(record.id);
      
      audio.play();
      audio.onended = () => {
        setActivePlayingId(null);
      };
    }
  };

  // Keep track of typed transcription guesses
  const handleTextChange = (id: string, text: string) => {
    setTranscriptsMap(prev => ({
      ...prev,
      [id]: text
    }));
  };

  // 4. Submit an individual evaluation
  const handleSubmitSingle = async (recordId: string) => {
    const text = transcriptsMap[recordId]?.trim();
    if (!text || !token) return;
    
    setSubmittingIds(prev => [...prev, recordId]);
    
    try {
      // Insert transcript row
      const { error } = await supabase
        .from('transcripts')
        .insert({
          audio_record_id: recordId,
          source: `evaluator:${token}`,
          transcript_text: text.toLowerCase() // Normalise text
        });
        
      if (error) throw error;
      
      // Clean local text value
      setTranscriptsMap(prev => {
        const copy = { ...prev };
        delete copy[recordId];
        return copy;
      });
      
      // Trigger success animation
      setSuccessId(recordId);
      setTimeout(() => {
        setSuccessId(null);
        // Remove from current evaluation view queue
        setRecords(prev => prev.filter(r => r.id !== recordId));
      }, 1000);
      
    } catch (err) {
      console.error('Submit error:', err);
      alert('Không thể lưu kết quả thẩm định. Vui lòng kiểm tra lại kết nối.');
    } finally {
      setSubmittingIds(prev => prev.filter(id => id !== recordId));
    }
  };

  // 5. Submit all transcribed files in one batch
  const handleSubmitAll = async () => {
    if (!token) return;
    
    // Find all records that have transcription text entered
    const transcribedRecords = records.filter(r => transcriptsMap[r.id]?.trim());
    if (transcribedRecords.length === 0) return;
    
    const recordIds = transcribedRecords.map(r => r.id);
    setSubmittingIds(prev => [...prev, ...recordIds]);
    
    try {
      const inserts = transcribedRecords.map(r => ({
        audio_record_id: r.id,
        source: `evaluator:${token}`,
        transcript_text: transcriptsMap[r.id].trim().toLowerCase()
      }));
      
      const { error } = await supabase
        .from('transcripts')
        .insert(inserts);
        
      if (error) throw error;
      
      // Clear transcript local state for successfully submitted items
      setTranscriptsMap(prev => {
        const copy = { ...prev };
        recordIds.forEach(id => delete copy[id]);
        return copy;
      });
      
      alert(`Đã gửi thành công ${transcribedRecords.length} kết quả thẩm định!`);
      // Reload queue
      loadApprovedRecords(token);
      
    } catch (err) {
      console.error('Batch submit error:', err);
      alert('Đã xảy ra lỗi khi gửi hàng loạt kết quả thẩm định.');
    } finally {
      setSubmittingIds(prev => prev.filter(id => !recordIds.includes(id)));
    }
  };

  // Logout session
  const handleLogout = () => {
    localStorage.removeItem('doraebin_token');
    localStorage.removeItem('doraebin_role');
    localStorage.removeItem('doraebin_label');
    router.push('/join');
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header bar */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-900 py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">Doraebin Auditing Deck</h1>
            <p className="text-xs text-slate-400">Chuyên viên thẩm định: <span className="text-emerald-400 font-semibold">{label || token}</span></p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition text-sm"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
        
        {/* Blind instruction banner */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-indigo-950/40 border border-slate-800 rounded-2xl p-4 flex gap-4 items-start shadow-xl">
          <Sparkles className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-200">Nguyên tắc Thẩm định Mù (Blind Auditing)</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Để đảm bảo khách quan, bạn sẽ nghe âm thanh thu âm từ sinh viên mà **không biết từ gốc cần đọc** hay **kết quả nhận dạng của các mô hình**. Hãy nghe kỹ và gõ chính xác các từ tiếng Việt mà bạn nghe được vào ô trống.
            </p>
          </div>
        </div>

        {/* Global queue header and Batch Submit */}
        <div className="flex justify-between items-center bg-slate-900/20 p-3 rounded-2xl border border-slate-900">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Hàng chờ thẩm định:</span>
            <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full">{records.length}</span>
          </div>
          
          {records.some(r => transcriptsMap[r.id]?.trim()) && (
            <button
              onClick={handleSubmitAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg hover:shadow-indigo-600/25"
            >
              <Send className="w-3 h-3" />
              Gửi tất cả bài đã gõ
            </button>
          )}
        </div>

        {/* Dynamic Auditing Queue list */}
        <section className="flex flex-col gap-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              <p className="text-sm text-slate-400">Đang tải danh sách bản thu âm approved...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-20 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-slate-900/10">
              <CheckCircle className="w-16 h-16 text-slate-800 stroke-1 mb-4" />
              <h3 className="text-lg font-bold text-slate-400">Hoàn tất xuất sắc!</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Hiện tại không còn bản thu âm nào đã được duyệt cần thẩm định. Hãy quay lại sau khi Admin duyệt các bản thu âm mới!
              </p>
            </div>
          ) : (
            records.map((record) => {
              const isSubmitting = submittingIds.includes(record.id);
              const isSuccess = successId === record.id;
              const hasText = !!transcriptsMap[record.id]?.trim();
              
              return (
                <div 
                  key={record.id}
                  className={`bg-slate-900/40 backdrop-blur-xl border rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row gap-5 items-center justify-between shadow-lg transition duration-300 ${
                    isSuccess 
                      ? 'border-emerald-500/40 bg-emerald-950/5' 
                      : 'border-slate-850 hover:border-slate-800'
                  }`}
                >
                  {/* Left segment: Audio Player */}
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button
                      onClick={() => togglePlayAudio(record)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition ${
                        activePlayingId === record.id
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                          : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {activePlayingId === record.id ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Ghi âm nhãn #{record.id.substring(0, 8)}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Ngày thu: {new Date(record.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>

                  {/* Right segment: Transcription Form */}
                  <div className="flex-1 w-full flex flex-col sm:flex-row gap-3 items-center">
                    <input
                      type="text"
                      placeholder="Gõ các từ bạn nghe được ở đây..."
                      disabled={isSubmitting || isSuccess}
                      value={transcriptsMap[record.id] || ''}
                      onChange={(e) => handleTextChange(record.id, e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-550 focus:outline-none focus:border-indigo-500 transition disabled:opacity-50"
                    />
                    
                    {isSuccess ? (
                      <div className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-1.5 text-emerald-400 text-sm font-bold animate-bounce">
                        <CheckCircle className="w-4 h-4" />
                        Đã gửi
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSubmitSingle(record.id)}
                        disabled={!hasText || isSubmitting}
                        className={`w-full sm:w-auto px-5 py-2.5 font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-sm ${
                          hasText 
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer' 
                            : 'bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        Gửi
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
