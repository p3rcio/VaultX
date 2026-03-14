// tags.ts — client-side tag generation from filename, MIME type, and file size
// all tagging runs in the browser so the server never touches any file content, just the resulting tag list
// heuristic-based (extension + MIME + filename patterns) rather than actual AI

const EXTENSION_TAGS: Record<string, string[]> = {
  pdf: ["document", "pdf"],
  doc: ["document", "word"],
  docx: ["document", "word"],
  txt: ["document", "text"],
  md: ["document", "markdown"],
  rtf: ["document"],
  odt: ["document"],
  jpg: ["image", "photo"],
  jpeg: ["image", "photo"],
  png: ["image"],
  gif: ["image", "animated"],
  svg: ["image", "vector"],
  webp: ["image"],
  bmp: ["image"],
  mp4: ["video"],
  avi: ["video"],
  mov: ["video"],
  mkv: ["video"],
  webm: ["video"],
  mp3: ["audio", "music"],
  wav: ["audio"],
  flac: ["audio", "lossless"],
  aac: ["audio"],
  ogg: ["audio"],
  zip: ["archive", "compressed"],
  tar: ["archive"],
  gz: ["archive", "compressed"],
  rar: ["archive", "compressed"],
  "7z": ["archive", "compressed"],
  js: ["code", "javascript"],
  ts: ["code", "typescript"],
  py: ["code", "python"],
  java: ["code", "java"],
  c: ["code", "c"],
  cpp: ["code", "c++"],
  html: ["code", "web"],
  css: ["code", "web"],
  json: ["data", "json"],
  xml: ["data", "xml"],
  csv: ["data", "spreadsheet"],
  xlsx: ["spreadsheet", "excel"],
  xls: ["spreadsheet", "excel"],
  pptx: ["presentation"],
  ppt: ["presentation"],
};

const FILENAME_PATTERNS: [RegExp, string[]][] = [
  [/invoice/i, ["invoice", "finance"]],
  [/receipt/i, ["receipt", "finance"]],
  [/screenshot/i, ["screenshot"]],
  [/photo/i, ["photo"]],
  [/resume|cv/i, ["resume", "career"]],
  [/report/i, ["report"]],
  [/contract/i, ["contract", "legal"]],
  [/meeting/i, ["meeting", "notes"]],
  [/scan/i, ["scan"]],
  [/backup/i, ["backup"]],
  [/draft/i, ["draft"]],
];

export interface GeneratedTag {
  name: string;
  confidence: number;
}

export function generateTags(
  filename: string,
  mimeType: string,
  size: number
): GeneratedTag[] {
  const seen = new Set<string>();
  const tags: GeneratedTag[] = [];

  const add = (name: string, confidence: number) => {
    const lower = name.toLowerCase();
    if (seen.has(lower)) return; // skip duplicates
    seen.add(lower);
    tags.push({ name: lower, confidence });
  };

  // file extension is usually the most reliable signal, so confidence is 0.9
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (EXTENSION_TAGS[ext]) {
    for (const tag of EXTENSION_TAGS[ext]) add(tag, 0.9);
  }

  // MIME gives a broad category — skip "application" since it covers too many things to be useful
  const mimeCategory = mimeType.split("/")[0];
  if (mimeCategory && mimeCategory !== "application") {
    add(mimeCategory, 0.8);
  }

  // check if the filename contains any recognisable keywords
  for (const [pattern, patternTags] of FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      for (const tag of patternTags) add(tag, 0.7);
    }
  }

  // size thresholds are deterministic so confidence is 1.0
  if (size > 100 * 1024 * 1024) {
    add("large-file", 1.0);
  } else if (size < 1024 * 1024) {
    add("small-file", 1.0);
  }

  return tags;
}
