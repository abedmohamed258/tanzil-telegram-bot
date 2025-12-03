# Known Vulnerabilities

## Overview

This document tracks known security vulnerabilities in dependencies that cannot be immediately resolved due to upstream dependencies.

## Current Known Issues

### node-telegram-bot-api Transitive Dependencies

**Status**: ⚠️ **ACCEPTED RISK** (as of December 2025)

**Affected Packages**:

- `form-data` <2.5.4 (CRITICAL)
- `request` <=2.88.2 (CRITICAL)
- `tough-cookie` <4.1.3 (MODERATE)
- `@cypress/request-promise` (MODERATE)
- `request-promise-core` (MODERATE)

**Details**:
The `node-telegram-bot-api` library (v0.64.0-0.66.0) depends on the deprecated `request` package and its ecosystem, which have known vulnerabilities:

1. **form-data** - Uses unsafe random function for choosing boundary
   - CVE: GHSA-fjxv-7rqg-78g4
   - Severity: CRITICAL
   - Impact: Potential boundary collision in multipart form data

2. **request** - Server-Side Request Forgery vulnerability
   - CVE: GHSA-p8p7-x288-28g6
   - Severity: MODERATE (escalated to CRITICAL via form-data)
   - Impact: Potential SSRF attacks

3. **tough-cookie** - Prototype Pollution vulnerability
   - CVE: GHSA-72xf-g2v4-qvf3
   - Severity: MODERATE
   - Impact: Potential prototype pollution

**Risk Assessment**:

✅ **LOW ACTUAL RISK** because:

1. The bot only sends requests to Telegram's official API (api.telegram.org)
2. User input is validated before being used in any requests
3. The bot does not accept arbitrary URLs from users for the request library
4. File uploads are handled through Telegram's API, not directly via form-data
5. The bot runs in a controlled environment, not exposed to untrusted input

**Mitigation Measures**:

1. ✅ Input validation implemented (see `src/utils/InputValidator.ts`)
2. ✅ URL validation restricts requests to known safe domains
3. ✅ No user-controlled URLs are passed to the request library
4. ✅ File handling is done through Telegram's secure API
5. ✅ Environment variables used for all sensitive configuration

**Upstream Status**:

- The `request` package is deprecated and no longer maintained
- The `node-telegram-bot-api` maintainers are aware of the issue
- Migration to modern alternatives (like `axios` or `node-fetch`) is in progress upstream
- Issue tracking: https://github.com/yagop/node-telegram-bot-api/issues

**Action Plan**:

1. ✅ Document the known vulnerabilities (this file)
2. ✅ Implement comprehensive input validation
3. ✅ Monitor upstream for updates
4. 🔄 Consider migrating to alternative Telegram bot libraries if issue persists
5. 🔄 Regularly check for updates: `npm outdated node-telegram-bot-api`

**Alternative Libraries** (for future consideration):

- `telegraf` - Modern, actively maintained, uses `node-fetch`
- `grammy` - Lightweight, modern, no deprecated dependencies
- `node-telegram-bot-api-updated` - Community fork with updated dependencies

**Review Date**: December 2025
**Next Review**: March 2026 or when upstream releases fix

## Monitoring

Run the following command to check for updates:

```bash
npm audit
npm outdated node-telegram-bot-api
```

## References

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Snyk Vulnerability Database](https://snyk.io/vuln/)
