import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Explicitly define the server-side runtime
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { audio_record_id, audio_url } = await request.json();

    if (!audio_record_id || !audio_url) {
      return NextResponse.json(
        { error: 'Missing audio_record_id or audio_url parameters.' },
        { status: 400 }
      );
    }

    // 1. Download the audio file from its public Supabase Storage URL
    // console.log(`Downloading audio file from URL: ${audio_url}...`);
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio file from Supabase Storage: ${audioResponse.statusText}`);
    }
    const audioBlob = await audioResponse.blob();

    // 2. Build the FormData payload for the Modal STT endpoint
    const formData = new FormData();
    // Modal expects the field name 'files' and a valid audio file blob
    formData.append('files', audioBlob, 'audio.webm');

    const modalSTTUrl = process.env.MODAL_STT_URL || 'https://nhakhoa02--doraebin-stt-sttservice-transcribe.modal.run';
    // console.log(`Forwarding audio data to Modal STT service at: ${modalSTTUrl}...`);
    
    // 3. Make the API request to Modal STT
    const modalResponse = await fetch(modalSTTUrl, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type header manually; fetch will automatically build it with the boundary!
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text();
      throw new Error(`Modal STT service returned an error (${modalResponse.status}): ${errorText}`);
    }

    const sttResult = await modalResponse.json();
    // console.log('STT prediction retrieved successfully:', JSON.stringify(sttResult));

    // Extract the translations of the first result file
    const fileResult = sttResult?.results?.[0];
    if (!fileResult || fileResult.error) {
      throw new Error(fileResult?.error || 'Modal returned an empty or invalid transcription result.');
    }

    const transcripts = fileResult.transcripts;
    
    // 4. Batch insert predictions for all three models into the Supabase transcripts table
    const modelTranscriptsInserts = [
      {
        audio_record_id,
        source: 'model:moonshine_base_vi_quantized',
        transcript_text: (transcripts.moonshine_base_vi_quantized || '').trim().toLowerCase()
      },
      {
        audio_record_id,
        source: 'model:zipformer_vi_2025_04_20',
        transcript_text: (transcripts.zipformer_vi_2025_04_20 || '').trim().toLowerCase()
      },
      {
        audio_record_id,
        source: 'model:zipformer_vi_30m_2026_02_09',
        transcript_text: (transcripts.zipformer_vi_30m_2026_02_09 || '').trim().toLowerCase()
      }
    ];

    // console.log(`Inserting ${modelTranscriptsInserts.length} model predictions into transcripts table...`);
    const { error: insertError } = await supabase
      .from('transcripts')
      .insert(modelTranscriptsInserts);

    if (insertError) {
      throw insertError;
    }

    // console.log('Transcription pipeline completed successfully!');
    return NextResponse.json({
      success: true,
      transcripts: transcripts
    });

  } catch (err: any) {
    console.error('Transcription API handler failed:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred during transcription.' },
      { status: 500 }
    );
  }
}
