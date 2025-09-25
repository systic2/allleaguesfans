# GitHub Actions 3-API 데이터 동기화 문제 해결 가이드

## 🔍 진단 결과

GitHub Actions의 3-API 데이터 동기화에서 발생한 문제를 분석한 결과, 다음과 같은 원인들을 파악했습니다:

### 주요 문제점
1. **API 키 누락 또는 만료**: TheSportsDB 및 Highlightly API 키가 GitHub Secrets에 제대로 설정되지 않았거나 만료됨
2. **환경 변수 불일치**: 스크립트가 요구하는 환경 변수와 워크플로우에서 제공하는 변수 간 불일치
3. **오류 시 전체 실패**: 하나의 API 실패 시 전체 동기화가 중단되는 구조적 문제

## 🛠️ 적용된 수정사항

### 1. 견고한 방어 로직 구현
- **새 스크립트**: `robust-triple-api-migration.ts`
- **핵심 기능**: API 키 누락 시에도 K League 기본 데이터로 서비스 지속
- **Fallback 전략**: 3-API → K League 단독 → 기본 서비스 보장

```typescript
// API 키 상태에 따른 적응형 동작
🇰🇷 K League API: ✅ 항상 사용 가능 (무료 공개 API)
🏟️ TheSportsDB: API 키 있음 → 사용 / 없음 → 건너뛰기
⚡ Highlightly: API 키 있음 → 사용 / 없음 → 건너뛰기
```

### 2. 워크플로우 개선
- **환경 변수 검증**: 실행 전 모든 API 키 상태 확인
- **진단 도구 추가**: `debug-api-connections.ts`로 연결 상태 실시간 확인
- **Fallback 로직**: 실패 시 `emergency-kleague-migration.ts`로 자동 전환

### 3. 상세한 오류 진단
- **API 연결 테스트**: 각 API별 개별 상태 확인
- **오류 분류**: 401 (인증), 429 (할당량), 500 (서버) 등 상세 분석
- **복구 가이드**: 문제별 구체적 해결 방안 제시

## 📋 GitHub Secrets 설정 확인

다음 Secrets이 Repository Settings에 올바르게 설정되어 있는지 확인하세요:

### 필수 Secrets (Supabase)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key  # RLS 우회 권한 필요
SUPABASE_ANON_KEY=your-anon-key
```

### 선택적 Secrets (3-API 통합)
```
THESPORTSDB_API_KEY=your-thesportsdb-key     # 팀 로고, 메타데이터용
HIGHLIGHTLY_API_KEY=your-highlightly-key     # 실시간 데이터용
```

## 🚀 수동 실행으로 테스트

GitHub Actions에서 문제를 확인하려면:

1. **Actions 탭** → **3-API 통합 데이터 동기화** 워크플로우 선택
2. **Run workflow** 버튼 클릭하여 수동 실행
3. **Logs 확인**:
   ```
   🔑 API 키 상태:
   🇰🇷 K League Official API: ✅ Free (항상 사용 가능)
   🏟️ TheSportsDB Premium: ✅ 사용 가능 / ⚠️ 누락 (K League로 대체)
   ⚡ Highlightly API: ✅ 사용 가능 / ⚠️ 누락 (K League로 대체)
   ```

## 🔧 일반적인 문제 해결

### 401 Unauthorized 오류
**원인**: API 키가 잘못되었거나 만료됨
**해결**: GitHub Secrets에서 해당 API 키 재설정

### RLS Policy 위반 오류
**원인**: `SUPABASE_SERVICE_ROLE` 대신 `ANON_KEY` 사용
**해결**: 워크플로우에서 SERVICE_ROLE 키 사용 확인

### 환경 변수 누락 오류
**원인**: GitHub Secrets이 설정되지 않음
**해결**: Repository Settings → Secrets and variables → Actions에서 설정

### API 할당량 초과
**원인**: TheSportsDB/Highlightly API 사용량 한도 초과
**해결**: API 제공업체에서 할당량 확인 및 업그레이드

## 📈 서비스 연속성 보장

새로운 견고한 시스템의 장점:

1. **기본 서비스 보장**: K League API만으로도 핵심 기능 유지
2. **점진적 향상**: API 키 추가 시 자동으로 기능 확장
3. **무중단 운영**: 하나의 API 실패가 전체 서비스에 영향 주지 않음
4. **투명한 상태**: 각 API별 상태를 명확히 표시

## 🎯 권장사항

### 즉시 조치
1. GitHub Secrets의 모든 API 키 재확인
2. 수동 워크플로우 실행으로 현재 상태 파악
3. Logs에서 구체적 오류 메시지 확인

### 장기적 개선
1. TheSportsDB Premium 구독으로 팀 로고 품질 향상
2. Highlightly API로 실시간 데이터 경험 개선
3. 정기적인 API 키 갱신 프로세스 구축

## 📞 추가 지원

문제가 지속되면 다음 정보와 함께 문의하세요:
- GitHub Actions 워크플로우 실행 로그
- 사용 중인 API 키들의 상태 (마스킹된 형태)
- 발생한 구체적인 오류 메시지
- 예상 동작과 실제 동작의 차이점

---

**🛡️ 현재 상태**: 견고한 방어 시스템으로 업그레이드 완료
**📊 안정성**: 3-API 완전 → K League 기본 → 서비스 지속 보장
**🚀 다음 단계**: GitHub Actions 수동 실행으로 수정사항 검증