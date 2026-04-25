/**
 * Tests for ComplianceRulesList component.
 *
 * Validates: Requirements 5.2, 5.4, 5.5
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { ComplianceRulesList } from '../ComplianceRulesList';

describe('ComplianceRulesList', () => {
  const rules = [
    'Government ID required for cash pickup',
    'Maximum transfer limit: $1,000 per day',
    'Recipient must be 18 years or older',
  ];

  describe('all boxes checked → onAllAcknowledged(true)', () => {
    it('calls onAllAcknowledged(true) when every checkbox is checked', () => {
      const onAllAcknowledged = jest.fn();
      render(<ComplianceRulesList rules={rules} onAllAcknowledged={onAllAcknowledged} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(rules.length);

      // Check all checkboxes one by one
      checkboxes.forEach((cb) => fireEvent.click(cb));

      // The last call should be with true (all checked)
      expect(onAllAcknowledged).toHaveBeenLastCalledWith(true);
    });

    it('calls onAllAcknowledged(true) with a single rule when that rule is checked', () => {
      const onAllAcknowledged = jest.fn();
      render(
        <ComplianceRulesList
          rules={['Only one rule']}
          onAllAcknowledged={onAllAcknowledged}
        />
      );

      fireEvent.click(screen.getByRole('checkbox'));
      expect(onAllAcknowledged).toHaveBeenLastCalledWith(true);
    });
  });

  describe('one unchecked → onAllAcknowledged(false)', () => {
    it('calls onAllAcknowledged(false) when at least one checkbox remains unchecked', () => {
      const onAllAcknowledged = jest.fn();
      render(<ComplianceRulesList rules={rules} onAllAcknowledged={onAllAcknowledged} />);

      const checkboxes = screen.getAllByRole('checkbox');

      // Check all except the last one
      checkboxes.slice(0, -1).forEach((cb) => fireEvent.click(cb));

      expect(onAllAcknowledged).toHaveBeenLastCalledWith(false);
    });

    it('calls onAllAcknowledged(false) when a previously checked box is unchecked', () => {
      const onAllAcknowledged = jest.fn();
      render(<ComplianceRulesList rules={rules} onAllAcknowledged={onAllAcknowledged} />);

      const checkboxes = screen.getAllByRole('checkbox');

      // Check all
      checkboxes.forEach((cb) => fireEvent.click(cb));
      expect(onAllAcknowledged).toHaveBeenLastCalledWith(true);

      // Uncheck the first one
      fireEvent.click(checkboxes[0]);
      expect(onAllAcknowledged).toHaveBeenLastCalledWith(false);
    });
  });

  describe('initial state — no boxes checked', () => {
    it('renders all checkboxes unchecked initially', () => {
      render(<ComplianceRulesList rules={rules} onAllAcknowledged={jest.fn()} />);

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      checkboxes.forEach((cb) => expect(cb.checked).toBe(false));
    });

    it('calls onAllAcknowledged(false) on first interaction when not all boxes are checked', () => {
      const onAllAcknowledged = jest.fn();
      render(<ComplianceRulesList rules={rules} onAllAcknowledged={onAllAcknowledged} />);

      // Check only the first checkbox — not all are checked
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      expect(onAllAcknowledged).toHaveBeenCalledWith(false);
    });
  });

  describe('rendering', () => {
    it('renders each rule as a labelled checkbox', () => {
      render(<ComplianceRulesList rules={rules} onAllAcknowledged={jest.fn()} />);

      rules.forEach((rule) => {
        expect(screen.getByText(rule)).toBeInTheDocument();
      });
      expect(screen.getAllByRole('checkbox')).toHaveLength(rules.length);
    });

    it('renders nothing meaningful when rules array is empty', () => {
      render(<ComplianceRulesList rules={[]} onAllAcknowledged={jest.fn()} />);
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });
  });
});
