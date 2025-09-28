// Team ID mapping for production redirect handling
// Addresses issue: 운영환경에서 팀 정보 페이지 출력 안됨

/**
 * Maps old team IDs to current database team IDs
 * This handles users accessing old bookmarked URLs or external links
 */
export const OLD_TEAM_ID_MAPPING: Record<number, number> = {
  // Legacy IDs → Current database IDs
  463: 2767, // Ulsan Hyundai FC  
  464: 2768, // Gimcheon Sangmu FC
  465: 2745, // Bucheon FC 1995
  466: 2749, // Seoul E-Land FC
  467: 2751, // Gyeongnam FC
  // Add more mappings as needed when discovered from error logs
};

/**
 * Attempts to resolve a team ID, checking for old ID mappings
 * @param teamId - The team ID from the URL
 * @returns The correct team ID to use, or null if invalid
 */
export function resolveTeamId(teamId: number): number | null {
  // Check if it's already a valid current ID
  if (teamId >= 2745 && teamId <= 2768) {
    return teamId;
  }
  
  // Check if it's an old ID that can be mapped
  if (OLD_TEAM_ID_MAPPING[teamId]) {
    return OLD_TEAM_ID_MAPPING[teamId];
  }
  
  // Invalid or unknown team ID
  return null;
}

/**
 * Gets a user-friendly error message for invalid team IDs
 * @param originalTeamId - The team ID that was requested
 * @returns Error message with helpful context
 */
export function getTeamIdErrorMessage(originalTeamId: number): string {
  if (OLD_TEAM_ID_MAPPING[originalTeamId]) {
    return `팀 ID가 변경되었습니다. 새로운 페이지로 이동합니다...`;
  }
  
  return `팀 ID ${originalTeamId}를 찾을 수 없습니다. 검색을 통해 팀을 찾아보세요.`;
}

/**
 * Checks if a team ID should trigger a redirect
 * @param teamId - The team ID to check
 * @returns Object with redirect information
 */
export function shouldRedirectTeamId(teamId: number): { 
  shouldRedirect: boolean; 
  newTeamId?: number; 
  message?: string;
} {
  const mappedId = OLD_TEAM_ID_MAPPING[teamId];
  
  if (mappedId) {
    return {
      shouldRedirect: true,
      newTeamId: mappedId,
      message: getTeamIdErrorMessage(teamId)
    };
  }
  
  return { shouldRedirect: false };
}