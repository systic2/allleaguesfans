import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from '@/app/layout/RootLayout';

vi.mock('@/app/components/Sidebar', () => ({
  default: () => <aside>Sidebar marker</aside>,
}));

vi.mock('@/app/components/GlobalSearch', () => ({
  default: () => <div>Search marker</div>,
}));

describe('RootLayout', () => {
  it('renders navigation controls, nested content, and external footer links', () => {
    render(
      <MemoryRouter initialEntries={['/content']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="content" element={<div>Page content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '앞으로' })).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'TheSportsDB' })).toHaveAttribute('href', 'https://www.thesportsdb.com');
    expect(screen.getByRole('link', { name: 'kleague.com' })).toHaveAttribute('href', 'https://www.kleague.com');
    expect(screen.getByRole('link', { name: '데이터 오류 제보' })).toHaveAttribute(
      'href',
      'https://github.com/systic2/allleaguesfans/issues',
    );

    for (const linkName of ['TheSportsDB', 'kleague.com', '데이터 오류 제보']) {
      const link = screen.getByRole('link', { name: linkName });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  });

  it('opens and closes the mobile drawer with its controls and Escape', () => {
    render(
      <MemoryRouter initialEntries={['/content']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="content" element={<div>Page content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const openButton = screen.getByRole('button', { name: '메뉴 열기' });
    const sidebar = document.getElementById('app-sidebar');
    expect(sidebar).toHaveClass('invisible');
    expect(openButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(openButton);
    expect(sidebar).toHaveClass('visible');
    expect(sidebar).not.toHaveClass('invisible');
    expect(openButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sidebar).toHaveClass('invisible');
    expect(sidebar).not.toHaveClass('visible');
    expect(openButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(openButton);
    fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }));
    expect(sidebar).toHaveClass('invisible');
    expect(sidebar).not.toHaveClass('visible');
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the top bar visible while nested content is suspended', () => {
    const pending = new Promise<never>(() => {});
    const SuspendedContent = () => {
      throw pending;
    };

    render(
      <MemoryRouter initialEntries={['/suspended']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="suspended" element={<SuspendedContent />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('로딩중…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeInTheDocument();
  });
});
