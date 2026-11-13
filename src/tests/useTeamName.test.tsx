import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTeamKoreanNames } from '@/lib/api';
import { useTeamName } from '@/hooks/useTeamName';

vi.mock('@/lib/api', () => ({
  fetchTeamKoreanNames: vi.fn(),
}));

const mockFetchTeamKoreanNames = vi.mocked(fetchTeamKoreanNames);

describe('useTeamName', () => {
  beforeEach(() => {
    mockFetchTeamKoreanNames.mockReset();
  });

  it('returns a Korean name when present and otherwise keeps the fallback', async () => {
    mockFetchTeamKoreanNames.mockResolvedValue({ '138001': '울산 HD' });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTeamName(), { wrapper });

    await waitFor(() => {
      expect(result.current('138001', 'Ulsan HD FC')).toBe('울산 HD');
    });
    expect(result.current('999999', 'Unknown FC')).toBe('Unknown FC');
    expect(result.current(null, 'No team')).toBe('No team');
  });
});
