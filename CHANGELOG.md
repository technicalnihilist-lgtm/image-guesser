# Changelog

## 2.0.0 — 7 November 2026

The big one: one app, five games, one wallet.

**New modes**
- **Sound Guesser** — 37 licensed recordings from Wikimedia Commons (animals, instruments, vehicles,
  human, nature, everyday), replay + volume control + waveform animation + 30s timer, credit per clip.
- **Find the Difference** — differences generated at known coordinates and drawn onto the second
  photo, so every puzzle is solvable. Easy 5 → Expert 15 differences, timer, hint, zoom, tap detection.
- **Colour Sort Master** — glass tubes and balls, undo/restart/hint, move counter, timer, level
  progression up to 10 colours. Levels are built by undoing legal moves, so they are always solvable.
- **Math Master** — six difficulties, 16 question types (arithmetic, patterns, missing numbers,
  equations, percentages, roots, sequences, averages), four options or typed answers, per-question
  timer, worked explanations, time attack and a daily five.

**Economy & progression**
- One shared coin wallet across all five modes (+10 per correct answer, 0 for wrong), with a
  transaction ledger and never a negative balance.
- Reward shop: hints, extra life, skip, 2X booster, 4 avatars, 2 frames, 2 themes, crown, VIP effect.
  Permanent cosmetics, equip/unequip, confirmation + balance check before charging.
- Daily login rewards (7-day cycle), spin wheel with published odds, four treasure boxes with
  published odds, all generated locally.
- 18 achievements, daily and weekly missions with claim buttons, per-mode statistics and records.
- Player profile with rename, avatar/frame/crown/effect, accuracy, streaks and per-mode records.
- Personal leaderboard (all time / week / month) — your own runs only, no invented players.
- Daily challenges for every mode, seeded by date, +25 each and +50 for a full sweep.

**App**
- New home screen with five mode cards, quick actions and a daily-challenge strip; bottom navigation.
- Settings: graphics quality, backup & restore (export/import save code), terms, plus everything from 1.0.
- Light/dark theme, 6 languages, animated rewards, offline banner, keyboard play.
- APK 2.0.0 (versionCode 2), same signing key as 1.0.0 so it updates in place.

## 1.0.0 — 7 November 2026


First release.

- 1,677 verified items across 11 categories (Animals, Technology, Vehicles, Food, Nature, History,
  Science, Buildings, Sports, Household, Arts & Music), every one validated against the Wikipedia API
  with a real photograph.
- Four options per question, exactly one correct, +10 coins for a right answer and 0 for a wrong one.
- **Blur-reveal mechanic:** the photo stays blurred while you choose and snaps into focus when you
  answer (can be turned off in Settings).
- Live discovery: *Random World* and a slice of *All items* fetch fresh articles from Wikipedia at
  runtime, filtered to photographic, concrete subjects.
- No-repeat history (1,400 items deep, persisted) across sessions.
- Coins, best streak and answered count saved on device; animated coin burst on every reward.
- Settings: sound, music, vibration, dark/light theme, blur, language, reset progress.
- 6 interface languages: English, हिन्दी, বাংলা, தமிழ், తెలుగు, मराठी.
- Privacy Policy, About and Credits screens; per-photo attribution for every image.
- Graceful failure: retry at another image size, automatic item swap, offline banner.
- Android APK (signed, 222 KB, minSdk 24) + installable PWA with a service worker.
