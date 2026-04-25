import { useState } from 'react';

export interface ComplianceRulesListProps {
  rules: string[];
  onAllAcknowledged: (acknowledged: boolean) => void;
}

/**
 * Renders a list of compliance rules as labelled checkboxes.
 *
 * Calls `onAllAcknowledged(true)` when every checkbox is checked,
 * and `onAllAcknowledged(false)` otherwise.
 *
 * Requirements: 5.2, 5.4, 5.5
 */
export function ComplianceRulesList({ rules, onAllAcknowledged }: ComplianceRulesListProps) {
  const [checked, setChecked] = useState<boolean[]>(() => rules.map(() => false));

  function handleChange(index: number, value: boolean) {
    const next = checked.map((c, i) => (i === index ? value : c));
    setChecked(next);
    onAllAcknowledged(next.every(Boolean));
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Compliance rules">
      {rules.map((rule, index) => (
        <li key={index}>
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={checked[index]}
              onChange={(e) => handleChange(index, e.target.checked)}
            />
            {rule}
          </label>
        </li>
      ))}
    </ul>
  );
}
