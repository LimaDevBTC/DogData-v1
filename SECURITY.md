# Security policy

DOG CITY is a browser game with Bitcoin wallet sign-in. If you believe you have found a security problem, please report it privately and give
us time to fix it before you talk about it publicly.

## How to report

**Contact: not defined yet. The project owner must fill this in before this file is published.**

GitHub private vulnerability reporting is the intended channel, but as of 2026-11-05 it is turned off on this project's repositories. Until it is
on, or an address is published here, do not post details in a public issue, chat or social post. Open a public issue that only says you have a
security report and asks for a private channel.

Please include what you found, how to reproduce it, the impact you expect, and whether anyone else knows about it.

## What is in scope

- The game at `play.dogcity.space` and the landing at `dogcity.space`
- The API at `www.dogdata.xyz/api/*`
- Sign-in, sessions, profile and chat
- Multiplayer messages

The mint at `mint.dogcity.space`, third-party wallets, swap venues and Bitcoin itself are separate systems. Tell us if you find something there, but we may
have to pass it to whoever runs them.

## Please do

- Test only with your own accounts and wallets.
- Stop as soon as you have enough to show the problem.
- Tell us if you touched data that is not yours, and do not keep it.

## Please do not

- Read or change another person's data.
- Run denial-of-service or load tests, or send spam in chat or multiplayer channels.
- Move funds that are not yours.
- Use social engineering on players or team members.

## What to expect

We do not currently promise a response time or run a paid bounty, and we do not guarantee that a report will be accepted. We will not pursue anyone who follows
this policy in good faith.

## Things that are expected, not vulnerabilities

- The game client is public code running on your machine, so a modified client can change what it shows you.
- DC Points, the backpack and the local game save are preview data held by the client. They have no financial value and cannot be converted or transferred.
- The Supabase publishable key in the client is public by design. Database access is restricted by row-level security.
