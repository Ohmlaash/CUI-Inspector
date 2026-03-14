import React, { useCallback, useState } from 'react';
import { UploadCloud, ShieldCheck } from 'lucide-react';

interface DropzoneProps {
  onFileAccepted: (file: File) => void;
}

export function Dropzone({ onFileAccepted }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileAccepted(e.dataTransfer.files[0]);
      }
    },
    [onFileAccepted]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileAccepted(e.target.files[0]);
      }
    },
    [onFileAccepted]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center w-full h-72 border-2 border-dashed rounded-xl transition-colors ${
        isDragActive
          ? 'border-indigo-500 bg-indigo-500/10'
          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
      }`}
    >
      <input
        type="file"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
      <p className="text-sm font-medium text-zinc-300">
        {isDragActive ? 'Drop the file here' : 'Drag & drop any file, or click to select'}
      </p>
      <p className="text-xs text-zinc-500 mt-2">Supports Images, Video, Audio, JSON, and Text</p>
      
      <div className="absolute bottom-6 flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-4 py-2 rounded-full shadow-sm">
        <ShieldCheck className="w-4 h-4" />
        <span>100% Local & Ephemeral: No data is stored</span>
      </div>
    </div>
  );
}
