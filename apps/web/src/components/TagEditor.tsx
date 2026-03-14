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
    // optimistic update — apply the change locally before the API call so the UI feels instant
    const updated = [...localTags, { tag_id: "", tag_name: name, confidence: 1.0 }];
    setLocalTags(updated);
    setNewTag("");

    try {
      // send the full updated list — the API replaces all existing tags in one go
      await api.setTags(
        fileId,
        updated.map((t) => ({ name: t.tag_name, confidence: t.confidence }))
      );
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
      await api.setTags(
        fileId,
        updated.map((t) => ({ name: t.tag_name, confidence: t.confidence }))
      );
      onUpdate?.();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Tags
      </label>

      {/* Existing tags with remove buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {localTags.length === 0 && (
          <span className="text-sm text-gray-400">No tags</span>
        )}
        {localTags.map((t) => (
          <span
            key={t.tag_name}
            className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-sm px-2 py-1 rounded"
          >
            {t.tag_name}
            <button
              onClick={() => handleRemove(t.tag_name)}
              className="text-brand-400 hover:text-red-500 ml-1"
              aria-label={`Remove tag ${t.tag_name}`}
              title="Remove tag"
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      {/* Add tag input — type + Enter or click Add, so <=2 clicks from the detail page */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Add tag..."
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="New tag name"
        />
        <button
          onClick={handleAdd}
          className="bg-brand-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Add
        </button>
      </div>

      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
