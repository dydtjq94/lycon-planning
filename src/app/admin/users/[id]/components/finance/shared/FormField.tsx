import { ReactNode } from "react";
import styles from "./FormField.module.css";

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

interface FormRowProps {
  children: ReactNode;
}

export function FormRow({ children }: FormRowProps) {
  return <div className={styles.row}>{children}</div>;
}
