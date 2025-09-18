# API-Football Widgets Integration Guide

## Overview

This document provides comprehensive guidance for integrating and maintaining API-Football widgets in the AllLeaguesFans application. The implementation provides real-time fixture updates with seamless integration into the existing React/TypeScript architecture.

## Architecture

### Components Structure

```
src/
├── components/
│   ├── APIFootballGamesWidget.tsx    # Main widget wrapper
│   └── EnhancedFixturesSection.tsx   # Hybrid display component
├── hooks/
│   └── useAPIFootballWidget.ts       # Widget management hooks
├── styles/
│   └── api-football-widget.css       # Dark theme styling
└── pages/
    └── LeaguePage.tsx               # Integration point
```

### Data Flow

```
Environment Variables → useAPIFootballKey Hook → APIFootballGamesWidget
                                               ↓
Script Loading → useAPIFootballWidget Hook → Widget Initialization
                                           ↓
API-Sports.io Widget Script → DOM Manipulation → Live Updates
```

## Implementation Details

### Core Components

#### APIFootballGamesWidget
- **Purpose**: React wrapper for API-Football Games widget
- **Features**: 
  - Script loading management
  - Error handling and loading states
  - API key validation
  - Dark theme integration
- **Props**:
  - `leagueId`: League identifier (292 for K League 1, 293 for K League 2)
  - `season`: Season year (e.g., 2025)
  - `className`: Additional styling classes

#### EnhancedFixturesSection
- **Purpose**: Hybrid component providing both database and live data
- **Features**:
  - Tab-based interface
  - Seamless switching between data sources
  - Preserves existing functionality
  - Responsive design

### Custom Hooks

#### useAPIFootballWidget
- **Purpose**: Manages widget script loading
- **Features**:
  - Prevents duplicate script loading
  - Error handling for script failures
  - Loading state management
- **Returns**:
  - `scriptLoaded`: Boolean indicating script availability
  - `error`: Error message if script loading fails

#### useAPIFootballKey
- **Purpose**: Secure API key management
- **Features**:
  - Environment variable validation
  - Masked key display for security
  - Key existence checking
- **Returns**:
  - `apiKey`: Raw API key for widget use
  - `hasApiKey`: Boolean indicating key availability
  - `keyMasked`: Safely masked key for logging

## Configuration

### Environment Variables

```bash
# Required for widget functionality
VITE_API_FOOTBALL_KEY=your-api-football-key

# Domain restriction setup in API-Football dashboard
# Development: localhost:5173, localhost:3000
# Production: your-actual-domain.com
```

### Widget Data Attributes

The widget system uses specific data attributes for initialization:

```html
<div
  id="wg-api-football-games-{leagueId}"
  data-host="v3.football.api-sports.io" 
  data-key="{apiKey}"
  data-league="{leagueId}"
  data-season="{season}"
  data-theme="dark"
  data-refresh="15"
  data-show-toolbar="true"
  data-show-errors="false"
  data-show-logos="true"
  data-modal-game="true"
  data-modal-standings="true"
  className="api-football-widget"
>
</div>
```

### Styling Integration

The widget uses custom CSS for dark theme integration:

```css
/* Key styling classes applied */
.api-football-widget {
  color-scheme: dark;
  /* Inherits font-family and colors from parent */
}

/* Custom overrides for API-Football elements */
.api-football-widget [class*="widget"] {
  background-color: transparent !important;
  color: #e2e8f0 !important; /* text-slate-200 */
}
```

## Integration Guide

### Basic Integration

1. **Import Components**:
```tsx
import APIFootballGamesWidget from '@/components/APIFootballGamesWidget';
import { useAPIFootballWidget } from '@/hooks/useAPIFootballWidget';
```

2. **Use in Component**:
```tsx
<APIFootballGamesWidget 
  leagueId={292}  // K League 1
  season={2025}
  className="additional-styles"
/>
```

3. **Handle Loading States**:
```tsx
const { scriptLoaded, error } = useAPIFootballWidget();

if (error) return <ErrorDisplay message={error} />;
if (!scriptLoaded) return <LoadingSpinner />;
```

### Advanced Integration (Hybrid Approach)

```tsx
import EnhancedFixturesSection from '@/components/EnhancedFixturesSection';

// In your page component
<EnhancedFixturesSection
  leagueId={leagueId}
  season={season}
  upcomingFixtures={databaseFixtures}
/>
```

## Error Handling

### Common Error Scenarios

1. **Missing API Key**:
   - Display: "⚠️ 설정 필요 - API-Football 키가 설정되지 않았습니다"
   - Solution: Set `VITE_API_FOOTBALL_KEY` environment variable

2. **Script Loading Failure**:
   - Display: "❌ 위젯 로딩 실패"
   - Possible causes: Network issues, CDN unavailability, domain restrictions

3. **Widget Initialization Failure**:
   - Causes: Invalid league ID, API key restrictions, quota exceeded
   - Solution: Check API-Football dashboard for key status and usage

### Error Recovery

```tsx
const { error } = useAPIFootballWidget();

if (error) {
  // Fallback to database-driven display
  return <UpcomingFixturesCard fixtures={upcomingFixtures} />;
}
```

## Security Considerations

### API Key Protection

1. **Environment Variables**: Never commit API keys to repository
2. **Domain Restrictions**: Configure allowed domains in API-Football dashboard
3. **Key Rotation**: Regular key rotation for production environments
4. **Masked Logging**: Use `keyMasked` for safe logging

### Content Security Policy

Consider CSP adjustments for widget script loading:

```http
Content-Security-Policy: script-src 'self' https://widgets.api-sports.io;
```

## Performance Optimization

### Script Loading
- Single script instance prevents duplicate network requests
- Lazy loading with useEffect ensures optimal timing
- Error boundaries prevent widget failures from crashing application

### Widget Configuration
- `data-refresh="15"`: Balanced update frequency
- `data-show-errors="false"`: Prevents user-facing API errors
- Conditional rendering based on script availability

## Testing

### Development Testing

```bash
# Start development server
pnpm dev

# Navigate to league page
# Check browser console for widget loading messages
# Test both tab interfaces (Database vs Live)
```

### Production Testing

1. **API Key Validation**: Ensure production key has correct domain restrictions
2. **Network Connectivity**: Test widget loading under various network conditions  
3. **Error States**: Verify graceful degradation when API unavailable
4. **Mobile Responsiveness**: Test widget behavior on mobile devices

## Troubleshooting

### Widget Not Displaying

1. Check browser console for JavaScript errors
2. Verify `VITE_API_FOOTBALL_KEY` is set correctly
3. Confirm domain is allowed in API-Football dashboard
4. Check network tab for script loading issues

### Styling Issues

1. Verify `api-football-widget.css` is imported in `main.tsx`
2. Check CSS specificity conflicts
3. Ensure dark theme variables are properly applied
4. Test with browser developer tools for CSS override issues

### API Quota Issues

1. Monitor API usage in API-Football dashboard
2. Implement usage tracking if needed
3. Consider caching strategies for high-traffic scenarios
4. Plan for quota exhaustion fallbacks

## Future Enhancements

### Planned Widgets

1. **Standings Widget**: League table with real-time updates
2. **Game Widget**: Detailed match information and live scores
3. **Player Stats Widget**: Individual player performance metrics

### Enhancement Opportunities

1. **Caching Layer**: Implement client-side caching for API responses
2. **Offline Support**: Progressive Web App features for offline viewing
3. **Customization Options**: User preferences for update frequency
4. **Analytics Integration**: Track widget usage and user interaction patterns

## Support and Maintenance

### Regular Maintenance Tasks

1. **API Key Rotation**: Update keys before expiration
2. **Dependency Updates**: Keep widget script version current
3. **Performance Monitoring**: Track widget loading times
4. **Error Logging**: Monitor widget-related errors in production

### Documentation Updates

- Update this guide when adding new widgets
- Maintain API endpoint documentation
- Document any breaking changes in widget API
- Keep troubleshooting section current with new issues

## Resources

- **API-Football Documentation**: [https://www.api-football.com/documentation-v3](https://www.api-football.com/documentation-v3)
- **Widget Documentation**: Included in `api-football documents.txt`
- **React Integration Patterns**: Internal component documentation
- **Styling Guidelines**: Tailwind CSS documentation for consistent theming