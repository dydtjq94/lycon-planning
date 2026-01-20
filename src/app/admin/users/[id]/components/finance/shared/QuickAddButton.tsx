import { Plus } from "lucide-react";
import styles from "./QuickAddButton.module.css";

interface QuickAddItem {
  label: string;
  value: string;
}

interface QuickAddButtonProps {
  items: QuickAddItem[];
  onAdd: (value: string) => void;
}

export function QuickAddButton({ items, onAdd }: QuickAddButtonProps) {
  return (
    <div className={styles.container}>
      {items.map((item) => (
        <button
          key={item.value}
          className={styles.button}
          onClick={() => onAdd(item.value)}
          type="button"
        >
          <Plus size={12} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
