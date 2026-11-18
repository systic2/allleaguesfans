import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SubTabs from '@/components/SubTabs';

const tabs = [
  { key: 'overview', label: '개요' },
  { key: 'squad', label: '선수단' },
  { key: 'fixtures', label: '일정' },
  { key: 'stats', label: '통계' },
];

function queryOf(link: HTMLElement) {
  return new URL(link.getAttribute('href')!, 'https://example.test').searchParams;
}

describe('SubTabs', () => {
  it('marks the default tab active and preserves existing query parameters when navigating', () => {
    render(
      <MemoryRouter initialEntries={['/teams/1?season=2026&filter=home']}>
        <SubTabs tabs={tabs} defaultKey="overview" />
      </MemoryRouter>,
    );

    const overview = screen.getByRole('link', { name: '개요' });
    const squad = screen.getByRole('link', { name: '선수단' });
    expect(overview).toHaveAttribute('aria-current', 'page');
    expect(squad).not.toHaveAttribute('aria-current');
    expect(Object.fromEntries(queryOf(squad))).toEqual({
      season: '2026',
      filter: 'home',
      tab: 'squad',
    });

    fireEvent.click(squad);

    expect(screen.getByRole('link', { name: '선수단' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '개요' })).not.toHaveAttribute('aria-current');
  });

  it('uses the tab query parameter instead of the default when present', () => {
    render(
      <MemoryRouter initialEntries={['/teams/1?tab=stats']}>
        <SubTabs tabs={tabs} defaultKey="overview" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: '하위 탭' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '통계' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '개요' })).not.toHaveAttribute('aria-current');
  });

  it('falls back to the default tab when the tab query parameter is unknown', () => {
    render(
      <MemoryRouter initialEntries={['/teams/1?tab=unknown']}>
        <SubTabs tabs={tabs} defaultKey="overview" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '개요' })).toHaveAttribute('aria-current', 'page');
    for (const label of ['선수단', '일정', '통계']) {
      expect(screen.getByRole('link', { name: label })).not.toHaveAttribute('aria-current');
    }
  });
});
