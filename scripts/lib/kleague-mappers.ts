/**
 * K리그 API 데이터 매퍼
 * K리그 공식 API 응답을 표준 데이터베이스 형식으로 변환
 * 대체를 위한 무료 솔루션
 */

import { 
  KLeagueMatch, 
  KLeagueTeamRank, 
  KLeaguePlayerRecord 
} from './kleague-api.js'

// 표준화된 데이터베이스 스키마 인터페이스
export interface StandardizedLeague {
  id: number
  name: string
  country_name: string
  logo_url: string | null
  season_year: number
  created_at: string
  updated_at: string
  source: 'kleague'
}

export interface StandardizedTeam {
  id: number  // 정수 형식 팀 ID (K리그 문자열 ID를 정수로 변환)
  name: string
  code: string | null
  logo_url: string | null
  league_id: number
  season_year: number
  country_name: string
  data_source: 'kleague'
  founded: number | null
  stadium: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export interface StandardizedFixture {
  id: number
  home_team_id: number  // 정수 형식 팀 ID
  away_team_id: number  // 정수 형식 팀 ID
  league_id: number
  season_year: number
  date_utc: string      // match_date → date_utc (데이터베이스 스키마 매칭)
  status: string
  home_goals: number | null  // home_score → home_goals (데이터베이스 스키마 매칭)
  away_goals: number | null  // away_score → away_goals (데이터베이스 스키마 매칭)
  venue: string | null
  round: number | null
  created_at: string
  updated_at: string
}

export interface StandardizedStanding {
  id?: number
  team_id: number  // 정수 형식 팀 ID
  league_id: number
  season_year: number
  rank_position: number  // position → rank_position (데이터베이스 스키마 매칭)
  all_played: number     // played → all_played
  all_win: number        // wins → all_win
  all_draw: number       // draws → all_draw (데이터베이스 스키마 매칭)
  all_lose: number       // losses → all_lose
  all_goals_for: number  // goals_for → all_goals_for
  all_goals_against: number // goals_against → all_goals_against
  goalsDiff: number      // goal_difference → goalsDiff (데이터베이스 스키마 매칭)
  points: number
  form: string | null
  created_at: string
  updated_at: string
}

export interface StandardizedPlayer {
  id?: number
  name: string
  team_id: number  // 정수 형식 팀 ID
  league_id: number
  season_year: number
  back_number: string | null
  goals: number | null
  assists: number | null
  clean_sheets: number | null
  position: string | null
  created_at: string
  updated_at: string
  source: 'kleague'
}

export class KLeagueMapper {
  private static readonly CURRENT_SEASON = 2025 // K리그 API에서 확인된 현재 시즌

  /**
   * K리그 팀 ID (문자열)를 정수 ID로 변환
   * K01 → 1001, K02 → 1002 등으로 변환하여 legacy ID 충돌 방지
   */
  static mapTeamId(kLeagueTeamId: string): number {
    // K리그 팀 ID는 "K01", "K02", "K03" 형식
    if (typeof kLeagueTeamId === 'string' && kLeagueTeamId.startsWith('K')) {
      const numericPart = parseInt(kLeagueTeamId.substring(1), 10)
      return 1000 + numericPart // K01 → 1001, K02 → 1002
    }
    // 숫자인 경우 1000을 더해서 충돌 방지
    return typeof kLeagueTeamId === 'number' ? 1000 + kLeagueTeamId : parseInt(kLeagueTeamId, 10) + 1000
  }

  /**
   * 정수 팀 ID를 K리그 문자열 ID로 역변환
   */
  static reverseMapTeamId(standardId: number): string {
    const kNumber = standardId - 1000
    return `K${kNumber.toString().padStart(2, '0')}`
  }

  /**
   * K리그 ID를 우리 표준 리그 ID로 매핑
   */
  static mapLeagueId(kLeagueId: number): number {
    switch (kLeagueId) {
      case 1: return 292 // K리그1 → legacy ID 292와 호환성 유지
      case 2: return 293 // K리그2 → legacy ID 293과 호환성 유지
      default: return kLeagueId + 291 // 기타 리그는 292부터 시작하도록 오프셋
    }
  }

  /**
   * 표준 리그 ID를 K리그 ID로 역매핑
   */
  static reverseMapLeagueId(standardId: number): number {
    switch (standardId) {
      case 292: return 1 // K리그1
      case 293: return 2 // K리그2
      default: return standardId - 291
    }
  }

  /**
   * 리그 정보를 표준화된 형식으로 매핑
   */
  static mapLeagues(): StandardizedLeague[] {
    const now = new Date().toISOString()
    
    return [
      {
        id: 292,
        name: 'K리그1',
        country_name: 'South Korea',
        logo_url: 'https://www.kleague.com/images/common/logo_kleague1.png',
        season_year: this.CURRENT_SEASON,
        created_at: now,
        updated_at: now,
        source: 'kleague'
      },
      {
        id: 293,
        name: 'K리그2',
        country_name: 'South Korea',
        logo_url: 'https://www.kleague.com/images/common/logo_kleague2.png',
        season_year: this.CURRENT_SEASON,
        created_at: now,
        updated_at: now,
        source: 'kleague'
      }
    ]
  }

  /**
   * 팀 순위 데이터를 표준 팀 정보로 변환
   */
  static mapTeamFromRanking(ranking: KLeagueTeamRank): StandardizedTeam {
    const now = new Date().toISOString()
    
    // 팀 코드 생성 (3자리)
    const teamCode = this.generateTeamCode(ranking.teamName)
    
    return {
      id: this.mapTeamId(ranking.teamId), // 문자열 팀 ID를 정수로 변환
      name: ranking.teamName,
      code: teamCode,
      logo_url: null, // K리그 API에서 팀 로고 정보 제공 안 함
      league_id: this.mapLeagueId(ranking.leagueId),
      season_year: ranking.year,
      country_name: 'South Korea',
      data_source: 'kleague',
      founded: null, // K리그 API에서 창단 연도 정보 제공 안 함
      stadium: null, // 경기장 정보는 경기 데이터에서만 제공
      website: null,
      created_at: now,
      updated_at: now
    }
  }

  /**
   * K리그 경기 데이터를 표준 픽스처 형식으로 변환
   */
  static mapFixture(match: KLeagueMatch): StandardizedFixture {
    const now = new Date().toISOString()
    
    // 경기 상태 매핑
    let status = 'scheduled'
    if (match.endYn === 'Y' && match.gameStatus === 'FE') {
      status = 'finished'
    } else if (match.gameStatus === 'PL') {
      status = 'live'
    }
    
    // 날짜 형식 변환 (2025.09.21 → 2025-09-21T16:30:00)
    const matchDateTime = this.parseKLeagueDateTime(match.gameDate, match.gameTime)
    
    return {
      id: match.gameId,
      home_team_id: this.mapTeamId(match.homeTeam), // 문자열 팀 ID를 정수로 변환
      away_team_id: this.mapTeamId(match.awayTeam), // 문자열 팀 ID를 정수로 변환
      league_id: this.mapLeagueId(match.leagueId),
      season_year: match.year,
      date_utc: matchDateTime, // match_date → date_utc (데이터베이스 스키마 매칭)
      status,
      home_goals: match.homeGoal, // home_score → home_goals (데이터베이스 스키마 매칭)
      away_goals: match.awayGoal, // away_score → away_goals (데이터베이스 스키마 매칭)
      venue: match.fieldNameFull,
      round: match.roundId,
      created_at: now,
      updated_at: now
    }
  }

  /**
   * 팀 순위를 표준 순위표 형식으로 변환
   */
  static mapStanding(ranking: KLeagueTeamRank): StandardizedStanding {
    const now = new Date().toISOString()
    
    return {
      team_id: this.mapTeamId(ranking.teamId), // 문자열 팀 ID를 정수로 변환
      league_id: this.mapLeagueId(ranking.leagueId),
      season_year: ranking.year,
      rank_position: ranking.rank, // position → rank_position (데이터베이스 스키마 매칭)
      all_played: ranking.winCnt + ranking.tieCnt + ranking.lossCnt, // played → all_played
      all_win: ranking.winCnt, // wins → all_win
      all_draw: ranking.tieCnt, // draws → all_draw (데이터베이스 스키마 매칭)
      all_lose: ranking.lossCnt, // losses → all_lose
      all_goals_for: ranking.goalCnt, // goals_for → all_goals_for
      all_goals_against: ranking.loseGoalCnt, // goals_against → all_goals_against
      goalsDiff: ranking.gapCnt, // goal_difference → goalsDiff (데이터베이스 스키마 매칭)
      points: ranking.gainPoint,
      form: null, // K리그 API에서 최근 폼 정보 제공 안 함
      created_at: now,
      updated_at: now
    }
  }

  /**
   * 선수 기록을 표준 플레이어 형식으로 변환
   */
  static mapPlayer(playerRecord: KLeaguePlayerRecord, type: 'goal' | 'assist' | 'clean'): StandardizedPlayer {
    const now = new Date().toISOString()
    
    return {
      name: playerRecord.playerName,
      team_id: this.mapTeamId(playerRecord.teamId), // 문자열 팀 ID를 정수로 변환
      league_id: this.mapLeagueId(playerRecord.leagueId),
      season_year: playerRecord.year,
      back_number: playerRecord.backNo,
      goals: type === 'goal' ? playerRecord.goalCnt : null,
      assists: type === 'assist' ? playerRecord.assistCnt : null,
      clean_sheets: type === 'clean' ? playerRecord.cleanCnt : null,
      position: null, // K리그 API에서 포지션 정보 제공 안 함
      created_at: now,
      updated_at: now,
      source: 'kleague'
    }
  }

  /**
   * 팀명에서 3자리 팀 코드 생성
   */
  private static generateTeamCode(teamName: string): string {
    // 한글 팀명을 영어로 매핑
    const teamCodeMap: Record<string, string> = {
      '울산': 'ULS',
      '수원FC': 'SFC',
      '안양': 'ANY',
      '서울': 'SEO',
      '광주': 'GWJ',
      '포항': 'POH',
      '제주': 'JEJ',
      '전북': 'JBK',
      '김천': 'GIM',
      '대전': 'DAE',
      '대구': 'DAG',
      '강원': 'GWO',
      '인천': 'ICH',
      '안산': 'ANS',
      '충북청주': 'CHB',
      '천안': 'CHN',
      '화성': 'HWS',
      '부산': 'BUS',
      '전남': 'JNM',
      '수원': 'SUW',
      '경남': 'GNM',
      '부천': 'BUC',
      '서울E': 'SEE',
      '김포': 'GMP',
      '성남': 'SNG',
      '충남아산': 'CHN'
    }
    
    return teamCodeMap[teamName] || teamName.substring(0, 3).toUpperCase()
  }

  /**
   * K리그 날짜/시간 형식을 ISO 형식으로 변환
   */
  private static parseKLeagueDateTime(date: string, time: string): string {
    // "2025.09.21" + "16:30" → "2025-09-21T16:30:00"
    const isoDate = date.replace(/\./g, '-')
    return `${isoDate}T${time}:00`
  }

  /**
   * 데이터 유효성 검증
   */
  static validateTeam(team: StandardizedTeam): boolean {
    return !!(
      team.id &&
      team.name &&
      team.league_id &&
      team.season_year
    )
  }

  static validateFixture(fixture: StandardizedFixture): boolean {
    return !!(
      fixture.id &&
      fixture.home_team_id &&
      fixture.away_team_id &&
      fixture.league_id &&
      fixture.match_date
    )
  }

  static validateStanding(standing: StandardizedStanding): boolean {
    return !!(
      standing.team_id &&
      standing.league_id &&
      standing.position >= 1 &&
      standing.played >= 0 &&
      standing.points >= 0
    )
  }

  static validatePlayer(player: StandardizedPlayer): boolean {
    return !!(
      player.name &&
      player.team_id &&
      player.league_id &&
      player.season_year
    )
  }

  /**
   * 종합 데이터 변환 및 검증
   */
  static transformComprehensiveData(data: {
    matches: {
      all: KLeagueMatch[]
      league1: KLeagueMatch[]
      league2: KLeagueMatch[]
    }
    rankings: {
      league1: KLeagueTeamRank[]
      league2: KLeagueTeamRank[]
    }
    playerRecords: {
      goal: KLeaguePlayerRecord[]
      assist: KLeaguePlayerRecord[]
      clean: KLeaguePlayerRecord[]
    }
  }) {
    console.log('🔄 K리그 데이터 변환 시작...')
    
    // 리그 정보
    const leagues = this.mapLeagues()
    
    // 팀 정보 (순위 데이터에서 추출)
    const teams: StandardizedTeam[] = []
    const allRankings = [...data.rankings.league1, ...data.rankings.league2]
    
    for (const ranking of allRankings) {
      const team = this.mapTeamFromRanking(ranking)
      if (this.validateTeam(team)) {
        teams.push(team)
      }
    }
    
    // 경기 정보
    const fixtures: StandardizedFixture[] = []
    for (const match of data.matches.all) {
      const fixture = this.mapFixture(match)
      if (this.validateFixture(fixture)) {
        fixtures.push(fixture)
      }
    }
    
    // 순위표
    const standings: StandardizedStanding[] = []
    for (const ranking of allRankings) {
      const standing = this.mapStanding(ranking)
      if (this.validateStanding(standing)) {
        standings.push(standing)
      }
    }
    
    // 선수 기록
    const players: StandardizedPlayer[] = []
    
    // 득점 기록 처리 (리그별로 분리되어 있음)
    const allGoalRecords = [
      ...(data.playerRecords.goal.league1 || []),
      ...(data.playerRecords.goal.league2 || [])
    ]
    
    for (const record of allGoalRecords) {
      const player = this.mapPlayer(record, 'goal')
      if (this.validatePlayer(player)) {
        players.push(player)
      }
    }
    
    // 어시스트 기록 처리 (기존 득점 기록과 병합)
    const allAssistRecords = [
      ...(data.playerRecords.assist.league1 || []),
      ...(data.playerRecords.assist.league2 || [])
    ]
    
    for (const record of allAssistRecords) {
      const existingPlayer = players.find(p => 
        p.name === record.playerName && 
        p.team_id === this.mapTeamId(record.teamId) &&
        p.league_id === this.mapLeagueId(record.leagueId)
      )
      
      if (existingPlayer) {
        existingPlayer.assists = record.assistCnt || null
      } else {
        const player = this.mapPlayer(record, 'assist')
        if (this.validatePlayer(player)) {
          players.push(player)
        }
      }
    }
    
    // 클린시트 기록 처리 (골키퍼)
    const allCleanRecords = [
      ...(data.playerRecords.clean.league1 || []),
      ...(data.playerRecords.clean.league2 || [])
    ]
    
    for (const record of allCleanRecords) {
      const existingPlayer = players.find(p => 
        p.name === record.playerName && 
        p.team_id === this.mapTeamId(record.teamId) &&
        p.league_id === this.mapLeagueId(record.leagueId)
      )
      
      if (existingPlayer) {
        existingPlayer.clean_sheets = record.cleanCnt || null
      } else {
        const player = this.mapPlayer(record, 'clean')
        if (this.validatePlayer(player)) {
          players.push(player)
        }
      }
    }
    
    console.log('✅ K리그 데이터 변환 완료')
    console.log(`📊 결과: 리그 ${leagues.length}개, 팀 ${teams.length}개, 경기 ${fixtures.length}개, 순위 ${standings.length}개, 선수 ${players.length}명`)
    
    return {
      leagues,
      teams,
      fixtures,
      standings,
      players
    }
  }

  /**
   * 팀 ID와 이름 매핑 테이블 생성
   */
  static createTeamIdMapping(teams: StandardizedTeam[]): Record<number, string> {
    const mapping: Record<number, string> = {}
    teams.forEach(team => {
      mapping[team.id] = team.name
    })
    return mapping
  }

  /**
   * 리그별 통계 생성
   */
  static generateLeagueStats(data: {
    teams: StandardizedTeam[]
    fixtures: StandardizedFixture[]
    standings: StandardizedStanding[]
  }) {
    const league1Teams = data.teams.filter(t => t.league_id === 292)
    const league2Teams = data.teams.filter(t => t.league_id === 293)
    
    const league1Fixtures = data.fixtures.filter(f => f.league_id === 292)
    const league2Fixtures = data.fixtures.filter(f => f.league_id === 293)
    
    return {
      league1: {
        teams: league1Teams.length,
        fixtures: league1Fixtures.length,
        completed_matches: league1Fixtures.filter(f => f.status === 'finished').length
      },
      league2: {
        teams: league2Teams.length,
        fixtures: league2Fixtures.length,
        completed_matches: league2Fixtures.filter(f => f.status === 'finished').length
      }
    }
  }
}

export default KLeagueMapper