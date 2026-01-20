"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./TemplateSelector.module.css";

interface Template {
  id: string;
  title: string;
  content: string;
}

interface TemplateSelectorProps {
  expertId: string;
  onSelect: (content: string) => void;
}

export function TemplateSelector({ expertId, onSelect }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAddForm(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadTemplates() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("expert_id", expertId)
      .order("created_at", { ascending: false });

    if (data) {
      setTemplates(data);
    }
    setLoading(false);
  }

  async function addTemplate() {
    if (!newTitle.trim() || !newContent.trim()) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("message_templates")
      .insert({
        expert_id: expertId,
        title: newTitle.trim(),
        content: newContent.trim(),
      });

    if (!error) {
      setNewTitle("");
      setNewContent("");
      setShowAddForm(false);
      await loadTemplates();
    }
    setSaving(false);
  }

  async function deleteTemplate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("템플릿을 삭제하시겠습니까?")) return;

    const supabase = createClient();
    await supabase.from("message_templates").delete().eq("id", id);
    await loadTemplates();
  }

  function handleSelect(content: string) {
    onSelect(content);
    setIsOpen(false);
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={`${styles.triggerButton} ${isOpen ? styles.active : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="템플릿 메시지"
      >
        <FileText size={18} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>템플릿 메시지</span>
            <button
              className={styles.addTemplateBtn}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? <X size={16} /> : <Plus size={16} />}
            </button>
          </div>

          {showAddForm && (
            <div className={styles.addForm}>
              <input
                type="text"
                className={styles.addInput}
                placeholder="템플릿 제목"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <textarea
                className={styles.addTextarea}
                placeholder="메시지 내용"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
              />
              <div className={styles.addFormActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTitle("");
                    setNewContent("");
                  }}
                >
                  취소
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={addTemplate}
                  disabled={saving || !newTitle.trim() || !newContent.trim()}
                >
                  저장
                </button>
              </div>
            </div>
          )}

          <div className={styles.templateList}>
            {loading ? (
              <div className={styles.loadingState}>로딩 중...</div>
            ) : templates.length === 0 ? (
              <div className={styles.emptyState}>
                저장된 템플릿이 없습니다.
                <br />
                <span>+ 버튼을 눌러 추가하세요.</span>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className={styles.templateItem}
                  onClick={() => handleSelect(template.content)}
                >
                  <div className={styles.templateInfo}>
                    <span className={styles.templateTitle}>{template.title}</span>
                    <span className={styles.templatePreview}>
                      {template.content.slice(0, 50)}
                      {template.content.length > 50 ? "..." : ""}
                    </span>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => deleteTemplate(template.id, e)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
