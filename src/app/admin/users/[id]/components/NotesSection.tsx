"use client";

import { useState, useEffect } from "react";
import { Pin, Trash2, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./NotesSection.module.css";

interface Note {
  id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

interface NotesSectionProps {
  profileId: string;
  expertId: string;
}

export function NotesSection({ profileId, expertId }: NotesSectionProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [profileId]);

  async function loadNotes() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customer_notes")
      .select("*")
      .eq("profile_id", profileId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotes(data);
    }
    setLoading(false);
  }

  async function addNote() {
    if (!newNote.trim()) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("customer_notes")
      .insert({
        profile_id: profileId,
        expert_id: expertId,
        content: newNote.trim(),
      });

    if (!error) {
      setNewNote("");
      setShowAddForm(false);
      await loadNotes();
    }
    setSaving(false);
  }

  async function togglePin(noteId: string, currentPinned: boolean) {
    const supabase = createClient();
    await supabase
      .from("customer_notes")
      .update({ is_pinned: !currentPinned, updated_at: new Date().toISOString() })
      .eq("id", noteId);
    await loadNotes();
  }

  async function deleteNote(noteId: string) {
    if (!confirm("메모를 삭제하시겠습니까?")) return;

    const supabase = createClient();
    await supabase
      .from("customer_notes")
      .delete()
      .eq("id", noteId);
    await loadNotes();
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "오늘";
    } else if (days === 1) {
      return "어제";
    } else if (days < 7) {
      return `${days}일 전`;
    } else {
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>내부 메모</h3>
        <button
          className={styles.addButton}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {showAddForm && (
        <div className={styles.addForm}>
          <textarea
            className={styles.textarea}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="메모 내용을 입력하세요..."
            rows={3}
            autoFocus
          />
          <div className={styles.addFormActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => {
                setShowAddForm(false);
                setNewNote("");
              }}
            >
              취소
            </button>
            <button
              className={styles.saveBtn}
              onClick={addNote}
              disabled={saving || !newNote.trim()}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className={styles.empty}>
          작성된 메모가 없습니다.
          <br />
          <span>+ 버튼을 눌러 메모를 추가하세요.</span>
        </div>
      ) : (
        <div className={styles.notesList}>
          {notes.map((note) => (
            <div
              key={note.id}
              className={`${styles.noteCard} ${note.is_pinned ? styles.pinned : ""}`}
            >
              <div className={styles.noteContent}>{note.content}</div>
              <div className={styles.noteFooter}>
                <span className={styles.noteDate}>{formatDate(note.created_at)}</span>
                <div className={styles.noteActions}>
                  <button
                    className={`${styles.noteAction} ${note.is_pinned ? styles.active : ""}`}
                    onClick={() => togglePin(note.id, note.is_pinned)}
                    title={note.is_pinned ? "고정 해제" : "고정"}
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    className={`${styles.noteAction} ${styles.deleteAction}`}
                    onClick={() => deleteNote(note.id)}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
