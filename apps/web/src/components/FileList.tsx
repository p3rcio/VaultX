// FileList.tsx — file table with debounced search and tag filter dropdown
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface FileEntry {
  id: string;
  name: string;
  size: number;
  mime: string;
  created_at: string;
  tags: { tag_id: string; tag_name: string; confidence: number }[];
}

interface Props {
  refreshKey?: number; // increment to trigger a re-fetch from the parent
}

export default function FileList({ refreshKey }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listFiles(search, tagFilter);
      setFiles(res.files);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  }, [search, tagFilter]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  // debounce: wait 300ms after the user stops typing before firing the API request
  // firing on every keypress would hammer the server unnecessarily
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer); // cancel if the user types again before the timer fires
  }, [searchInput]);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // collect all tag names across all files, deduplicate with Set, then sort alphabetically
  const allTags = Array.from(
    new Set(files.flatMap((f) => f.tags.map((t) => t.tag_name)))
  ).sort();

  return (
    <div>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="search"
          placeholder="Search files..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Search files"
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Filter by tag"
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* File table */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : files.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          No files yet. Upload one above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 px-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Size</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium">Tags</th>
                <th className="py-2 px-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2 px-3">
                    <Link
                      href={`/files/${f.id}`}
                      className="text-brand-600 hover:underline font-medium"
                    >
                      {f.name}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-gray-500">{formatSize(f.size)}</td>
                  <td className="py-2 px-3 text-gray-500">{f.mime}</td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {f.tags.map((t) => (
                        <span
                          key={t.tag_id}
                          className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded"
                        >
                          {t.tag_name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-gray-500">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
