# API-Football 기반 새로운 데이터베이스 스키마 설계

## 🔍 현재 구조의 문제점 분석

### 1. 데이터 무결성 문제
- **events 테이블**: `(fixture_id, player_id, type, minute)` 유니크 제약조건 없음 → 중복 데이터 140만+ 개
- **시간 필드 불일치**: API의 `elapsed` vs DB의 `minute`
- **teams 정보**: fixtures에서만 참조, 독립적인 teams 테이블과 불일치

### 2. 정규화 문제
- **팀 정보 중복**: team_id로만 참조하지만 실제 team 데이터가 fixtures와 분리되어 있음
- **리그 정보**: API-Football 구조와 맞지 않는 단순한 leagues 테이블

## 🎯 API-Football 표준 구조 분석

### API 엔드포인트별 데이터 구조

#### 1. `/leagues` 엔드포인트
```json
{
  "league": {
    "id": 292,
    "name": "K League 1",
    "country": "South-Korea", 
    "logo": "https://media.api-sports.io/football/leagues/292.png",
    "flag": "https://media.api-sports.io/flags/kr.svg",
    "season": 2025,
    "type": "League"
  },
  "country": {
    "name": "South-Korea",
    "code": "KR",
    "flag": "https://media.api-sports.io/flags/kr.svg"
  },
  "seasons": [
    { "year": 2025, "start": "2025-02-28", "end": "2025-11-30", "current": true }
  ]
}
```

#### 2. `/teams` 엔드포인트
```json
{
  "team": {
    "id": 2762,
    "name": "Jeonbuk Motors",
    "code": "JEO", 
    "country": "South-Korea",
    "founded": 1994,
    "national": false,
    "logo": "https://media.api-sports.io/football/teams/2762.png"
  },
  "venue": {
    "id": 1007,
    "name": "Jeonju World Cup Stadium",
    "address": "Jeonju",
    "city": "Jeonju",
    "capacity": 42477,
    "surface": "grass",
    "image": "https://media.api-sports.io/football/venues/1007.png"
  }
}
```

#### 3. `/players` 엔드포인트
```json
{
  "player": {
    "id": 34427,
    "name": "Jeon Jin-Woo",
    "firstname": "Jin-Woo",
    "lastname": "Jeon",
    "age": 28,
    "birth": {
      "date": "1996-01-15",
      "place": "South-Korea",
      "country": "South-Korea"
    },
    "nationality": "South-Korea", 
    "height": "177 cm",
    "weight": "71 kg",
    "injured": false,
    "photo": "https://media.api-sports.io/football/players/34427.png"
  },
  "statistics": [{
    "team": { "id": 2762, "name": "Jeonbuk Motors" },
    "league": { "id": 292, "name": "K League 1", "country": "South-Korea" },
    "games": {
      "appearences": 28, "lineups": 26, "minutes": 2340, "number": 10, "position": "Midfielder", "rating": "7.25", "captain": false
    },
    "substitutes": { "in": 2, "out": 8, "bench": 2 },
    "shots": { "total": 58, "on": 24 },
    "goals": { "total": 14, "conceded": 0, "assists": 4, "saves": 0 },
    // ... 더 많은 통계
  }]
}
```

#### 4. `/fixtures` 엔드포인트
```json
{
  "fixture": {
    "id": 1340701,
    "referee": "Jeong Dong-Sik",
    "timezone": "UTC",
    "date": "2025-03-01T07:30:00+00:00",
    "timestamp": 1709282200,
    "periods": { "first": 1709282200, "second": 1709285800 },
    "venue": { "id": 1007, "name": "Jeonju World Cup Stadium", "city": "Jeonju" },
    "status": { "long": "Match Finished", "short": "FT", "elapsed": 90 }
  },
  "league": { "id": 292, "name": "K League 1", "country": "South-Korea", "logo": "...", "flag": "...", "season": 2025, "round": "Regular Season - 1" },
  "teams": {
    "home": { "id": 2762, "name": "Jeonbuk Motors", "logo": "...", "winner": null },
    "away": { "id": 2750, "name": "Daejeon Citizen", "logo": "...", "winner": null }
  },
  "goals": { "home": 1, "away": 1 },
  "score": {
    "halftime": { "home": 0, "away": 1 },
    "fulltime": { "home": 1, "away": 1 },
    "extratime": { "home": null, "away": null },
    "penalty": { "home": null, "away": null }
  }
}
```

#### 5. `/fixtures/events` 엔드포인트
```json
{
  "time": { "elapsed": 32, "extra": null },
  "team": { "id": 2750, "name": "Daejeon Citizen", "logo": "..." },
  "player": { "id": 34427, "name": "Joo Min-Kyu" },
  "assist": { "id": 99211, "name": "Kim Hyun-Woo" },
  "type": "Goal",
  "detail": "Normal Goal",
  "comments": null
}
```

## 🏗️ 새로운 데이터베이스 스키마 설계

### 1. COUNTRIES 테이블
```sql
CREATE TABLE countries (
  code VARCHAR(2) PRIMARY KEY,           -- 'KR', 'JP'
  name VARCHAR(100) NOT NULL,            -- 'South-Korea'
  flag_url TEXT,                         -- API 플래그 URL
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. LEAGUES 테이블 (재설계)
```sql
CREATE TABLE leagues (
  id INTEGER PRIMARY KEY,                -- API league ID (292, 293)
  name VARCHAR(100) NOT NULL,            -- 'K League 1'
  country_code VARCHAR(2) REFERENCES countries(code),
  type VARCHAR(50),                      -- 'League', 'Cup'
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. SEASONS 테이블 (수정)
```sql
CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  league_id INTEGER REFERENCES leagues(id),
  year INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(league_id, year)
);
```

### 4. VENUES 테이블 (신규)
```sql
CREATE TABLE venues (
  id INTEGER PRIMARY KEY,                -- API venue ID
  name VARCHAR(100) NOT NULL,            -- 'Jeonju World Cup Stadium'
  address TEXT,
  city VARCHAR(50),
  country_code VARCHAR(2) REFERENCES countries(code),
  capacity INTEGER,
  surface VARCHAR(20),                   -- 'grass', 'artificial'
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5. TEAMS 테이블 (수정)
```sql
CREATE TABLE teams (
  id INTEGER PRIMARY KEY,                -- API team ID
  name VARCHAR(100) NOT NULL,
  code VARCHAR(3),                       -- 'JEO', 'DAE'
  short_name VARCHAR(20),
  country_code VARCHAR(2) REFERENCES countries(code),
  founded INTEGER,
  is_national BOOLEAN DEFAULT false,
  venue_id INTEGER REFERENCES venues(id),
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 6. PLAYERS 테이블 (수정)
```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY,                -- API player ID
  name VARCHAR(100) NOT NULL,
  firstname VARCHAR(50),
  lastname VARCHAR(50),
  nationality VARCHAR(50),
  birth_date DATE,
  birth_place VARCHAR(100),
  birth_country VARCHAR(100),
  height_cm INTEGER,
  weight_kg INTEGER,
  foot VARCHAR(5),                       -- 'Left', 'Right'
  is_injured BOOLEAN DEFAULT false,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 7. SQUAD_MEMBERSHIPS 테이블 (유지/수정)
```sql
CREATE TABLE squad_memberships (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  player_id INTEGER REFERENCES players(id),
  league_id INTEGER REFERENCES leagues(id),
  season_year INTEGER,
  jersey_number INTEGER,
  position VARCHAR(20),                  -- 'Midfielder', 'Defender'
  is_captain BOOLEAN DEFAULT false,
  is_on_loan BOOLEAN DEFAULT false,
  joined_at DATE,
  left_at DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, season_year, player_id),
  FOREIGN KEY (league_id, season_year) REFERENCES seasons(league_id, year)
);
```

### 8. FIXTURES 테이블 (수정)
```sql
CREATE TABLE fixtures (
  id BIGINT PRIMARY KEY,                 -- API fixture ID
  league_id INTEGER REFERENCES leagues(id),
  season_year INTEGER,
  round VARCHAR(50),                     -- 'Regular Season - 1'
  kickoff_utc TIMESTAMP,
  timezone VARCHAR(50),                  -- 'UTC', 'Asia/Seoul'
  venue_id INTEGER REFERENCES venues(id),
  referee VARCHAR(100),
  
  -- Status
  status_short VARCHAR(5),               -- 'FT', 'NS', 'LIVE'
  status_long VARCHAR(50),               -- 'Match Finished'
  elapsed_minutes INTEGER,               -- 실제 경기 진행 시간
  
  -- Teams
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  
  -- Goals
  goals_home INTEGER,
  goals_away INTEGER,
  
  -- Score breakdown
  ht_home INTEGER,                       -- Halftime
  ht_away INTEGER,
  ft_home INTEGER,                       -- Fulltime
  ft_away INTEGER,
  et_home INTEGER,                       -- Extratime
  et_away INTEGER,
  pk_home INTEGER,                       -- Penalty
  pk_away INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (league_id, season_year) REFERENCES seasons(league_id, year)
);
```

### 9. EVENTS 테이블 (완전 재설계) ⭐ 핵심
```sql
CREATE TABLE fixture_events (
  id BIGSERIAL PRIMARY KEY,
  fixture_id BIGINT REFERENCES fixtures(id),
  team_id INTEGER REFERENCES teams(id),
  player_id INTEGER REFERENCES players(id),
  assist_player_id INTEGER REFERENCES players(id),
  
  -- 시간 정보 (API 표준)
  elapsed_minutes INTEGER NOT NULL,      -- API의 elapsed 그대로 사용
  extra_minutes INTEGER,                 -- API의 extra
  
  -- 이벤트 정보
  event_type VARCHAR(20) NOT NULL,       -- 'Goal', 'Card', 'substitution'
  event_detail VARCHAR(50),              -- 'Normal Goal', 'Yellow Card'
  comments TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- 🔥 중복 방지 핵심 제약조건
  UNIQUE(fixture_id, player_id, event_type, elapsed_minutes, event_detail)
);

-- 인덱스 최적화
CREATE INDEX idx_fixture_events_fixture ON fixture_events(fixture_id);
CREATE INDEX idx_fixture_events_player ON fixture_events(player_id);
CREATE INDEX idx_fixture_events_type ON fixture_events(event_type);
CREATE INDEX idx_fixture_events_time ON fixture_events(elapsed_minutes);
```

### 10. STANDINGS 테이블 (수정)
```sql
CREATE TABLE standings (
  id SERIAL PRIMARY KEY,
  league_id INTEGER REFERENCES leagues(id),
  season_year INTEGER,
  team_id INTEGER REFERENCES teams(id),
  
  -- 순위 정보
  rank INTEGER NOT NULL,
  points INTEGER NOT NULL,
  goals_for INTEGER,
  goals_against INTEGER,
  goal_difference INTEGER,
  
  -- 경기 통계
  games_played INTEGER,
  games_won INTEGER,
  games_drawn INTEGER,
  games_lost INTEGER,
  
  -- 기타
  form VARCHAR(10),                      -- 'WDLWW'
  group_name VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(league_id, season_year, team_id),
  FOREIGN KEY (league_id, season_year) REFERENCES seasons(league_id, year)
);
```

### 11. LINEUPS & LINEUP_PLAYERS (기존 유지, 약간 수정)
```sql
-- 기존 구조가 API와 잘 맞음, 유지
```

## 🔧 마이그레이션 전략

### 1단계: 백업 및 준비
- 현재 데이터 전체 백업
- 새 스키마 테스트 환경 구축

### 2단계: 새 테이블 생성
- countries, venues 테이블 먼저 생성 및 데이터 입력
- leagues, teams 테이블 재구축
- fixture_events 테이블을 events 대신 생성

### 3단계: 데이터 마이그레이션
- teams 데이터 API에서 새로 가져오기
- fixtures 데이터 새 구조로 변환
- **events 데이터는 완전히 새로 임포트** (중복 제거 효과)

### 4단계: 애플리케이션 코드 수정
- API 쿼리를 새 테이블 구조에 맞게 수정
- events → fixture_events 테이블명 변경
- minute → elapsed_minutes 필드명 변경

### 5단계: 검증
- 공식 K-League 데이터와 비교 검증
- 중복 데이터 완전 제거 확인

## 🎯 핵심 개선점

1. **완벽한 중복 방지**: `(fixture_id, player_id, event_type, elapsed_minutes, event_detail)` 유니크 제약조건
2. **API 표준 준수**: 모든 필드가 API-Football 응답 구조와 1:1 매칭
3. **완전한 정규화**: 국가, 경기장, 팀 정보의 중복 제거
4. **확장 가능성**: 다른 리그 추가시에도 유연하게 대응
5. **성능 최적화**: 적절한 인덱스와 외래키 구조