/**
 * 하이브리드 데이터 매퍼 (3-API 통합)
 * K리그 공식 API + TheSportsDB 프리미엄 API + Highlightly API 결합
 * CSV 분석 기반 데이터 소스 최적화 전략:
 * - K리그: 공식 정확도 (기본 정보, 통계)
 * - TheSportsDB: 이미지/메타데이터 (팀 로고, 선수 이미지)
 * - Highlightly: 실시간 데이터 (실시간 스코어, 하이라이트)
 */

import { KLeagueAPI, KLeagueMatch, KLeagueTeamRank, KLeaguePlayerRecord } from './kleague-api.ts'
import { KLeagueMapper } from './kleague-mappers.ts'
import { 
  TheSportsDBPremiumAPI,
  TheSportsDBLiveScore 
} from './thesportsdb-premium-api.ts'
import {
  HighlightlyAPI,
  HighlightlyMatch,
  HighlightlyLiveEvent,
  HighlightlyLineup,
  HighlightlyHighlight
} from './highlightly-api.ts'

// 확장된 하이브리드 데이터 타입
export interface HybridTeam {
  // 기본 정보 (K리그 우선)
  id: number
  name: string
  code: string | null
  league_id: number
  season_year: number
  country_name: string
  created_at: string
  updated_at: string
  
  // TheSportsDB 프리미엄 정보 (이미지, 상세 정보)
  logo_url: string | null
  badge_url: string | null
  jersey_url: string | null
  fanart_urls: string[]
  stadium: string | null
  stadium_capacity: number | null
  stadium_image: string | null
  founded: number | null
  website: string | null
  social_media: {
    facebook?: string
    twitter?: string
    instagram?: string
    youtube?: string
  }
  manager: string | null
  description: string | null
}

export interface HybridPlayer {
  // 기본 정보
  id?: number
  name: string
  team_id: number
  league_id: number
  season_year: number
  
  // K리그 통계 정보
  goals: number | null
  assists: number | null
  clean_sheets: number | null
  back_number: string | null
  
  // TheSportsDB 프리미엄 상세 정보
  player_id?: string // TheSportsDB ID
  nationality: string | null
  position: string | null
  height: string | null
  weight: string | null
  birth_date: string | null
  birth_location: string | null
  description: string | null
  
  // 이미지 정보
  photo_url: string | null
  cutout_url: string | null
  fanart_urls: string[]
  
  // 소셜 미디어
  social_media: {
    twitter?: string
    instagram?: string
    facebook?: string
  }
  
  // 추가 통계 (TheSportsDB Premium)
  appearances: number | null
  minutes_played: number | null
  yellow_cards: number | null
  red_cards: number | null
  
  created_at: string
  updated_at: string
  data_sources: ('kleague' | 'thesportsdb')[]
}

export interface HybridFixture {
  // 기본 경기 정보 (K리그 우선)
  id: number
  home_team_id: number
  away_team_id: number
  league_id: number
  season_year: number
  date_utc: string
  status: string
  home_goals: number | null
  away_goals: number | null
  venue: string | null
  round: number | null
  
  // TheSportsDB 확장 정보
  thesportsdb_id?: string
  live_score?: TheSportsDBLiveScore
  spectators: number | null
  referee: string | null
  weather: string | null
  
  // Highlightly 확장 정보 (CSV 전략: 실시간 + 하이라이트 주요 소스)
  highlightly_id?: string
  live_match?: HighlightlyMatch
  live_events: HighlightlyLiveEvent[]
  lineups: HighlightlyLineup[]
  highlights: HighlightlyHighlight[]
  real_time_score?: {
    home: number
    away: number
    minute?: number
    status: string
  }
  
  // 통합 이벤트 및 하이라이트
  match_events: HybridMatchEvent[]
  
  created_at: string
  updated_at: string
  data_sources: ('kleague' | 'thesportsdb' | 'highlightly')[]
}

export interface HybridMatchEvent {
  player_name?: string
  event_type: string // goal, card, substitution
  time_elapsed: number
  detail?: string
  assist_player?: string
  comment?: string
}

export interface HybridHighlight {
  video_url?: string
  embed_url?: string
  thumbnail_url?: string
  title?: string
}

export class HybridDataMapper {
  constructor(
    private kLeagueAPI: KLeagueAPI,
    private theSportsDBAPI: TheSportsDBPremiumAPI,
    private highlightlyAPI: HighlightlyAPI
  ) {}

  /**
   * CSV 분석 기반 데이터 소스 전략
   * - 실시간 스코어: K리그 우선 (TheSportsDB는 2분 지연)
   * - 팀 로고/이미지: TheSportsDB 우선
   * - 기본 정보: K리그 우선 (공식 데이터)
   * - 선수 정보: K리그 + TheSportsDB 결합
   */

  /**
   * 하이브리드 팀 데이터 생성
   */
  async createHybridTeam(kLeagueRank: KLeagueTeamRank, theSportsDBTeamId?: string): Promise<HybridTeam> {
    const now = new Date().toISOString()
    
    // K리그 기본 정보로 시작
    const baseTeam = KLeagueMapper.mapTeamFromRanking(kLeagueRank)
    
    // TheSportsDB에서 확장 정보 가져오기
    let theSportsDBData = null
    if (theSportsDBTeamId) {
      try {
        const enhanced = await this.theSportsDBAPI.getEnhancedTeamDetails(theSportsDBTeamId)
        theSportsDBData = enhanced.team
      } catch (error) {
        console.warn(`⚠️ TheSportsDB 데이터 가져오기 실패 (팀 ${baseTeam.name}):`, error)
      }
    }

    return {
      ...baseTeam,
      // TheSportsDB 확장 정보
      logo_url: theSportsDBData?.strTeamLogo || theSportsDBData?.strTeamBadge || null,
      badge_url: theSportsDBData?.strTeamBadge || null,
      jersey_url: theSportsDBData?.strTeamJersey || null,
      fanart_urls: [
        theSportsDBData?.strTeamFanart1,
        theSportsDBData?.strTeamFanart2,
        theSportsDBData?.strTeamFanart3,
        theSportsDBData?.strTeamFanart4
      ].filter(Boolean) as string[],
      stadium_capacity: theSportsDBData?.intStadiumCapacity ? parseInt(theSportsDBData.intStadiumCapacity) : null,
      stadium_image: theSportsDBData?.strStadiumThumb || null,
      website: theSportsDBData?.strWebsite || null,
      social_media: {
        facebook: theSportsDBData?.strFacebook || undefined,
        twitter: theSportsDBData?.strTwitter || undefined,
        instagram: theSportsDBData?.strInstagram || undefined,
        youtube: theSportsDBData?.strYoutube || undefined,
      },
      manager: theSportsDBData?.strManager || null,
      description: theSportsDBData?.strDescriptionEN || null
    }
  }

  /**
   * 하이브리드 선수 데이터 생성
   */
  async createHybridPlayer(
    kLeaguePlayer: KLeaguePlayerRecord, 
    type: 'goal' | 'assist' | 'clean'
  ): Promise<HybridPlayer> {
    const now = new Date().toISOString()
    
    // K리그 기본 데이터
    const basePlayer = KLeagueMapper.mapPlayer(kLeaguePlayer, type)
    
    // TheSportsDB에서 선수 검색
    let theSportsDBPlayer = null
    try {
      const searchResults = await this.theSportsDBAPI.searchPlayers(kLeaguePlayer.playerName)
      theSportsDBPlayer = searchResults.find(p => 
        p.strPlayer.toLowerCase().includes(kLeaguePlayer.playerName.toLowerCase()) ||
        kLeaguePlayer.playerName.toLowerCase().includes(p.strPlayer.toLowerCase())
      )
      
      if (theSportsDBPlayer) {
        console.log(`✅ TheSportsDB 매칭: ${kLeaguePlayer.playerName} → ${theSportsDBPlayer.strPlayer}`)
      }
    } catch (error) {
      console.warn(`⚠️ TheSportsDB 선수 검색 실패 (${kLeaguePlayer.playerName}):`, error)
    }

    return {
      ...basePlayer,
      // TheSportsDB 확장 정보
      player_id: theSportsDBPlayer?.idPlayer || undefined,
      nationality: theSportsDBPlayer?.strNationality || null,
      position: theSportsDBPlayer?.strPosition || null,
      height: theSportsDBPlayer?.strHeight || null,
      weight: theSportsDBPlayer?.strWeight || null,
      birth_date: theSportsDBPlayer?.dateBorn || null,
      birth_location: theSportsDBPlayer?.strBirthLocation || null,
      description: theSportsDBPlayer?.strDescriptionEN || null,
      
      photo_url: theSportsDBPlayer?.strThumb || null,
      cutout_url: theSportsDBPlayer?.strCutout || null,
      fanart_urls: [
        theSportsDBPlayer?.strFanart1,
        theSportsDBPlayer?.strFanart2,
        theSportsDBPlayer?.strFanart3,
        theSportsDBPlayer?.strFanart4
      ].filter(Boolean) as string[],
      
      social_media: {
        twitter: theSportsDBPlayer?.strTwitter || undefined,
        instagram: theSportsDBPlayer?.strInstagram || undefined,
        facebook: theSportsDBPlayer?.strFacebook || undefined,
      },
      
      // TODO: 추가 통계는 별도 API 호출 필요
      appearances: null,
      minutes_played: null,
      yellow_cards: null,
      red_cards: null,
      
      data_sources: theSportsDBPlayer ? ['kleague', 'thesportsdb'] : ['kleague']
    }
  }

  /**
   * 하이브리드 픽스처 데이터 생성 (3-API 통합)
   */
  async createHybridFixture(kLeagueMatch: KLeagueMatch): Promise<HybridFixture> {
    const now = new Date().toISOString()
    
    // K리그 기본 데이터
    const baseFixture = KLeagueMapper.mapFixture(kLeagueMatch)
    
    // 데이터 소스 추적
    const dataSources: ('kleague' | 'thesportsdb' | 'highlightly')[] = ['kleague']
    
    // 1. CSV 전략: Highlightly 실시간 데이터 우선 (높음)
    let highlightlyData = null
    let liveEvents: HighlightlyLiveEvent[] = []
    let lineups: HighlightlyLineup[] = []
    let highlights: HighlightlyHighlight[] = []
    let realTimeScore = null
    
    if (kLeagueMatch.gameStatus === 'PL' || kLeagueMatch.gameStatus === 'FT') {
      try {
        // Highlightly 실시간 경기 검색
        const liveMatches = await this.highlightlyAPI.getLiveMatches()
        highlightlyData = liveMatches.find(match => 
          this.matchTeamNames(match.home_team.name, kLeagueMatch.homeTeamName) ||
          this.matchTeamNames(match.away_team.name, kLeagueMatch.awayTeamName)
        )
        
        if (highlightlyData) {
          console.log(`✅ Highlightly 매칭: ${kLeagueMatch.homeTeamName} vs ${kLeagueMatch.awayTeamName}`)
          
          // 실시간 이벤트
          liveEvents = await this.highlightlyAPI.getMatchLiveEvents(highlightlyData.id)
          
          // 라인업 (CSV: 높음, K리그 + Highlightly 결합)
          lineups = await this.highlightlyAPI.getMatchLineups(highlightlyData.id)
          
          // 하이라이트 (CSV: 높음, 주요 소스)
          highlights = await this.highlightlyAPI.getMatchHighlights(highlightlyData.id)
          
          // 실시간 스코어
          if (highlightlyData.score) {
            realTimeScore = {
              home: highlightlyData.score.home,
              away: highlightlyData.score.away,
              minute: highlightlyData.minute,
              status: highlightlyData.status
            }
          }
          
          dataSources.push('highlightly')
        }
      } catch (error) {
        console.warn(`⚠️ Highlightly 데이터 가져오기 실패:`, error)
      }
    }
    
    // 2. TheSportsDB 보조 데이터 (CSV 전략: 보조 소스)
    let liveScore = null
    if (kLeagueMatch.gameStatus === 'PL' && !highlightlyData) { // Highlightly 실패 시 fallback
      try {
        const liveScores = await this.theSportsDBAPI.getLiveScores()
        liveScore = liveScores.find(score => 
          this.matchTeamNames(score.strHomeTeam, kLeagueMatch.homeTeamName) ||
          this.matchTeamNames(score.strAwayTeam, kLeagueMatch.awayTeamName)
        )
        
        if (liveScore) {
          console.log(`🔄 TheSportsDB fallback 활용: ${kLeagueMatch.homeTeamName} vs ${kLeagueMatch.awayTeamName}`)
          dataSources.push('thesportsdb')
        }
      } catch (error) {
        console.warn(`⚠️ TheSportsDB 실시간 스코어 가져오기 실패:`, error)
      }
    }

    // 3. 통합 매치 이벤트 생성
    const matchEvents: HybridMatchEvent[] = []
    for (const event of liveEvents) {
      matchEvents.push({
        player_name: event.player.name,
        event_type: event.type,
        time_elapsed: event.minute + (event.additional_time || 0),
        detail: event.description,
        assist_player: event.assist_player?.name
      })
    }

    return {
      ...baseFixture,
      // TheSportsDB
      live_score: liveScore || undefined,
      spectators: null,
      referee: null,
      weather: null,
      
      // Highlightly
      highlightly_id: highlightlyData?.id || undefined,
      live_match: highlightlyData || undefined,
      live_events: liveEvents,
      lineups: lineups,
      highlights: highlights,
      real_time_score: realTimeScore || undefined,
      
      // 통합 데이터
      match_events: matchEvents,
      data_sources: dataSources
    }
  }

  /**
   * 팀명 매칭 로직 (유사성 검사)
   */
  private matchTeamNames(name1?: string | null, name2?: string | null): boolean {
    if (!name1 || !name2) return false
    
    const n1 = name1.toLowerCase().trim()
    const n2 = name2.toLowerCase().trim()
    
    // 정확한 매칭
    if (n1 === n2) return true
    
    // 포함 관계 매칭
    if (n1.includes(n2) || n2.includes(n1)) return true
    
    // 공통 키워드 매칭 (FC, United 등 제거 후 비교)
    const clean1 = n1.replace(/\b(fc|united|city|town|cf)\b/gi, '').trim()
    const clean2 = n2.replace(/\b(fc|united|city|town|cf)\b/gi, '').trim()
    
    return clean1.includes(clean2) || clean2.includes(clean1)
  }

  /**
   * 팀 매칭 로직 - K리그 팀명과 TheSportsDB 팀 ID 매핑
   */
  private async findTheSportsDBTeamId(teamName: string): Promise<string | null> {
    try {
      const searchResults = await this.theSportsDBAPI.get<{teams: any[]}>(`/search/team/${encodeURIComponent(teamName)}`)
      const teams = searchResults.teams || []
      
      // 정확한 매칭 시도
      let match = teams.find(team => 
        team.strTeam.toLowerCase() === teamName.toLowerCase() ||
        team.strTeamShort?.toLowerCase() === teamName.toLowerCase()
      )
      
      // 부분 매칭 시도
      if (!match) {
        match = teams.find(team =>
          team.strTeam.toLowerCase().includes(teamName.toLowerCase()) ||
          teamName.toLowerCase().includes(team.strTeam.toLowerCase())
        )
      }
      
      return match?.idTeam || null
    } catch (error) {
      console.warn(`⚠️ TheSportsDB 팀 검색 실패 (${teamName}):`, error)
      return null
    }
  }

  /**
   * 종합 하이브리드 데이터 수집 (3-API 통합)
   */
  async getComprehensiveHybridData(): Promise<{
    teams: HybridTeam[]
    players: HybridPlayer[]
    fixtures: HybridFixture[]
    highlightlyData: {
      liveMatches: HighlightlyMatch[]
      highlights: HighlightlyHighlight[]
    }
    liveScores: TheSportsDBLiveScore[]
    dataQuality: {
      teams_with_images: number
      players_with_details: number
      live_matches: number
      highlights_count: number
      data_sources_used: string[]
    }
  }> {
    console.log('🚀 3-API 하이브리드 데이터 수집 시작 (K리그 + TheSportsDB + Highlightly)')
    
    // K리그 기본 데이터 수집
    console.log('🇰🇷 K리그 공식 데이터 수집...')
    const kLeagueData = await this.kLeagueAPI.getComprehensiveData()
    
    // CSV 전략: Highlightly 실시간 데이터 우선 수집 (높음)
    console.log('⚡ Highlightly 실시간 데이터 수집 (우선순위 높음)...')
    const highlightlyKoreanData = await this.highlightlyAPI.getKoreanLeagueComprehensiveData().catch(() => ({
      leagues: [],
      liveMatches: [],
      todayMatches: [],
      highlights: [],
      dataQuality: {
        live_matches_count: 0,
        highlights_count: 0,
        leagues_found: 0,
        data_freshness: new Date().toISOString()
      }
    }))
    
    console.log(`✅ Highlightly 데이터: ${highlightlyKoreanData.liveMatches.length}개 실시간 경기, ${highlightlyKoreanData.highlights.length}개 하이라이트`)
    
    // TheSportsDB 보조 실시간 스코어 (Highlightly 부족 시 fallback)
    console.log('📡 TheSportsDB 실시간 스코어 수집 (보조)...')
    const liveScores = await this.theSportsDBAPI.getLiveScores().catch(() => [])
    
    // 하이브리드 팀 데이터 생성
    console.log('👥 하이브리드 팀 데이터 생성...')
    const hybridTeams: HybridTeam[] = []
    const teamRankings = [...kLeagueData.rankings.league1, ...kLeagueData.rankings.league2]
    
    for (const ranking of teamRankings) {
      try {
        const theSportsDBTeamId = await this.findTheSportsDBTeamId(ranking.teamName)
        const hybridTeam = await this.createHybridTeam(ranking, theSportsDBTeamId || undefined)
        hybridTeams.push(hybridTeam)
        
        await this.delay(200) // API 호출 간격
      } catch (error) {
        console.warn(`⚠️ 하이브리드 팀 생성 실패 (${ranking.teamName}):`, error)
      }
    }

    // 하이브리드 선수 데이터 생성 (제한적으로)
    console.log('⚽ 하이브리드 선수 데이터 생성...')
    const hybridPlayers: HybridPlayer[] = []
    
    // 득점자 우선 처리 (상위 10명)
    const topGoalScorers = [
      ...(kLeagueData.playerRecords.goal.league1 || []).slice(0, 5),
      ...(kLeagueData.playerRecords.goal.league2 || []).slice(0, 5)
    ]
    
    for (const player of topGoalScorers) {
      try {
        const hybridPlayer = await this.createHybridPlayer(player, 'goal')
        hybridPlayers.push(hybridPlayer)
        
        await this.delay(300) // API 호출 간격
      } catch (error) {
        console.warn(`⚠️ 하이브리드 선수 생성 실패 (${player.playerName}):`, error)
      }
    }

    // 하이브리드 픽스처 데이터 생성
    console.log('⚽ 하이브리드 경기 데이터 생성...')
    const hybridFixtures: HybridFixture[] = []
    
    for (const match of kLeagueData.matches.all.slice(0, 10)) { // 최근 10경기만
      try {
        const hybridFixture = await this.createHybridFixture(match)
        hybridFixtures.push(hybridFixture)
        
        await this.delay(100) // 빠른 처리
      } catch (error) {
        console.warn(`⚠️ 하이브리드 경기 생성 실패:`, error)
      }
    }

    // 데이터 품질 분석
    const dataQuality = {
      teams_with_images: hybridTeams.filter(t => t.logo_url).length,
      players_with_details: hybridPlayers.filter(p => p.player_id).length,
      live_matches: Math.max(highlightlyKoreanData.liveMatches.length, liveScores.length),
      highlights_count: highlightlyKoreanData.highlights.length,
      data_sources_used: ['kleague', 'thesportsdb-premium', 'highlightly']
    }

    console.log('🎉 3-API 하이브리드 데이터 수집 완료!')
    console.log(`📊 품질 요약:`)
    console.log(`  - 팀: ${hybridTeams.length}개 (이미지 ${dataQuality.teams_with_images}개)`)
    console.log(`  - 선수: ${hybridPlayers.length}명 (상세 정보 ${dataQuality.players_with_details}명)`)
    console.log(`  - 경기: ${hybridFixtures.length}개`)
    console.log(`  - 실시간: ${dataQuality.live_matches}경기`)
    console.log(`  - 하이라이트: ${dataQuality.highlights_count}개`)
    console.log(`  - 데이터 소스: ${dataQuality.data_sources_used.join(', ')}`)

    return {
      teams: hybridTeams,
      players: hybridPlayers,
      fixtures: hybridFixtures,
      highlightlyData: {
        liveMatches: highlightlyKoreanData.liveMatches,
        highlights: highlightlyKoreanData.highlights
      },
      liveScores,
      dataQuality
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default HybridDataMapper