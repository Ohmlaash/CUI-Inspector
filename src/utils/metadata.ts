export interface ImageMetadata {
  [key: string]: any;
}

export interface FileAnalysis {
  fileType: string;
  mimeType: string;
  basicInfo: Record<string, any>;
  metadata: ImageMetadata;
}

export async function analyzeFile(file: File): Promise<FileAnalysis> {
  const basicInfo: Record<string, any> = {
    "File Name": file.name,
    "File Size": `${(file.size / 1024).toFixed(2)} KB`,
    "Last Modified": new Date(file.lastModified).toLocaleString(),
  };

  let fileType = "Unknown";
  let metadata: ImageMetadata = {};

  if (file.type.startsWith('image/')) {
    try {
      const dimensions = await getImageDimensions(file);
      metadata["Resolution"] = `${dimensions.width} x ${dimensions.height}`;
      metadata["Width"] = dimensions.width;
      metadata["Height"] = dimensions.height;
    } catch (e) {
      console.warn("Could not get image dimensions", e);
    }
  } else if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
    try {
      const mediaInfo = await getMediaMetadata(file);
      Object.assign(metadata, mediaInfo);
    } catch (e) {
      console.warn("Could not get media metadata", e);
    }
  }

  if (file.type === 'application/json' || file.name.endsWith('.json')) {
    fileType = "JSON Document";
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json.nodes && json.links) {
         metadata['workflow'] = json;
         fileType = "ComfyUI Workflow (JSON)";
      } else if (Object.values(json).some((v: any) => v && v.class_type)) {
         metadata['prompt'] = json;
         fileType = "ComfyUI API Prompt (JSON)";
      } else {
         metadata['data'] = json;
      }
    } catch (e) {
      metadata['error'] = "Invalid JSON file";
    }
  } else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
    fileType = "Plain Text";
    metadata['content'] = await file.text();
  } else {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    if (buffer.byteLength >= 8 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
      fileType = "PNG Image";
      metadata = await parsePng(buffer);
    } else if (buffer.byteLength >= 12 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
      fileType = "WebP Image";
      metadata = await parseWebp(buffer);
    } else if (file.type.startsWith('image/')) {
      fileType = `${file.type.split('/')[1].toUpperCase()} Image`;
      metadata = await scanForJSON(file);
    } else if (file.type.startsWith('video/')) {
      fileType = `${file.type.split('/')[1].toUpperCase()} Video`;
      metadata = await scanForJSON(file);
    } else if (file.type.startsWith('audio/')) {
      fileType = `${file.type.split('/')[1].toUpperCase()} Audio`;
      metadata = await scanForJSON(file);
    } else {
      fileType = file.type || "Unknown Binary";
      metadata = await scanForJSON(file);
    }
  }

  return {
    fileType,
    mimeType: file.type,
    basicInfo,
    metadata
  };
}

function getImageDimensions(file: File): Promise<{width: number, height: number, aspectRatio: string}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const r = gcd(img.width, img.height);
      const aspectRatio = r > 0 ? `${img.width/r}:${img.height/r}` : '';
      resolve({ width: img.width, height: img.height, aspectRatio });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function getMediaMetadata(file: File): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    
    media.onloadedmetadata = () => {
      const info: Record<string, any> = {
        "Duration": `${media.duration.toFixed(2)} seconds`
      };
      if (media instanceof HTMLVideoElement) {
        info["Resolution"] = `${media.videoWidth} x ${media.videoHeight}`;
        info["Width"] = media.videoWidth;
        info["Height"] = media.videoHeight;
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
        const r = gcd(media.videoWidth, media.videoHeight);
        if (r > 0) {
          info["Aspect Ratio"] = `${media.videoWidth/r}:${media.videoHeight/r}`;
        }
      }
      URL.revokeObjectURL(url);
      resolve(info);
    };
    
    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    
    media.src = url;
  });
}

async function decompressZlib(data: Uint8Array): Promise<string> {
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const response = new Response(ds.readable);
    return await response.text();
  } catch (e) {
    console.error("Decompression error", e);
    return "[Failed to decompress]";
  }
}

async function scanForJSON(file: File): Promise<ImageMetadata> {
  const metadata: ImageMetadata = {};
  try {
    // Scan up to first 5MB and last 5MB to avoid memory issues on huge files
    const chunkSize = 5 * 1024 * 1024;
    let text = "";
    if (file.size <= chunkSize * 2) {
      text = await file.text();
    } else {
      const startBlob = file.slice(0, chunkSize);
      const endBlob = file.slice(file.size - chunkSize);
      text = await startBlob.text() + "\n" + await endBlob.text();
    }

    const promptObj = extractJSONFromText(text, "prompt");
    if (promptObj) metadata['prompt'] = promptObj;

    const workflowObj = extractJSONFromText(text, "workflow");
    if (workflowObj) metadata['workflow'] = workflowObj;

    if (Object.keys(metadata).length === 0) {
      metadata['note'] = "No embedded ComfyUI JSON metadata found in this file.";
    }
  } catch (e) {
    console.warn("Generic scan failed", e);
    metadata['note'] = "Failed to scan file for embedded metadata.";
  }
  return metadata;
}

function extractJSONFromText(text: string, keyword: string): any {
  const idx = text.indexOf(`"${keyword}":`);
  if (idx === -1) return null;
  
  const startIdx = text.indexOf('{', idx);
  if (startIdx === -1) return null;

  let braceCount = 0;
  let endIdx = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx !== -1) {
    try {
      return JSON.parse(text.substring(startIdx, endIdx + 1));
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function parsePng(buffer: ArrayBuffer): Promise<ImageMetadata> {
  const view = new DataView(buffer);
  const metadata: ImageMetadata = {};
  let offset = 8; 

  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) break;
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );
    
    if (type === 'tEXt') {
      const data = new Uint8Array(buffer, offset + 8, length);
      let nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = new TextDecoder('latin1').decode(data.slice(0, nullIdx));
        const text = new TextDecoder('latin1').decode(data.slice(nullIdx + 1));
        try {
          metadata[keyword] = JSON.parse(text);
        } catch {
          metadata[keyword] = text;
        }
      }
    } else if (type === 'iTXt') {
      const data = new Uint8Array(buffer, offset + 8, length);
      let nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = new TextDecoder('latin1').decode(data.slice(0, nullIdx));
        const compressionFlag = data[nullIdx + 1];
        const compressionMethod = data[nullIdx + 2];
        
        let nextNullIdx = data.indexOf(0, nullIdx + 3); 
        if (nextNullIdx !== -1) {
            nextNullIdx = data.indexOf(0, nextNullIdx + 1); 
            if (nextNullIdx !== -1) {
                const textData = data.slice(nextNullIdx + 1);
                let text = "";
                if (compressionFlag === 0) {
                   text = new TextDecoder('utf-8').decode(textData);
                } else if (compressionFlag === 1 && compressionMethod === 0) {
                   text = await decompressZlib(textData);
                } else {
                   text = "[Unsupported Compression]";
                }
                
                try {
                  metadata[keyword] = JSON.parse(text);
                } catch {
                  metadata[keyword] = text;
                }
            }
        }
      }
    } else if (type === 'IEND') {
      break;
    }

    offset += 8 + length + 4; 
  }

  return metadata;
}

async function parseWebp(buffer: ArrayBuffer): Promise<ImageMetadata> {
  const view = new DataView(buffer);
  const metadata: ImageMetadata = {};
  let offset = 12; 

  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) break;
    const type = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const length = view.getUint32(offset + 4, true); 

    if (type === 'EXIF') {
       const data = new Uint8Array(buffer, offset + 8, length);
       const text = new TextDecoder('ascii').decode(data);
       
       const workflowMatch = text.match(/workflow\x00({.*})/s) || text.match(/({.*"nodes".*})/s);
       if (workflowMatch) {
          try {
             metadata['workflow'] = JSON.parse(workflowMatch[1]);
          } catch {
             metadata['workflow'] = workflowMatch[1];
          }
       }
       const promptMatch = text.match(/prompt\x00({.*})/s);
       if (promptMatch) {
          try {
             metadata['prompt'] = JSON.parse(promptMatch[1]);
          } catch {
             metadata['prompt'] = promptMatch[1];
          }
       }
       
       metadata['EXIF_Raw'] = "[EXIF Data Present]";
    }

    offset += 8 + length + (length % 2); 
  }

  return metadata;
}
