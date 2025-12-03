# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The Tanzil Bot team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

### Where to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**[INSERT YOUR SECURITY EMAIL HERE]**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Include

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

### What to Expect

After you submit a report, we will:

1. **Acknowledge receipt** within 48 hours
2. **Confirm the problem** and determine affected versions
3. **Audit code** to find any similar problems
4. **Prepare fixes** for all supported versions
5. **Release patches** as soon as possible

We will keep you informed of our progress throughout the process.

### Disclosure Policy

- Security issues are disclosed publicly after a fix is released
- We will credit you in the release notes unless you prefer to remain anonymous
- We ask that you do not publicly disclose the issue until we have released a fix

## Security Best Practices for Users

### Environment Variables

- Never commit your `.env` file to version control
- Use strong, unique values for all tokens and keys
- Rotate credentials regularly
- Use the **service_role** key for Supabase, not the anon key

### Bot Token

- Keep your Telegram bot token secret
- Regenerate immediately if exposed
- Never share your token in public channels or repositories

### Session String

- Keep your Telegram session string private
- Never commit `session.txt` to version control
- Regenerate if compromised

### Server Security

- Use HTTPS for webhooks in production
- Implement rate limiting
- Keep dependencies up to date
- Monitor logs for suspicious activity
- Use a firewall to restrict access

### Database Security

- Use Row Level Security (RLS) policies
- Never expose your Supabase service_role key
- Regularly backup your database
- Monitor for unusual query patterns

## Known Security Considerations

### Dependency Vulnerabilities

As of December 1, 2025, there are known vulnerabilities in transitive dependencies of `node-telegram-bot-api`:

- **form-data** < 2.5.4 (Critical)
- **tough-cookie** < 4.1.3 (Moderate)

These are being monitored and will be addressed when upstream fixes are available. The risk is considered medium as the vulnerabilities are in transitive dependencies and not directly exploitable in our usage.

### Mitigation

- Input validation is implemented for all user inputs
- Rate limiting prevents abuse
- Admin commands are properly protected
- Database queries use parameterized statements

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.1, 1.0.2) and announced via:

- GitHub Security Advisories
- Release notes
- README.md

## Bug Bounty Program

We do not currently have a bug bounty program. However, we deeply appreciate security researchers who responsibly disclose vulnerabilities to us.

## Contact

For security-related questions or concerns, please contact:

**[INSERT YOUR SECURITY EMAIL HERE]**

For general questions, please use GitHub Issues or Discussions.

## Acknowledgments

We would like to thank the following individuals for responsibly disclosing security issues:

- [List will be updated as issues are reported and fixed]

---

**Last Updated**: December 1, 2025
