import { useState, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import styles from "./AccordionSection.module.css";

interface AccordionSectionProps {
  title: string;
  summary?: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function AccordionSection({
  title,
  summary,
  count,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button
        className={styles.header}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className={styles.headerLeft}>
          {isOpen ? (
            <ChevronDown size={18} className={styles.chevron} />
          ) : (
            <ChevronRight size={18} className={styles.chevron} />
          )}
          <span className={styles.title}>{title}</span>
          {count !== undefined && count > 0 && (
            <span className={styles.count}>{count}</span>
          )}
        </div>
        {summary && <span className={styles.summary}>{summary}</span>}
      </button>
      {isOpen && <div className={styles.content}>{children}</div>}
    </div>
  );
}
