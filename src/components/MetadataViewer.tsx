import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Copy, Check, Download, Layers, FileJson, Info, Box } from 'lucide-react';
import { ImageMetadata, FileAnalysis } from '../utils/metadata';

interface MetadataViewerProps {
  file: File;
  analysis: FileAnalysis;
}

export function MetadataViewer({ file, analysis }: MetadataViewerProps) {
  const metadata = analysis.metadata;
  const isComfyUI = metadata.workflow || metadata.prompt;
  const [activeTab, setActiveTab] = useState<'info' | 'nodes' | 'models' | 'raw'>('info');

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="shrink-0 mb-4">
        {isComfyUI ? (
          <div className="flex items-center gap-3 p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <h3 className="font-semibold text-emerald-300">ComfyUI Workflow Detected</h3>
              <p className="text-sm text-emerald-500">This file contains embedded workflow data.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-amber-950/30 border border-amber-900/50 rounded-xl text-amber-400">
            <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-300">No ComfyUI Workflow</h3>
              <p className="text-sm text-amber-500">Standard metadata shown below.</p>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center bg-zinc-900 p-1.5 rounded-xl border border-zinc-800 mb-4 overflow-x-auto custom-scrollbar">
        <div className="flex space-x-1">
          <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')} icon={<Info className="w-4 h-4"/>} label="File Info" />
          {isComfyUI && (
            <>
              <TabButton active={activeTab === 'nodes'} onClick={() => setActiveTab('nodes')} icon={<Layers className="w-4 h-4"/>} label="Node Settings" />
              <TabButton active={activeTab === 'models'} onClick={() => setActiveTab('models')} icon={<Box className="w-4 h-4"/>} label="Models/LoRas" />
            </>
          )}
          <TabButton active={activeTab === 'raw'} onClick={() => setActiveTab('raw')} icon={<FileJson className="w-4 h-4"/>} label="ComfyUI Workflow" />
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col min-h-0">
        {activeTab === 'info' && <FileInfoViewer file={file} analysis={analysis} />}
        {activeTab === 'nodes' && isComfyUI && <NodeSettingsViewer metadata={metadata} />}
        {activeTab === 'models' && isComfyUI && <ModelsViewer metadata={metadata} />}
        {activeTab === 'raw' && <ComfyUIWorkflowViewer metadata={metadata} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
        active 
          ? 'bg-zinc-800 text-indigo-300 shadow-sm' 
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FileInfoViewer({ file, analysis }: { file: File, analysis: FileAnalysis }) {
  const getExpectedFields = (mimeType: string, detectedType: string) => {
    const base = ['File Name', 'File Size', 'MIME Type', 'Last Modified', 'Detected Type'];
    
    if (mimeType.startsWith('image/png') || detectedType.includes('PNG')) {
      return [...base, 'Resolution', 'Width', 'Height', 'Aspect Ratio', 'Bit Depth', 'Color Type', 'Compression', 'Filter', 'Interlace', 'Title', 'Author', 'Description', 'Copyright', 'Creation Time', 'Software', 'Disclaimer', 'Warning', 'Source', 'Comment'];
    }
    if (mimeType.startsWith('image/webp') || detectedType.includes('WebP')) {
      return [...base, 'Resolution', 'Width', 'Height', 'Aspect Ratio', 'Has Alpha', 'Has Animation', 'EXIF_Raw', 'XMP_Raw', 'ICC_Profile', 'Software', 'Author', 'Description'];
    }
    if (mimeType.startsWith('image/jpeg') || detectedType.includes('JPEG') || detectedType.includes('JPG')) {
      return [...base, 'Resolution', 'Width', 'Height', 'Aspect Ratio', 'Color Space', 'Orientation', 'Make', 'Model', 'Software', 'DateTime', 'ExposureTime', 'FNumber', 'ISOSpeedRatings', 'FocalLength'];
    }
    if (mimeType.startsWith('image/')) {
      return [...base, 'Resolution', 'Width', 'Height', 'Aspect Ratio', 'Color Space', 'Orientation', 'Software', 'Creation Time'];
    }
    if (mimeType.startsWith('video/')) {
      return [...base, 'Duration', 'Resolution', 'Width', 'Height', 'Aspect Ratio', 'Video Codec', 'Audio Codec', 'Frame Rate (FPS)', 'Bitrate', 'Creation Time', 'Software'];
    }
    if (mimeType.startsWith('audio/')) {
      return [...base, 'Duration', 'Audio Codec', 'Sample Rate', 'Channels', 'Bitrate', 'Title', 'Artist', 'Album', 'Year', 'Genre', 'Track'];
    }
    return [...base, 'Software', 'Creation Time', 'Author', 'Description'];
  };

  const expectedFields = getExpectedFields(file.type, analysis.fileType);

  const getValue = (field: string) => {
    if (field === 'File Name') return file.name;
    if (field === 'File Size') return `${(file.size / 1024).toFixed(2)} KB (${file.size.toLocaleString()} bytes)`;
    if (field === 'MIME Type') return file.type || 'Unknown';
    if (field === 'Last Modified') return new Date(file.lastModified).toLocaleString();
    if (field === 'Detected Type') return analysis.fileType;
    
    if (analysis.metadata[field] !== undefined) return analysis.metadata[field];
    
    const lowerField = field.toLowerCase();
    const foundKey = Object.keys(analysis.metadata).find(k => k.toLowerCase() === lowerField || k.toLowerCase().replace(/_/g, ' ') === lowerField);
    
    if (foundKey) {
      const val = analysis.metadata[foundKey];
      if (typeof val === 'object' && val !== null) {
        try {
          return JSON.stringify(val);
        } catch {
          return String(val);
        }
      }
      return val;
    }
    return null;
  };

  const excludeKeys = ['workflow', 'prompt', 'EXIF_Raw', 'data', 'content', 'note'];
  const extraFields = Object.keys(analysis.metadata).filter(k => {
    if (excludeKeys.includes(k)) return false;
    const lowerK = k.toLowerCase();
    if (expectedFields.some(ef => ef.toLowerCase() === lowerK || ef.toLowerCase().replace(/_/g, ' ') === lowerK)) return false;
    return true;
  });

  const allFields = [...expectedFields, ...extraFields];

  return (
    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
      <h3 className="text-xl font-semibold text-zinc-100 mb-6">File Information</h3>
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium w-1/3">Property</th>
              <th className="p-4 font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {allFields.map((field, idx) => {
              const val = getValue(field);
              const isPresent = val !== undefined && val !== null && val !== '';
              if (!isPresent) return null;
              
              return (
                <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-zinc-400">{field}</td>
                  <td className="p-4 text-sm font-mono text-zinc-200 break-all">
                    {String(val)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModelsViewer({ metadata }: { metadata: any }) {
  const [exportFormat, setExportFormat] = useState<'txt' | 'json'>('txt');
  const [tooltip, setTooltip] = useState<{ visible: boolean, x: number, y: number, nodes: string[] }>({ visible: false, x: 0, y: 0, nodes: [] });

  const handleMouseMove = (e: React.MouseEvent, nodes: string[]) => {
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodes
    });
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const { models, loras } = useMemo(() => {
    const modelsMap = new Map<string, Set<string>>();
    const lorasMap = new Map<string, Set<string>>();

    const addModel = (filename: string, nodeInfo: string) => {
      const cleanName = filename.split(/[/\\]/).pop() || filename;
      if (!modelsMap.has(cleanName)) modelsMap.set(cleanName, new Set());
      modelsMap.get(cleanName)!.add(nodeInfo);
    };

    const addLora = (name: string, nodeInfo: string) => {
      const cleanName = name.split(/[/\\]/).pop() || name;
      const finalName = cleanName.toLowerCase().endsWith('.safetensors') ? cleanName : `${cleanName}.safetensors`;
      if (!lorasMap.has(finalName)) lorasMap.set(finalName, new Set());
      lorasMap.get(finalName)!.add(nodeInfo);
    };

    const searchString = (str: string, nodeInfo: string) => {
      const lower = str.toLowerCase();
      if (lower.endsWith('.safetensors') || lower.endsWith('.gguf')) {
        addModel(str, nodeInfo);
      }
      const loraRegex = /<lora:([^:>]+)(?::[^>]+)?>/g;
      let match;
      while ((match = loraRegex.exec(str)) !== null) {
        addLora(match[1], nodeInfo);
      }
    };

    const traverse = (obj: any, nodeInfo: string) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        searchString(obj, nodeInfo);
      } else if (Array.isArray(obj)) {
        obj.forEach(item => traverse(item, nodeInfo));
      } else if (typeof obj === 'object') {
        Object.values(obj).forEach(val => traverse(val, nodeInfo));
      }
    };

    if (metadata.prompt) {
      Object.entries(metadata.prompt).forEach(([id, node]: [string, any]) => {
        const nodeInfo = `Node ${id} (${node.class_type || 'Unknown'})`;
        traverse(node.inputs, nodeInfo);
      });
    }
    if (metadata.workflow && metadata.workflow.nodes) {
      metadata.workflow.nodes.forEach((node: any) => {
        const nodeInfo = `Node ${node.id} (${node.type || 'Unknown'})`;
        traverse(node.widgets_values, nodeInfo);
      });
    }

    const modelsList = Array.from(modelsMap.entries())
      .map(([name, nodes]) => ({ name, nodes: Array.from(nodes) }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    const lorasList = Array.from(lorasMap.entries())
      .map(([name, nodes]) => ({ name, nodes: Array.from(nodes) }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    return { models: modelsList, loras: lorasList };
  }, [metadata]);

  const handleExport = () => {
    let content = '';
    let mimeType = '';
    let filename = '';

    if (exportFormat === 'json') {
      content = JSON.stringify({
        models: models.map(m => m.name),
        loras: loras.map(l => l.name)
      }, null, 2);
      mimeType = 'application/json';
      filename = 'models_loras.json';
    } else {
      content += 'Models:\n';
      models.forEach(m => content += `- ${m.name}\n`);
      content += '\nLoRas:\n';
      loras.forEach(l => content += `- ${l.name}\n`);
      mimeType = 'text/plain';
      filename = 'models_loras.txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (models.length === 0 && loras.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-6 h-full">
        <Box className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium">No models or LoRas found in this workflow.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-zinc-100">Models & LoRas</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportFormat(f => f === 'txt' ? 'json' : 'txt')}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
          >
            Format: {exportFormat.toUpperCase()}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors border border-indigo-500/30"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {models.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-medium text-zinc-200">Models</h4>
            <span className="text-xs font-medium bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
              {models.length}
            </span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y divide-zinc-800/50">
              {models.map((model, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center p-4 hover:bg-zinc-900 transition-colors gap-3 cursor-default"
                  onMouseMove={(e) => handleMouseMove(e, model.nodes)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 shrink-0">
                    <Box className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="text-sm font-mono text-zinc-200 break-all">{model.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loras.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-medium text-zinc-200">LoRas</h4>
            <span className="text-xs font-medium bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
              {loras.length}
            </span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y divide-zinc-800/50">
              {loras.map((lora, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center p-4 hover:bg-zinc-900 transition-colors gap-3 cursor-default"
                  onMouseMove={(e) => handleMouseMove(e, lora.nodes)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 shrink-0">
                    <Layers className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-sm font-mono text-zinc-200 break-all">{lora.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-[9999] bg-zinc-800 text-xs text-zinc-200 p-3 rounded-xl shadow-2xl border border-zinc-700 pointer-events-none max-w-xs"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y + 15,
          }}
        >
          <div className="font-semibold text-zinc-400 mb-2 uppercase tracking-wider text-[10px]">Used in Nodes:</div>
          <div className="flex flex-col gap-1.5">
            {tooltip.nodes.map((n, i) => (
              <span key={i} className="bg-zinc-900/50 px-2 py-1 rounded border border-zinc-700/50">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NodeSettingsViewer({ metadata }: { metadata: any }) {
  const groupedNodes = useMemo(() => {
    const groups: Record<string, any[]> = {};

    const addNode = (type: string, id: string, inputs: any, promptInputs: any) => {
      if (!groups[type]) groups[type] = [];
      groups[type].push({ id, inputs, promptInputs });
    };

    if (metadata.workflow?.nodes) {
      metadata.workflow.nodes.forEach((n: any) => {
        if (n.type) {
          addNode(n.type, String(n.id), n.widgets_values || n.inputs, metadata.prompt?.[String(n.id)]?.inputs);
        }
      });
    } else if (metadata.prompt) {
      Object.entries(metadata.prompt).forEach(([id, n]: [string, any]) => {
        if (n.class_type) {
          addNode(n.class_type, id, n.inputs, n.inputs);
        }
      });
    }

    // Sort keys alphabetically
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as Record<string, any[]>);
  }, [metadata]);

  const types = Object.keys(groupedNodes);

  if (types.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 p-6">
        No nodes found to display.
      </div>
    );
  }

  return (
    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
      {types.map(type => (
        <NodeTypeGroup key={type} type={type} nodes={groupedNodes[type]} />
      ))}
    </div>
  );
}

function NodeTypeGroup({ type, nodes }: { type: string, nodes: any[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 shadow-sm">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-3 text-left bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-indigo-300">{type}</span>
          <span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">{nodes.length} instance{nodes.length !== 1 ? 's' : ''}</span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </div>
      {isExpanded && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/50 space-y-3">
          {nodes.map((node, idx) => (
            <NodeInstance key={idx} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeInstance({ node }: { node: any }) {
  const { id, inputs, promptInputs } = node;
  
  let displayWidgets: {name: string, value: any}[] = [];
  
  if (promptInputs && typeof promptInputs === 'object') {
     Object.entries(promptInputs).forEach(([k, v]) => {
        // Skip links (arrays of length 2 where first element is string/number)
        if (Array.isArray(v) && v.length >= 2 && (typeof v[0] === 'string' || typeof v[0] === 'number')) return;
        displayWidgets.push({ name: k, value: v });
     });
  } else if (inputs && typeof inputs === 'object' && !Array.isArray(inputs)) {
     Object.entries(inputs).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length >= 2 && !isNaN(Number(v[0]))) return;
        displayWidgets.push({ name: k, value: v });
     });
  } else if (Array.isArray(inputs)) {
     inputs.forEach((v, i) => {
        displayWidgets.push({ name: `Widget ${i}`, value: v });
     });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="text-xs font-mono text-zinc-500 mb-2 pb-2 border-b border-zinc-800/50">Node #{id}</div>
      {displayWidgets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {displayWidgets.map((w, i) => (
            <div key={i} className="flex flex-col bg-zinc-950 p-2 rounded border border-zinc-800/50">
              <span className="text-zinc-500 text-[10px] uppercase font-semibold tracking-wider mb-1">{w.name}</span>
              <span className="text-zinc-300 break-words font-mono text-xs">{typeof w.value === 'object' ? JSON.stringify(w.value) : String(w.value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-zinc-600 italic text-xs">No settings</div>
      )}
    </div>
  );
}

function ComfyUIWorkflowViewer({ metadata }: { metadata: any }) {
  const comfyKeys = ['workflow', 'prompt'];
  const comfyData = Object.entries(metadata).filter(([k]) => comfyKeys.includes(k));
  const miscData = Object.entries(metadata).filter(([k]) => !comfyKeys.includes(k) && k !== 'note');

  return (
    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
      {comfyData.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-zinc-100">ComfyUI Workflow</h3>
          {comfyData.map(([key, value]) => (
            <MetadataSection key={key} title={key} data={value} />
          ))}
        </div>
      ) : (
        <div className="text-zinc-500 flex flex-col items-center justify-center h-48 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
          <FileJson className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-medium">No ComfyUI workflow found in this file.</p>
        </div>
      )}

      {miscData.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-zinc-800/50">
          <h3 className="text-lg font-semibold text-zinc-300">Miscellaneous Metadata</h3>
          {miscData.map(([key, value]) => (
            <MetadataSection key={key} title={key} data={value} />
          ))}
        </div>
      )}
    </div>
  );
}

const MetadataSection: React.FC<{ title: string; data: any }> = ({ title, data }) => {
  const [isExpanded, setIsExpanded] = useState(title === 'workflow' || title === 'prompt');
  const [copied, setCopied] = useState(false);
  
  const isObject = typeof data === 'object' && data !== null;
  const displayData = isObject ? JSON.stringify(data, null, 2) : String(data);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([displayData], { type: isObject ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}_export.${isObject ? 'json' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 shadow-sm">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-4 text-left bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <span className="font-mono text-sm font-semibold text-zinc-200">{title}</span>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
                title="Download as file"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <div className="w-px h-4 bg-zinc-700 mx-1"></div>
            </>
          )}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-zinc-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-zinc-500" />
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="p-4 border-t border-zinc-800 overflow-x-auto bg-zinc-950/50 max-h-96 custom-scrollbar">
          {isObject ? (
            <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap break-words">
              {displayData}
            </pre>
          ) : (
            <p className="text-sm text-zinc-400 whitespace-pre-wrap break-words">{displayData}</p>
          )}
        </div>
      )}
    </div>
  );
}
