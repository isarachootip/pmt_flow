import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge, StatusValue } from '../status-badge';

describe('StatusBadge', () => {
  const statuses: { status: StatusValue; colorVar: string }[] = [
    { status: 'PENDING', colorVar: 'bg-[var(--st-pending)]' },
    { status: 'IN_PROGRESS', colorVar: 'bg-[var(--st-progress)]' },
    { status: 'DONE', colorVar: 'bg-[var(--st-done)]' },
    { status: 'OVERDUE', colorVar: 'bg-[var(--st-overdue)]' },
    { status: 'REWORK', colorVar: 'bg-[var(--st-rework)]' },
    { status: 'DRAFT', colorVar: 'bg-[var(--st-neutral)]' },
    { status: 'CANCELLED', colorVar: 'bg-[var(--st-neutral)]' },
  ];

  it.each(statuses)('renders correctly for status $status', ({ status, colorVar }) => {
    const { container } = render(<StatusBadge status={status} />);
    
    // Test text content
    const textElement = screen.getByText(status);
    expect(textElement).toBeInTheDocument();
    
    // text is always black (#000000), using 'text-black' class
    expect(textElement).toHaveClass('text-black');
    
    // shows 8px color dot with correct color CSS variable
    // 'h-2 w-2 rounded-full' and the specific bg color
    const dotElement = container.querySelector('span[aria-hidden="true"]');
    expect(dotElement).toBeInTheDocument();
    expect(dotElement).toHaveClass('h-2', 'w-2', 'rounded-full', colorVar);
  });

  it('renders custom label if provided', () => {
    render(<StatusBadge status="PENDING" label="รอตรวจสอบ" />);
    expect(screen.getByText('รอตรวจสอบ')).toBeInTheDocument();
    expect(screen.queryByText('PENDING')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge status="DONE" className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});
