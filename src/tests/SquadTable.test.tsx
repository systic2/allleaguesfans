import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SquadTable from '@/components/SquadTable';
import type { TeamPlayer } from '@/lib/api';
import { RECORD_SCOPE } from '@/lib/squad';

function makePlayer(id: string, overrides: Partial<TeamPlayer> = {}): TeamPlayer {
  return {
    idPlayer: id,
    strPlayer: id,
    strTeam: 'Test FC',
    idTeam: 'team-1',
    strPosition: 'Forward',
    strNumber: '9',
    strNationality: 'South Korea',
    dateBorn: '2000-01-01',
    updatedAt: null,
    goals: null,
    assists: null,
    appearances: null,
    yellow_cards: null,
    red_cards: null,
    ...overrides,
  };
}

function renderTable(players: TeamPlayer[], leagueId = '4689') {
  return render(
    <MemoryRouter>
      <SquadTable players={players} leagueId={leagueId} seasonLabel="2026" />
    </MemoryRouter>,
  );
}

function visibleNames(): string[] {
  return screen.getAllByRole('rowheader').map((cell) => cell.textContent?.trim() ?? '');
}

describe('SquadTable', () => {
  it('shows the latest squad update as a KST 기준일', () => {
    renderTable([
      makePlayer('Earlier', { updatedAt: '2026-01-01T15:29:30Z' }),
      makePlayer('Latest', { updatedAt: '2026-01-01T15:30:00Z' }),
    ]);

    expect(screen.getByRole('heading', { name: '현재 선수단 (기준일 2026-01-02)' })).toBeInTheDocument();
  });

  it('hides all-null stat columns and explains unlinked K League records', () => {
    renderTable([makePlayer('No Stats')]);

    for (const label of ['출전', '득점', '도움', '경고', '퇴장']) {
      expect(screen.queryByRole('columnheader', { name: label })).not.toBeInTheDocument();
    }
    expect(screen.getByText(/kleague\.com 선수 ID로 모으고 있어 아직 이 명단과 연결되지 않았습니다/)).toBeInTheDocument();
  });

  it('shows the transfer scope after the league scope when stat columns are visible', () => {
    renderTable([makePlayer('Scorer', { goals: 2 })]);

    const scopeNote = screen.getByText((_, element) =>
      element?.tagName === 'P' && element.textContent?.includes(RECORD_SCOPE.transfer) === true,
    );
    expect(scopeNote).toHaveTextContent(`${RECORD_SCOPE.kleague} ${RECORD_SCOPE.transfer}`);
  });

  it('gives every column sort button the minimum touch-target width', () => {
    renderTable([makePlayer('Scorer', { goals: 2 })]);

    for (const header of screen.getAllByRole('columnheader')) {
      expect(within(header).getByRole('button')).toHaveClass('min-w-11');
    }
  });

  it('toggles aria-sort and row order from ascending to descending', () => {
    renderTable([
      makePlayer('Zulu', { strNumber: '2' }),
      makePlayer('Alpha', { strNumber: '10' }),
    ], '4328');

    expect(visibleNames()).toEqual(['Zulu', 'Alpha']);
    const nameButton = screen.getByRole('button', { name: '이름' });

    fireEvent.click(nameButton);
    expect(screen.getByRole('columnheader', { name: '이름' })).toHaveAttribute('aria-sort', 'ascending');
    expect(visibleNames()).toEqual(['Alpha', 'Zulu']);

    fireEvent.click(nameButton);
    expect(screen.getByRole('columnheader', { name: '이름' })).toHaveAttribute('aria-sort', 'descending');
    expect(visibleNames()).toEqual(['Zulu', 'Alpha']);
  });

  it('filters the table to goalkeepers and updates aria-pressed', () => {
    renderTable([
      makePlayer('Keeper', { strPosition: 'Goalkeeper', strNumber: '1' }),
      makePlayer('Striker', { strPosition: 'Forward', strNumber: '9' }),
    ]);

    const gk = screen.getByRole('button', { name: 'GK' });
    expect(gk).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(gk);

    expect(gk).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Keeper' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Striker' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'false');
  });
});
