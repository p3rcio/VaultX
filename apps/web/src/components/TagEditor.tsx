// TagEditor.tsx — inline tag management, add or remove tags in two clicks
"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface FileTag {
  tag_id: string;
  tag_name: string;
  confidence: number;
}

interface Props {
  fileId: string;
  tags: FileTag[];
  onUpdate?: () => void;
}

export default function TagEditor({ fileId, tags, onUpdate }: Props) {
  const [newTag, setNewTag] = useState("");
  const [localTags, setLocalTags] = useState<FileTag[]>(tags);
  const [error, setError] = useState("");

  async function handleAdd() {
    const name = newTag.trim().toLowerCase();
    if (!name) return;
    if (localTags.some((t) => t.tag_name === name)) {
      setError("Tag already exists");
      return;
    }
    setError("");
    // optimistic update before the API call
    const updated = [...localTags, { tag_id: "", tag_name: name, confidence: 1.0 }];
    setLocalTags(updated);
    setNewTag("");
    try {
      // send the full updated list — the API replaces all existing tags
      await api.setTags(fileId, updated.map((t) => ({ name: t.tag_name, confidence: t.confidence })));
      onUpdate?.();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRemove(tagName: string) {
    // filter out the removed tag and push the updated list to the server
    const updated = localTags.filter((t) => t.tag_name !== tagName);
    setLocalTags(updated);
    try {
      await api.setTags(fileId, updated.map((t) => ({ name: t.tag_name, confidence: t.confidence })));
      onUpdate?.();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      {/* Existing tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {localTags.length === 0 && (
          <span className="text-sm text-on-surface-muted">No tags yet</span>
        )}
        {localTags.map((t) => (
          <span
            key={t.tag_name}
            className="inline-flex items-center gap-1.5 bg-accent/10 text-accent text-xs font-medium rounded-full px-3 py-1"
          >
            {t.tag_name}
            <button
              onClick={() => handleRemove(t.tag_name)}
              className="text-accent/60 hover:text-error transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error rounded-full"
              aria-label={`Remove tag ${t.tag_name}`}
              title="Remove tag"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Add tag — type + Enter or click Add */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Add a tag…"
          className="flex-1 bg-surface-high border border-white/10 rounded-md px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          aria-label="New tag name"
        />
        <button
          onClick={handleAdd}
          className="bg-accent hover:bg-accent-hover text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:ring-offset-surface"
        >
          Add
        </button>
      </div>

      {error && <p className="text-error text-xs mt-1.5">{error}</p>}
    </div>
  );
}
