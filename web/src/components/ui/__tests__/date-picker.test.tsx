import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DatePicker } from '../date-picker';

describe('DatePicker', () => {
  it('renders with placeholder DD/MM/YYYY', () => {
    render(<DatePicker />);
    const input = screen.getByPlaceholderText('DD/MM/YYYY');
    expect(input).toBeInTheDocument();
  });

  it('does NOT use native input type="date"', () => {
    render(<DatePicker />);
    const input = screen.getByPlaceholderText('DD/MM/YYYY');
    expect(input).not.toHaveAttribute('type', 'date');
  });

  it('value displays in DD/MM/YYYY format', () => {
    // value is ISO date string (YYYY-MM-DD)
    render(<DatePicker value="2024-05-15" />);
    const input = screen.getByDisplayValue('15/05/2024');
    expect(input).toBeInTheDocument();
  });

  it('onChange returns ISO date string (YYYY-MM-DD) when typed', async () => {
    const handleChange = vi.fn();
    render(<DatePicker onChange={handleChange} />);
    const input = screen.getByPlaceholderText('DD/MM/YYYY');
    
    await userEvent.type(input, '15/05/2024');
    
    // Check that it calls with ISO date string (if parseDMY works correctly)
    expect(handleChange).toHaveBeenCalledWith('2024-05-15');
  });
});
