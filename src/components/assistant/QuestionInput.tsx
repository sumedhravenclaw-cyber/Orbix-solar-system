import { memo, useId, useState, type FormEvent } from 'react';

import styles from './SpaceAssistant.module.css';

const SendIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2 7.5 8.5M14 2l-4.2 12-2.3-5.5L2 6.2 14 2Z" />
  </svg>
);

/**
 * Follow-up questions about the selected body.
 *
 * A real form, so Enter submits and the browser's own autofill and IME handling
 * keep working. The field is cleared optimistically — the question is already
 * echoed into the transcript by the time the answer arrives.
 */
export const QuestionInput = memo(function QuestionInput({
  subjectName,
  disabled,
  onAsk,
}: {
  subjectName: string;
  disabled: boolean;
  onAsk: (question: string) => void;
}) {
  const [value, setValue] = useState('');
  const fieldId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = value.trim();
    if (!question || disabled) return;
    onAsk(question);
    setValue('');
  };

  return (
    <form className={styles.ask} onSubmit={submit}>
      <label className="sr-only" htmlFor={fieldId}>
        Ask a question about {subjectName}
      </label>
      <input
        id={fieldId}
        type="text"
        className={styles.askField}
        value={value}
        placeholder={`Ask me anything about ${subjectName}…`}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <button
        type="submit"
        className={styles.button}
        disabled={disabled || value.trim().length === 0}
        aria-label={`Ask about ${subjectName}`}
        title="Ask"
      >
        <SendIcon size={13} />
      </button>
    </form>
  );
});
