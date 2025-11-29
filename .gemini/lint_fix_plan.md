# Lint Fix Plan

## Remaining Issues (166 total: 107 errors, 59 warnings)

### Critical Errors to Fix:

1. **`react-hooks/set-state-in-effect`** (~20 errors)
   - Files: app/page.tsx, app/battle/page.tsx, components/chat/*, components/widgets/*
   - Solution: Move state initialization outside effects or use derived state

2. **`@typescript-eslint/no-explicit-any`** (~20 errors)
   - Files: utils/apiKeyEncryption.ts, utils/battleStorage.ts, hooks/use-manual-chat.ts, mcp/*
   - Solution: Define proper TypeScript types

3. **Unused variables** (~40 warnings)
   - Prefix with `_` to indicate intentionally unused

### Approach:

1. Fix all `any` types with proper TypeScript interfaces
2. Fix `react-hooks/set-state-in-effect` by using proper React patterns
3. Remove or prefix unused variables
4. Fix remaining minor issues

### Files to Fix (Priority Order):

1. ✅ utils/chatStorage.ts - Fixed ToolInvocation type, require()
2. ✅ utils/battleStorage.ts - Fixed require(), some unused vars
3. ⏳ utils/apiKeyEncryption.ts - Fix `any` types
4. ⏳ hooks/use-manual-chat.ts - Fix `any` type
5. ⏳ mcp/weather-tools.ts - Fix `any` types
6. ⏳ mcp/yahoo-finance-tools.ts - Fix `any` types
7. ⏳ app/page.tsx - Fix setState in effects
8. ⏳ app/battle/page.tsx - Fix setState in effects
9. ⏳ components/chat/* - Fix setState in effects
10. ⏳ components/widgets/* - Fix setState in effects
