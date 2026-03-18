# Security

Use the findings code SECURITY.

This review checks for security vulnerabilities in framework code. Because Aku is a server-side framework that handles HTTP requests, database queries, file storage, and user-supplied input, security defects can have severe consequences for applications built on it.

Focus on realistic, exploitable vulnerabilities rather than theoretical weaknesses. A finding should describe a concrete attack scenario: what an attacker would do, what input they would supply, and what the consequence would be.

## Research

Before starting the review, research security vulnerability lists and guidelines that are relevant to the code under review. For example:

- For HTTP handling code: research OWASP Top 10, HTTP security headers, request smuggling
- For database code: research SQL injection patterns, ORM security pitfalls, parameterised query best practices
- For storage code: research path traversal attacks, file upload vulnerabilities, symlink attacks
- For authentication/session code: research session fixation, timing attacks, credential storage best practices
- For any code that handles user input: research injection vectors relevant to the context
- Feel free to search multiple sources above and add your own sources

Use web search to find current vulnerability databases, security advisories, and best practice guides that apply to the specific technologies and patterns in the code under review. This research is in addition to your general security knowledge — the goal is to ensure coverage of known vulnerability classes that you might not otherwise consider.

## Classifying findings

- Classify **all** findings as `Impact: Major` and `Next step: Query`. Security issues require human judgement to assess risk in context, determine the appropriate mitigation strategy, and weigh security trade-offs against usability. Even when a fix appears straightforward, the human must validate that the fix is correct and complete, and that it does not introduce new issues.

## Criteria

You should use your general knowledge of application security in addition to the research described above to establish suitable criteria.

Security is particularly important to us and we are willing to spend extra tokens on review, use extended thinking / ultrathink to fully analyse and find issues.

Any data taken directly or indirectly from an external source should be assumed to be a carefully crafted payload intended to disrupt the application.

Prototype pollution, denial of service, denial of wallet, information disclosure and in general ANY undesirable effect on the operation of the program are ALL considered security issues.

