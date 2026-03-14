import React, { useState, useEffect } from 'react';
import { Dropzone } from './components/Dropzone';
import { MetadataViewer } from './components/MetadataViewer';
import { analyzeFile, FileAnalysis } from './utils/metadata';
import { FileImage, Loader2, RefreshCw, AlertCircle, Info, FileJson, FileText, File as FileIcon, Music, Film, Trash2 } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileAccepted = async (acceptedFile: File) => {
    setFile(acceptedFile);
    setError(null);
    setAnalysis(null);
    setIsLoading(true);

    // Create preview if it's an image, video, or audio
    if (acceptedFile.type.startsWith('image/') || acceptedFile.type.startsWith('video/') || acceptedFile.type.startsWith('audio/')) {
      const objectUrl = URL.createObjectURL(acceptedFile);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }

    try {
      const result = await analyzeFile(acceptedFile);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "Failed to analyze file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDestroy = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAnalysis(null);
    setError(null);
    
    // Clear any potential browser storage
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach(name => caches.delete(name));
        });
      }
    } catch (e) {
      console.warn("Failed to clear some storage", e);
    }
  };

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const getFileIcon = (type: string) => {
    if (type.includes('Image')) return <FileImage className="w-12 h-12 text-indigo-400" />;
    if (type.includes('Video')) return <Film className="w-12 h-12 text-rose-400" />;
    if (type.includes('Audio')) return <Music className="w-12 h-12 text-emerald-400" />;
    if (type.includes('JSON')) return <FileJson className="w-12 h-12 text-amber-400" />;
    if (type.includes('Text')) return <FileText className="w-12 h-12 text-zinc-400" />;
    return <FileIcon className="w-12 h-12 text-zinc-500" />;
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans p-4 md:p-6 flex flex-col">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col min-h-0 gap-4 md:gap-6">
        
        <header className="shrink-0 flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl shadow-sm border border-indigo-500/30">
              <FileImage className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">ComfyUI Inspector</h1>
              <p className="text-zinc-400 text-sm">Extract and view metadata locally. 100% private.</p>
            </div>
          </div>
          {file && (
            <button
              onClick={handleDestroy}
              className="flex items-center gap-2 py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-colors border border-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Destroy File & Traces</span>
            </button>
          )}
        </header>

        {!file ? (
          <div className="flex-1 bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-800 flex flex-col items-center justify-center min-h-0">
            <div className="w-full max-w-2xl">
              <Dropzone onFileAccepted={handleFileAccepted} />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-1 flex flex-col min-h-0">
              <div className="bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-800 flex flex-col min-h-0 h-full">
                
                {previewUrl ? (
                  <div className="flex-1 min-h-0 w-full rounded-xl overflow-hidden bg-zinc-950 mb-5 border border-zinc-800 flex items-center justify-center">
                    {file.type.startsWith('video/') ? (
                      <video 
                        src={previewUrl} 
                        controls 
                        className="w-full h-full object-contain"
                      />
                    ) : file.type.startsWith('audio/') ? (
                      <div className="flex flex-col items-center justify-center w-full h-full p-4 bg-zinc-900">
                        <Music className="w-16 h-16 text-zinc-700 mb-6" />
                        <audio src={previewUrl} controls className="w-full" />
                      </div>
                    ) : (
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 w-full rounded-xl bg-zinc-950 mb-5 border border-zinc-800 flex items-center justify-center">
                    {analysis ? getFileIcon(analysis.fileType) : <FileIcon className="w-12 h-12 text-zinc-700" />}
                  </div>
                )}

                <div className="shrink-0 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Detected File Type</h3>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium text-sm">
                      <Info className="w-4 h-4" />
                      {analysis?.fileType || 'Analyzing...'}
                    </div>
                  </div>

                  {analysis?.basicInfo && (
                    <div className="overflow-hidden">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Basic Info</h3>
                      <div className="space-y-2 text-sm">
                        {Object.entries(analysis.basicInfo).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-zinc-400 whitespace-nowrap">{k}:</span>
                            <span className="font-medium text-zinc-200 truncate ml-2" title={String(v)}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col min-h-0">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-zinc-400 font-medium">Analyzing file...</p>
                </div>
              ) : error ? (
                <div className="bg-red-950/30 text-red-400 p-6 rounded-2xl border border-red-900/50 flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-300 mb-1">Error</h3>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              ) : analysis ? (
                <MetadataViewer file={file} analysis={analysis} />
              ) : null}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
