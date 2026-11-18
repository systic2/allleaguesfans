import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalSearch from '@/app/components/GlobalSearch';
import type { SearchRow } from '@/domain/types';
import { fetchTeamKoreanNames, searchByName } from '@/lib/api';
import { SEARCH_SCOPE_TEXT } from '@/lib/search';

vi.mock('@/lib/api', () => ({
  searchByName: vi.fn(),
  fetchTeamKoreanNames: vi.fn(),
}));

const mockSearchByName = vi.mocked(searchByName);
const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderSearch() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/home']}>
        <GlobalSearch />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    mockSearchByName.mockReset();
    mockFetchTeamKoreanNames.mockReset();
    mockFetchTeamKoreanNames.mockResolvedValue({ '138001': '울산 HD' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a combobox and sends a one-letter Enter search to the search page', () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '가' } });

    expect(screen.getByText(/2글자부터 자동으로 찾습니다/)).toBeInTheDocument();
    expect(mockSearchByName).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=%EA%B0%80');
  });

  it('debounces automatic search and renders grouped listbox options', async () => {
    const rows: SearchRow[] = [
      { type: 'player', entity_id: 3, name: 'Premier Player' },
      { type: 'team', entity_id: 2, team_id: '2', name: '프리미어 팀', name_en: 'Premier Team' },
      { type: 'league', entity_id: 1, name: '프리미어리그', slug: 'premier-league', country: 'England' },
    ];
    mockSearchByName.mockResolvedValue(rows);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '프리' } });
    expect(mockSearchByName).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');

    await waitFor(() => expect(mockSearchByName).toHaveBeenCalledWith('프리'), { timeout: 1_000 });
    const listbox = await screen.findByRole('listbox', { name: '검색 결과' });
    expect(listbox).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual([
      '리그', '팀', '선수',
    ]);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('moves aria-selected with arrow keys and opens the selected detail with Enter', async () => {
    mockSearchByName.mockResolvedValue([
      { type: 'league', entity_id: 1, name: '프리미어리그', slug: 'premier-league' },
      { type: 'team', entity_id: 2, team_id: '138106', name: '부산 아이파크', name_en: 'Busan IPark' },
    ]);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });
    fireEvent.change(input, { target: { value: '리그' } });
    const options = await screen.findAllByRole('option', undefined, { timeout: 1_000 });

    expect(fireEvent.mouseDown(options[0])).toBe(false);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location')).toHaveTextContent('/teams/138106');
    expect(input).toHaveValue('');
  });

  it('searches the composing value and delays a composing Enter until compositionend', async () => {
    mockSearchByName.mockResolvedValue([]);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '프리' }, isComposing: true });
    await waitFor(() => expect(mockSearchByName).toHaveBeenCalledWith('프리'), { timeout: 1_000 });

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(input).toHaveValue('프리');
    expect(screen.getByTestId('location')).toHaveTextContent('/home');

    fireEvent.change(input, { target: { value: '프리미어' }, isComposing: true });
    fireEvent.compositionEnd(input);
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=%ED%94%84%EB%A6%AC%EB%AF%B8%EC%96%B4');
    expect(mockSearchByName).toHaveBeenCalledTimes(1);
  });

  it('treats a non-composing Safari Enter with keyCode 229 as a normal submit', () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '가' } });
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: false });

    expect(notPrevented).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=%EA%B0%80');
  });

  it('submits the current query page and ignores arrows while results are stale', async () => {
    mockSearchByName.mockResolvedValue([
      { type: 'team', entity_id: 1, team_id: '1', name: '리그 팀', name_en: 'League Team' },
    ]);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });
    fireEvent.change(input, { target: { value: '리그' } });
    const option = await screen.findByRole('option', undefined, { timeout: 1_000 });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(option).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(input, { target: { value: '리그팀' } });
    const staleList = screen.getByRole('listbox', { name: '검색 결과' });
    expect(staleList).toHaveClass('opacity-60');
    expect(staleList).toHaveAttribute('aria-busy', 'true');
    expect(option).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(option).toHaveAttribute('aria-selected', 'false');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=%EB%A6%AC%EA%B7%B8%ED%8C%80');
  });

  it('disables stale results until the debounced query settles', async () => {
    mockSearchByName.mockImplementation(async (query) => query === '리그'
      ? [{ type: 'team', entity_id: 1, team_id: '1', name: '이전 팀', name_en: 'Previous Team' }]
      : [{ type: 'team', entity_id: 2, team_id: '2', name: '새 팀', name_en: 'New Team' }]);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '리그' } });
    const staleOption = await screen.findByRole('option', { name: /이전 팀/ }, { timeout: 1_000 });

    fireEvent.change(input, { target: { value: '새팀' } });
    const staleListbox = screen.getByRole('listbox', { name: '검색 결과' });
    expect(staleListbox).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(staleOption);
    expect(screen.getByTestId('location')).toHaveTextContent('/home');

    const nextOption = await screen.findByRole('option', { name: /새 팀/ }, { timeout: 1_000 });
    expect(screen.getByRole('listbox', { name: '검색 결과' })).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(nextOption);

    expect(screen.getByTestId('location')).toHaveTextContent('/teams/2');
  });

  it('clears a pending composing Enter when Escape closes before a new composition', () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '프리' }, isComposing: true });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input);

    expect(screen.getByTestId('location')).toHaveTextContent('/home');
    expect(input).toHaveValue('프리');
  });

  it('clears a pending composing Enter on the next compositionstart', () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '프리' }, isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input);

    expect(screen.getByTestId('location')).toHaveTextContent('/home');
    expect(input).toHaveValue('프리');
  });

  it('supports global focus shortcuts, empty-result guidance, and Escape closing', async () => {
    mockSearchByName.mockResolvedValue([]);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.keyDown(window, { key: '/' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '없는팀' } });

    expect(await screen.findByText('검색 결과 없음', undefined, { timeout: 1_000 })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(SEARCH_SCOPE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
    expect(input).toHaveAttribute('aria-expanded', 'false');

    input.blur();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(input).toHaveFocus();
  });

  it('does not intercept Ctrl/Meta+Shift+K or Alt shortcut combinations', () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(input).not.toHaveFocus();
    expect(fireEvent.keyDown(window, { key: 'k', metaKey: true, shiftKey: true })).toBe(true);
    expect(input).not.toHaveFocus();
    expect(fireEvent.keyDown(window, { key: 'k', ctrlKey: true, altKey: true })).toBe(true);
    expect(input).not.toHaveFocus();
  });

  it('closes when focus leaves the search region', async () => {
    mockSearchByName.mockResolvedValue([
      { type: 'league', entity_id: 1, name: '프리미어리그', slug: 'premier-league' },
    ]);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '프리' } });
    await screen.findByRole('listbox', { name: '검색 결과' }, { timeout: 1_000 });
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    fireEvent.blur(input, { relatedTarget: outside });

    expect(screen.queryByRole('listbox', { name: '검색 결과' })).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    outside.remove();
  });

  it('shows a search error after the debounced request fails', async () => {
    mockSearchByName.mockRejectedValue(new Error('network failed'));
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: '오류' } });

    expect(await screen.findByText('검색하지 못했습니다. 잠시 후 다시 시도해 주세요.', undefined, { timeout: 1_000 })).toBeInTheDocument();
    expect(screen.queryByText('검색 결과 없음')).not.toBeInTheDocument();
  });

  it('uses the team ID to show a Korean team name when a player team_name is empty', async () => {
    mockSearchByName.mockResolvedValue([
      { type: 'player', entity_id: 3, name: 'Lee Player', team_id: '138001', team_name: '' },
    ]);
    renderSearch();
    const input = screen.getByRole('combobox', { name: '리그·팀·선수 검색' });

    fireEvent.change(input, { target: { value: 'Lee' } });

    expect(await screen.findByText('울산 HD', undefined, { timeout: 1_000 })).toBeInTheDocument();
  });
});
