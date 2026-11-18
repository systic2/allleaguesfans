import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NotFound from '@/app/components/NotFound';

describe('NotFound', () => {
  it('renders the default 404 message and recovery links', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '리그 목록' })).toHaveAttribute('href', '/leagues');
  });

  it('renders a supplied context-specific message', () => {
    render(
      <MemoryRouter>
        <NotFound message="대상을 찾을 수 없습니다." />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '대상을 찾을 수 없습니다.' })).toBeInTheDocument();
    expect(screen.queryByText('페이지를 찾을 수 없습니다.')).not.toBeInTheDocument();
  });
});
