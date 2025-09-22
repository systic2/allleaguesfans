import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;
const apiKey = process.env.API_FOOTBALL_KEY;

if (!supabaseUrl || !supabaseKey || !apiKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TransferDetection {
  type: 'departure' | 'arrival' | 'loan_out' | 'loan_return' | 'retirement';
  player_id?: number;
  api_player_id?: number;
  player_name: string;
  from_team_id?: number;
  to_team_id?: number;
  from_team_name?: string;
  to_team_name?: string;
  confidence: number;
  detection_method: string;
  evidence: string[];
  recommended_action: 'flag' | 'auto_update' | 'manual_review';
  priority: 'high' | 'medium' | 'low';
}

interface TransferWindow {
  isOpen: boolean;
  startDate: Date;
  endDate: Date;
  type: 'summer' | 'winter';
}

interface AlertConfig {
  enableSlack: boolean;
  enableEmail: boolean;
  slackWebhook?: string;
  emailRecipients?: string[];
  minConfidence: number;
  onlyHighPriority: boolean;
}

async function fetchAPIFootballData(endpoint: string) {
  try {
    const response = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
      headers: {
        'x-apisports-key': apiKey!,
        'x-apisports-host': 'v3.football.api-sports.io'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error);
    return null;
  }
}

function getTransferWindow(): TransferWindow {
  const now = new Date();
  const year = now.getFullYear();
  
  // 여름 이적시장: 6월 1일 ~ 8월 31일
  const summerStart = new Date(year, 5, 1); // 6월 1일
  const summerEnd = new Date(year, 7, 31); // 8월 31일
  
  // 겨울 이적시장: 1월 1일 ~ 1월 31일
  const winterStart = new Date(year, 0, 1); // 1월 1일
  const winterEnd = new Date(year, 0, 31); // 1월 31일
  
  if (now >= summerStart && now <= summerEnd) {
    return {
      isOpen: true,
      startDate: summerStart,
      endDate: summerEnd,
      type: 'summer'
    };
  } else if (now >= winterStart && now <= winterEnd) {
    return {
      isOpen: true,
      startDate: winterStart,
      endDate: winterEnd,
      type: 'winter'
    };
  }
  
  // 다음 이적시장 계산
  const nextWindow = now.getMonth() < 6 ? 
    { startDate: summerStart, endDate: summerEnd, type: 'summer' as const } :
    { startDate: new Date(year + 1, 0, 1), endDate: new Date(year + 1, 0, 31), type: 'winter' as const };
  
  return {
    isOpen: false,
    startDate: nextWindow.startDate,
    endDate: nextWindow.endDate,
    type: nextWindow.type
  };
}

async function detectPlayerDepartures(teamId: number): Promise<TransferDetection[]> {
  console.log(`🔍 팀 ${teamId} 선수 이탈 감지...`);
  
  const detections: TransferDetection[] = [];
  
  // 1. 데이터베이스에서 현재 등록된 선수들
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('id, name, team_id, api_player_id, updated_at')
    .eq('team_id', teamId);

  if (!dbPlayers || dbPlayers.length === 0) {
    console.log(`  ⚠️ 팀 ${teamId}의 데이터베이스 선수 없음`);
    return [];
  }

  // 2. API-Football에서 현재 스쿼드
  const squadData = await fetchAPIFootballData(`players/squads?team=${teamId}`);
  
  if (!squadData?.response?.[0]) {
    console.log(`  ⚠️ 팀 ${teamId}의 API 스쿼드 데이터 없음`);
    return [];
  }

  const apiPlayers = squadData.response[0].players || [];
  const apiPlayerIds = new Set(apiPlayers.map((p: any) => p.id));

  console.log(`  📊 DB: ${dbPlayers.length}명, API: ${apiPlayers.length}명`);

  // 3. DB에 있지만 API에 없는 선수들 (이탈 후보)
  for (const dbPlayer of dbPlayers) {
    if (dbPlayer.api_player_id && !apiPlayerIds.has(dbPlayer.api_player_id)) {
      const evidence = [];
      let confidence = 0.7; // 기본 신뢰도
      let detectionMethod = 'squad_comparison';
      
      // 증거 수집
      evidence.push(`API 스쿼드에서 제외됨`);
      
      // 최근 업데이트 시점 확인
      const lastUpdate = dbPlayer.updated_at ? new Date(dbPlayer.updated_at) : null;
      const daysSinceUpdate = lastUpdate ? 
        Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      
      if (daysSinceUpdate > 30) {
        evidence.push(`${daysSinceUpdate}일간 업데이트 없음`);
        confidence += 0.1;
      }

      // 이적시장 상황 고려
      const transferWindow = getTransferWindow();
      if (transferWindow.isOpen) {
        evidence.push(`${transferWindow.type} 이적시장 활성기`);
        confidence += 0.15;
        detectionMethod = 'transfer_window_analysis';
      }

      // 다른 팀에서 해당 선수 확인 (간단한 검색)
      let foundInOtherTeam = false;
      try {
        const searchData = await fetchAPIFootballData(`players?search=${encodeURIComponent(dbPlayer.name)}&league=292&season=2025`);
        if (searchData?.response?.length > 0) {
          const foundPlayer = searchData.response.find((p: any) => 
            p.player.id === dbPlayer.api_player_id && 
            p.statistics[0]?.team?.id !== teamId
          );
          
          if (foundPlayer) {
            foundInOtherTeam = true;
            evidence.push(`${foundPlayer.statistics[0].team.name}으로 이적 감지`);
            confidence = 0.95;
            detectionMethod = 'cross_team_verification';
          }
        }
      } catch (error) {
        console.log(`    검색 오류: ${error}`);
      }

      // 우선순위 결정
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (confidence >= 0.9) priority = 'high';
      else if (confidence <= 0.6) priority = 'low';

      // 추천 액션
      let recommendedAction: 'flag' | 'auto_update' | 'manual_review' = 'manual_review';
      if (foundInOtherTeam && confidence >= 0.9) {
        recommendedAction = 'flag'; // 이적 플래그
      } else if (confidence >= 0.8) {
        recommendedAction = 'flag';
      }

      detections.push({
        type: foundInOtherTeam ? 'departure' : 'retirement',
        player_id: dbPlayer.id,
        api_player_id: dbPlayer.api_player_id,
        player_name: dbPlayer.name,
        from_team_id: teamId,
        confidence,
        detection_method: detectionMethod,
        evidence,
        recommended_action: recommendedAction,
        priority
      });

      console.log(`  🚨 ${dbPlayer.name}: ${foundInOtherTeam ? '이적' : '은퇴'} 감지 (신뢰도: ${(confidence * 100).toFixed(1)}%)`);
    }
  }

  return detections;
}

async function detectPlayerArrivals(teamId: number): Promise<TransferDetection[]> {
  console.log(`🔍 팀 ${teamId} 신규 영입 감지...`);
  
  const detections: TransferDetection[] = [];
  
  // 1. API-Football에서 현재 스쿼드
  const squadData = await fetchAPIFootballData(`players/squads?team=${teamId}`);
  
  if (!squadData?.response?.[0]) {
    console.log(`  ⚠️ 팀 ${teamId}의 API 스쿼드 데이터 없음`);
    return [];
  }

  const apiPlayers = squadData.response[0].players || [];

  // 2. 데이터베이스에서 현재 등록된 선수들
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('api_player_id')
    .eq('team_id', teamId);

  const dbPlayerIds = new Set(dbPlayers?.map(p => p.api_player_id).filter(Boolean) || []);

  // 3. API에 있지만 DB에 없는 선수들 (영입 후보)
  for (const apiPlayer of apiPlayers) {
    if (!dbPlayerIds.has(apiPlayer.id)) {
      const evidence = [];
      let confidence = 0.8; // 기본 신뢰도
      let detectionMethod = 'new_squad_member';
      
      evidence.push(`API 스쿼드에 신규 등장`);
      
      // 이적시장 상황 고려
      const transferWindow = getTransferWindow();
      if (transferWindow.isOpen) {
        evidence.push(`${transferWindow.type} 이적시장 활성기`);
        confidence += 0.1;
        detectionMethod = 'transfer_window_signing';
      }

      // 선수의 이전 팀 정보 확인
      try {
        const playerHistory = await fetchAPIFootballData(`players?id=${apiPlayer.id}&season=2024`);
        if (playerHistory?.response?.length > 0) {
          const lastTeam = playerHistory.response[0].statistics[0]?.team;
          if (lastTeam && lastTeam.id !== teamId) {
            evidence.push(`${lastTeam.name}에서 이적`);
            confidence = 0.9;
            detectionMethod = 'confirmed_transfer';
          }
        }
      } catch (error) {
        console.log(`    히스토리 조회 오류: ${error}`);
      }

      // 우선순위 결정
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (confidence >= 0.9) priority = 'high';
      else if (confidence <= 0.7) priority = 'low';

      detections.push({
        type: 'arrival',
        api_player_id: apiPlayer.id,
        player_name: apiPlayer.name,
        to_team_id: teamId,
        confidence,
        detection_method: detectionMethod,
        evidence,
        recommended_action: confidence >= 0.85 ? 'auto_update' : 'manual_review',
        priority
      });

      console.log(`  ⭐ ${apiPlayer.name}: 신규 영입 감지 (신뢰도: ${(confidence * 100).toFixed(1)}%)`);
    }
  }

  return detections;
}

async function analyzeRecentTransfers(): Promise<TransferDetection[]> {
  console.log('🔍 최근 공식 이적 정보 분석...');
  
  const detections: TransferDetection[] = [];
  
  try {
    // API-Football의 최근 이적 정보 조회
    const transfersData = await fetchAPIFootballData('transfers?league=292');
    
    if (!transfersData?.response) {
      console.log('  ⚠️ 이적 정보 없음');
      return [];
    }

    const recentTransfers = transfersData.response.slice(0, 10); // 최근 10건
    console.log(`  📊 최근 이적: ${recentTransfers.length}건`);

    for (const transfer of recentTransfers) {
      const playerName = transfer.player.name;
      const playerId = transfer.player.id;
      const transferDate = new Date(transfer.date);
      const daysSince = Math.floor((Date.now() - transferDate.getTime()) / (1000 * 60 * 60 * 24));

      // 7일 이내의 최근 이적만 처리
      if (daysSince <= 7) {
        const evidence = [
          `공식 이적 발표 (${transferDate.toLocaleDateString()})`,
          `이적 유형: ${transfer.transfers[0]?.type || 'N/A'}`,
          `${daysSince}일 전 발생`
        ];

        // 출발팀과 도착팀 정보
        const fromTeam = transfer.teams.out;
        const toTeam = transfer.teams.in;

        if (fromTeam.id && toTeam.id) {
          detections.push({
            type: 'departure',
            api_player_id: playerId,
            player_name: playerName,
            from_team_id: fromTeam.id,
            to_team_id: toTeam.id,
            from_team_name: fromTeam.name,
            to_team_name: toTeam.name,
            confidence: 1.0, // 공식 발표이므로 100%
            detection_method: 'official_transfer_announcement',
            evidence,
            recommended_action: 'auto_update',
            priority: 'high'
          });

          console.log(`  ✅ ${playerName}: ${fromTeam.name} → ${toTeam.name} (${daysSince}일 전)`);
        }
      }
    }
  } catch (error) {
    console.error('❌ 이적 정보 분석 실패:', error);
  }

  return detections;
}

async function generateTransferAlert(detections: TransferDetection[], config: AlertConfig): Promise<void> {
  const highPriorityDetections = detections.filter(d => 
    d.priority === 'high' && d.confidence >= config.minConfidence
  );
  
  const alertDetections = config.onlyHighPriority ? highPriorityDetections : 
    detections.filter(d => d.confidence >= config.minConfidence);

  if (alertDetections.length === 0) {
    console.log('📢 알림 대상 없음');
    return;
  }

  console.log(`\n🚨 이적 알림 생성: ${alertDetections.length}건`);

  // 알림 메시지 생성
  const alertMessage = generateAlertMessage(alertDetections);
  
  // 데이터베이스에 알림 로그 저장
  await saveTransferAlerts(alertDetections);

  // 외부 알림 발송 (슬랙, 이메일 등)
  if (config.enableSlack && config.slackWebhook) {
    await sendSlackAlert(alertMessage, config.slackWebhook);
  }

  console.log(`✅ 알림 전송 완료`);
  console.log(alertMessage);
}

function generateAlertMessage(detections: TransferDetection[]): string {
  const transferWindow = getTransferWindow();
  const windowStatus = transferWindow.isOpen ? 
    `🔥 ${transferWindow.type.toUpperCase()} 이적시장 활성` : 
    `⏰ 다음 이적시장: ${transferWindow.startDate.toLocaleDateString()}`;

  let message = `🚨 K리그 선수 이동 감지 알림\n`;
  message += `${windowStatus}\n`;
  message += `📅 감지 시점: ${new Date().toLocaleString()}\n\n`;

  // 유형별 그룹화
  const departures = detections.filter(d => d.type === 'departure');
  const arrivals = detections.filter(d => d.type === 'arrival');
  const retirements = detections.filter(d => d.type === 'retirement');

  if (departures.length > 0) {
    message += `📤 이탈/이적 (${departures.length}건):\n`;
    departures.forEach(d => {
      const conf = (d.confidence * 100).toFixed(0);
      const destination = d.to_team_name ? ` → ${d.to_team_name}` : '';
      message += `  • ${d.player_name}${destination} (${conf}%)\n`;
    });
    message += '\n';
  }

  if (arrivals.length > 0) {
    message += `📥 신규 영입 (${arrivals.length}건):\n`;
    arrivals.forEach(d => {
      const conf = (d.confidence * 100).toFixed(0);
      const source = d.from_team_name ? `${d.from_team_name} → ` : '';
      message += `  • ${source}${d.player_name} (${conf}%)\n`;
    });
    message += '\n';
  }

  if (retirements.length > 0) {
    message += `🎌 은퇴 가능성 (${retirements.length}건):\n`;
    retirements.forEach(d => {
      const conf = (d.confidence * 100).toFixed(0);
      message += `  • ${d.player_name} (${conf}%)\n`;
    });
    message += '\n';
  }

  message += `🔗 상세 정보는 관리 대시보드에서 확인하세요.`;

  return message;
}

async function saveTransferAlerts(detections: TransferDetection[]): Promise<void> {
  try {
    const alertsToSave = detections.map(d => ({
      detection_type: d.type,
      player_name: d.player_name,
      api_player_id: d.api_player_id,
      from_team_id: d.from_team_id,
      to_team_id: d.to_team_id,
      confidence: d.confidence,
      priority: d.priority,
      evidence: JSON.stringify(d.evidence),
      recommended_action: d.recommended_action,
      detection_method: d.detection_method,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('transfer_alerts')
      .insert(alertsToSave);

    if (error) {
      console.error('❌ 알림 저장 실패:', error.message);
    } else {
      console.log(`✅ 알림 로그 저장: ${alertsToSave.length}건`);
    }
  } catch (error) {
    console.error('❌ 알림 저장 예외:', error);
  }
}

async function sendSlackAlert(message: string, webhookUrl: string): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
      throw new Error(`Slack 알림 실패: ${response.status}`);
    }

    console.log('✅ Slack 알림 전송 완료');
  } catch (error) {
    console.error('❌ Slack 알림 실패:', error);
  }
}

async function runTransferDetectionSystem() {
  console.log('🚀 이적 감지 및 알림 시스템 시작\n');

  const config: AlertConfig = {
    enableSlack: false, // 실제 사용시 true로 변경
    enableEmail: false,
    minConfidence: 0.7,
    onlyHighPriority: false
  };

  const transferWindow = getTransferWindow();
  console.log(`🗓️ 이적시장 상태: ${transferWindow.isOpen ? '활성' : '비활성'} (${transferWindow.type})`);
  if (!transferWindow.isOpen) {
    console.log(`  📅 다음 이적시장: ${transferWindow.startDate.toLocaleDateString()}`);
  }

  // K League 1 팀들 조회
  const teamsData = await fetchAPIFootballData('teams?league=292&season=2025');
  
  if (!teamsData?.response) {
    console.error('❌ 팀 데이터를 가져올 수 없습니다.');
    return;
  }

  console.log(`\n📊 분석 대상: ${teamsData.response.length}개 팀`);

  const allDetections: TransferDetection[] = [];

  // 공식 이적 정보 분석
  const officialTransfers = await analyzeRecentTransfers();
  allDetections.push(...officialTransfers);

  // 각 팀별 이적 감지 (처음 3개 팀만 테스트)
  for (const teamData of teamsData.response.slice(0, 3)) {
    const teamId = teamData.team.id;
    const teamName = teamData.team.name;
    
    console.log(`\n🏈 ${teamName} (${teamId}) 분석:`);

    try {
      // 선수 이탈 감지
      const departures = await detectPlayerDepartures(teamId);
      allDetections.push(...departures);

      // 신규 영입 감지
      const arrivals = await detectPlayerArrivals(teamId);
      allDetections.push(...arrivals);

      if (departures.length === 0 && arrivals.length === 0) {
        console.log(`  ✅ 변동사항 없음`);
      }
    } catch (error) {
      console.error(`❌ 팀 ${teamId} 분석 실패:`, error);
    }

    // API 호출 제한
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 알림 생성 및 전송
  if (allDetections.length > 0) {
    await generateTransferAlert(allDetections, config);
    
    console.log(`\n📊 감지 요약:`);
    console.log(`  총 감지: ${allDetections.length}건`);
    console.log(`  이탈: ${allDetections.filter(d => d.type === 'departure').length}건`);
    console.log(`  영입: ${allDetections.filter(d => d.type === 'arrival').length}건`);
    console.log(`  은퇴: ${allDetections.filter(d => d.type === 'retirement').length}건`);
    console.log(`  고우선순위: ${allDetections.filter(d => d.priority === 'high').length}건`);
  } else {
    console.log('\n🎉 감지된 이적 없음 - 모든 팀 안정적');
  }

  console.log('\n✅ 이적 감지 시스템 완료');
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  runTransferDetectionSystem().catch((error) => {
    console.error('❌ 이적 감지 시스템 실패:', error);
    process.exit(1);
  });
}

export { 
  runTransferDetectionSystem, 
  detectPlayerDepartures, 
  detectPlayerArrivals, 
  analyzeRecentTransfers 
};