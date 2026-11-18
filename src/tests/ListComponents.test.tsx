import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CrestImg from '@/app/components/CrestImg';
import { FilterField } from '@/components/FilterBar';

describe('FilterField', () => {
  it('uses an aria-labelledby group instead of a label wrapper', () => {
    const { container } = render(
      <FilterField label="팀 이름">
        <input aria-label="팀 검색" />
      </FilterField>,
    );

    const group = screen.getByRole('group', { name: '팀 이름' });
    const labelId = group.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(container.querySelector(`span[id="${labelId}"]`)).toHaveTextContent('팀 이름');
    expect(container.querySelector('label')).not.toBeInTheDocument();
  });
});

describe('CrestImg', () => {
  it('renders an aria-hidden same-size span when src is missing', () => {
    const { container } = render(<CrestImg src={null} alt="팀 엠블럼" size={32} className="crest-slot" />);

    const fallback = container.querySelector('span[aria-hidden="true"]');
    expect(fallback).toHaveStyle({ width: '32px', height: '32px' });
    expect(fallback).toHaveClass('crest-slot');
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('/logo-fallback.svg');
  });

  it('remembers a failed src and retries when the src changes', () => {
    const { container, rerender } = render(<CrestImg src="broken.png" alt="팀 엠블럼" size={40} />);
    fireEvent.error(screen.getByRole('img', { name: '팀 엠블럼' }));

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('span[aria-hidden="true"]')).toHaveStyle({ width: '40px', height: '40px' });

    rerender(<CrestImg src="broken.png" alt="팀 엠블럼" size={40} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();

    rerender(<CrestImg src="working.png" alt="새 팀 엠블럼" size={40} />);
    expect(screen.getByRole('img', { name: '새 팀 엠블럼' })).toHaveAttribute('src', 'working.png');
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument();
  });
});
