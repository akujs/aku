# Acknowledgements

This project builds upon ideas and code from several excellent open-source projects. We are grateful to their authors and contributors.

## Laravel

**Website:** https://laravel.com/
**License:** MIT
**Copyright:** Taylor Otwell and contributors

Laravel has been a huge source of inspiration for Aku's overall design and architecture. Often the implementation of each feature ends up very different, since Laravel's PHP patterns don't translate well to TypeScript. But there isn't a feature in Aku that didn't at least start with wondering how Laravel handles the same.

## Hono

**Repository:** https://github.com/honojs/hono
**License:** MIT
**Copyright:** Yusuke Wada and contributors

Hono inspired the design of Aku's JSX renderer. Portions of our JSX renderer tests have been directly adapted from Hono's tests to ensure compatibility and correctness. The implementation itself is original to Aku.

## Rou3

**Repository:** https://github.com/h3js/rou3
**License:** MIT
**Copyright:** Pooya Parsa

Aku's routing engine is a fork of Rou3, adapted for our specific requirements. The core radix tree algorithm remains largely unchanged from the original implementation.

## content-disposition

**Repository:** https://github.com/jshttp/content-disposition
**License:** MIT
**Copyright:** Douglas Christopher Wilson

Aku's RFC 5987 value/attribute header implementation is a fork of the content-disposition package with modifications for our use case.

---

All incorporated code is used in compliance with the MIT License terms, which require preservation of copyright notices and license text in distributed copies.
