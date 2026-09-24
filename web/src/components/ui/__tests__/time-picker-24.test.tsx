import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TimePicker24 } from '../time-picker-24';

describe('TimePicker24', () => {
  it('renders showing 24h format', () => {
    render(<TimePicker24 value="08:00" />);
    expect(screen.getByText('08:00 น.')).toBeInTheDocument();
  });

  it('does NOT use native input type="time"', () => {
    const { container } = render(<TimePicker24 />);
    const inputs = container.querySelectorAll('input[type="time"]');
    expect(inputs.length).toBe(0);
  });

  it('does NOT show AM/PM text anywhere', () => {
    render(<TimePicker24 value="14:30" />);
    const button = screen.getByRole('button');
    expect(button.textContent).not.toMatch(/AM|PM/i);
  });

  it('onChange returns HH:mm string when selecting from predefined buttons', async () => {
    const handleChange = vi.fn();
    render(<TimePicker24 onChange={handleChange} />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    const presetButton = screen.getByRole('button', { name: '08:30' });
    await userEvent.click(presetButton);
    
    expect(handleChange).toHaveBeenCalledWith('08:30');
  });
});
