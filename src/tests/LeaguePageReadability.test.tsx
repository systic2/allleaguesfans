import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import LeaguePage from '@/pages/LeaguePage';

vi.mock('@/lib/api');

const readableTextSizeClasses = new Set([
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
  'text-6xl',
  'text-7xl',
  'text-8xl',
  'text-9xl',
]);

const readableGrayClasses = new Set([
  'text-gray-300',
  'text-gray-200',
  'text-gray-100',
  'text-gray-50',
  'text-white',
]);

function classTokens(element: Element) {
  return element.className.split(/\s+/).filter(Boolean);
}

function expectTextXsOrLarger(element: HTMLElement) {
  expect(classTokens(element).some((className) => readableTextSizeClasses.has(className))).toBe(true);
}

function nearestTextColorClass(element: HTMLElement) {
  let current: HTMLElement | null = element;

  while (current) {
    const colorClass = classTokens(current).find(
      (className) => className === 'text-white' || /^text-gray-\d+$/.test(className),
    );
    if (colorClass) return colorClass;
    current = current.parentElement;
  }

  return undefined;
}

function expectGray300OrBrighter(element: HTMLElement) {
  expect(readableGrayClasses.has(nearestTextColorClass(element) ?? '')).toBe(true);
}

describe('LeaguePage readability', () => {
  const mockLeague = {
    id: 4689,
    slug: 'k-league-1',
    name: 'K League 1',
    logo_url: 'https://example.com/k1-logo.png',
    current_season: '2025',
    country: 'South Korea',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (api.fetchLeagueBySlug as any).mockResolvedValue(mockLeague);
    (api.fetchLeagueStandings as any).mockResolvedValue([]);
    (api.fetchHistoricalChampions as any).mockResolvedValue([
      { champion_name: 'Ulsan HD' },
    ]);
    (api.fetchTopScorers as any).mockResolvedValue([]);
    (api.fetchTopAssists as any).mockResolvedValue([]);
    (api.getAllRounds as any).mockResolvedValue(['1', '2', '3']);
    (api.getCurrentLiveRound as any).mockResolvedValue(null);
    (api.getNextUpcomingRound as any).mockResolvedValue('2');
    (api.getLatestCompletedRound as any).mockResolvedValue('1');
    (api.fetchFixturesByRound as any).mockResolvedValue([]);
  });

  const renderLeaguePage = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/leagues/k-league-1']}>
          <Routes>
            <Route path="/leagues/:slug" element={<LeaguePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('does not render any 10px text utility', async () => {
    const { container } = renderLeaguePage();

    await screen.findByText('Round 2');

    expect(container.querySelectorAll('.text-\\[10px\\]')).toHaveLength(0);
  });

  it('uses text-xs or larger for the round label and navigation buttons', async () => {
    renderLeaguePage();

    const roundLabel = await screen.findByText('Round 2');
    const previousButton = screen.getByRole('button', { name: '<' });
    const nextButton = screen.getByRole('button', { name: '>' });

    expectTextXsOrLarger(roundLabel);
    expectTextXsOrLarger(previousButton);
    expectTextXsOrLarger(nextButton);
  });

  it('uses gray-300 or brighter for country and defending champion metadata', async () => {
    renderLeaguePage();

    const country = await screen.findByText('국가: South Korea');
    const defendingChampion = screen.getByText('디펜딩 챔피언: Ulsan HD');

    expectGray300OrBrighter(country);
    expectGray300OrBrighter(defendingChampion);
  });

  it('uses gray-300 or brighter for the competition reputation placeholder', async () => {
    renderLeaguePage();

    const placeholder = await screen.findByText('Global Ranking');

    expectGray300OrBrighter(placeholder);
  });

  it('keeps the existing league identity and section headings visible', async () => {
    renderLeaguePage();

    expect(await screen.findByText('K League 1')).toBeInTheDocument();
    expect(screen.getByText('국가: South Korea')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('리그 순위 >')).toBeInTheDocument();
    expect(screen.getByText('경기/결과 >')).toBeInTheDocument();
    expect(screen.getByText('지난 우승팀 >')).toBeInTheDocument();
  });
});
