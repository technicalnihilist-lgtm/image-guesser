# Credits

## Image Guesser

Concept, design and development: **Image Guesser** (built for Nihao Nihao) — a single-file HTML game
plus a native Android shell.

## Content sources

- **[Wikipedia](https://www.wikipedia.org/)** — item names, one-line descriptions and article links.
  Wikipedia text is available under the
  [Creative Commons Attribution-ShareAlike 4.0 License](https://creativecommons.org/licenses/by-sa/4.0/).
- **[Wikimedia Commons](https://commons.wikimedia.org/)** — the photographs themselves, together with
  their license metadata.
- **[MediaWiki API documentation](https://www.mediawiki.org/wiki/API:Main_page)** — the public API this
  game queries at runtime (`action=query`, `prop=pageimages`, `prop=imageinfo`, `generator=random`).

## Image creators and licenses

The photographs on Wikimedia Commons are contributed by thousands of volunteer photographers,
museums, archives and institutions. Listing them all here would be a list nobody could check, so
**every question credits its own photo inside the app**: after you answer, the line under the item
name shows the author, the license and "Wikimedia Commons" for that exact file.

That credit is fetched live from the file's Commons metadata (`Artist` and `LicenseShortName`), so it
is the credit for the image you are actually looking at. Licenses in the pool include CC BY-SA 4.0,
CC BY-SA 3.0, CC BY 2.0, CC BY 3.0, CC0 and public domain, among others.

To see an image's full license page, open the item on Wikipedia and follow the photo's file link, or
search the file name on <https://commons.wikimedia.org/>.

## Fonts and assets

No third-party fonts, icon packs, analytics SDKs or advertising networks are used. All icons and the
game logo are drawn as inline SVG inside the app. All sounds — the correct chime, the wrong buzz and
the ambient pad — are synthesised at runtime with the Web Audio API; there are no audio files.

## Third-party software

None at runtime. The build uses the Android SDK build-tools (aapt2, d8, zipalign, apksigner) and a
JDK; the screenshot tooling uses Chrome and puppeteer-core. Nothing of that ships in the app.

## Disclaimer

Image Guesser is an independent, unofficial project. **No partnership with, endorsement by or
sponsorship from the Wikimedia Foundation, Wikipedia or Wikimedia Commons is claimed or implied.**
"Wikipedia" and "Wikimedia" are trademarks of the Wikimedia Foundation and are used here only to
describe where the content comes from.
