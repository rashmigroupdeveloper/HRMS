/**
 * Form vocabulary (docs/05 §7b) — label association, error state and keyboard
 * operation, in both themes.
 *
 * The rule being enforced: a validation message must be programmatically tied
 * to its field and announced, not merely painted red underneath it. Colour is
 * never the only signal (docs/05 §7).
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';
import { Select } from './Select';
import { Switch } from './Switch';
import { TextField } from './TextField';
import { Textarea } from './Textarea';
import { renderThemed, THEMES } from '../test/render';
import { runAxe } from '../test/axe';

describe('TextField', () => {
  it('associates its label with the input', () => {
    renderThemed(<TextField label="Employee code" defaultValue="RML035384" />);
    expect(screen.getByLabelText('Employee code')).toHaveValue('RML035384');
  });

  it('accepts typing and reports every keystroke', async () => {
    const onChange = vi.fn();
    renderThemed(<TextField label="Reason" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Reason'), 'abc');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('surfaces the error message as text, not only as colour', () => {
    renderThemed(<TextField label="Company ID" error="Enter a valid company ID." />);
    expect(screen.getByText('Enter a valid company ID.')).toBeInTheDocument();
  });

  it('shows the hint when there is no error, and the error wins when both are set', () => {
    const { rerender } = renderThemed(<TextField label="Grace" hint="Minutes before late." />);
    expect(screen.getByText('Minutes before late.')).toBeInTheDocument();

    rerender(<TextField label="Grace" hint="Minutes before late." error="Must be a number." />);
    expect(screen.getByText('Must be a number.')).toBeInTheDocument();
    expect(screen.queryByText('Minutes before late.')).not.toBeInTheDocument();
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <TextField label="Employee code" error="Required." />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});

describe('Textarea', () => {
  it('associates its label and accepts multiline input', async () => {
    renderThemed(<Textarea label="Notes" />);
    const field = screen.getByLabelText('Notes');
    await userEvent.type(field, 'line one');
    expect(field).toHaveValue('line one');
  });
});

describe('Select', () => {
  const options = [
    { value: 'GEN', label: 'General shift' },
    { value: 'NIGHT', label: 'Night shift' },
  ];

  it('is an ARIA combobox showing the selected LABEL', () => {
    renderThemed(<Select label="Shift" value="GEN" options={options} onChange={vi.fn()} />);
    const trigger = screen.getByRole('combobox', { name: 'Shift' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('General shift');
  });

  it('reports the chosen VALUE, not the label, when an option is picked', async () => {
    const onChange = vi.fn();
    renderThemed(<Select label="Shift" value="GEN" options={options} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Shift' }));
    await userEvent.click(screen.getByRole('option', { name: /Night shift/ }));

    // The API contract is the value — a handler that received "Night shift"
    // would write an invalid shift code to the roster.
    expect(onChange).toHaveBeenCalledWith('NIGHT');
  });

  it('is fully keyboard operable (open, move, choose)', async () => {
    const onChange = vi.fn();
    renderThemed(<Select label="Shift" value="GEN" options={options} onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('combobox', { name: 'Shift' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('NIGHT');
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <Select label="Shift" value="GEN" options={options} onChange={vi.fn()} />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});

describe('Checkbox', () => {
  it('toggles by keyboard — the permission grid is driven this way', async () => {
    const onChange = vi.fn();
    renderThemed(<Checkbox label="Grant audit.read" onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('respects the disabled state', async () => {
    const onChange = vi.fn();
    renderThemed(<Checkbox label="Locked" disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Switch', () => {
  it('exposes checked state and toggles', async () => {
    const onChange = vi.fn();
    renderThemed(<Switch label="Manager approval required" onChange={onChange} />);

    // The kit exposes this as role="switch" — an on/off policy toggle, not a
    // multi-select checkbox.
    const control = screen.getByRole('switch', { name: /Manager approval required/ });
    expect(control).not.toBeChecked();
    await userEvent.click(control);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each(THEMES)('has no axe violations in the %s theme', async (theme) => {
    const { container } = renderThemed(
      <Switch label="Crosses midnight" description="Night shift." onChange={vi.fn()} />,
      theme,
    );
    await expect(runAxe(container)).resolves.toHaveNoViolations();
  });
});
