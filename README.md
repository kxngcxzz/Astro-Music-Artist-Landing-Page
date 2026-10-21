# ASTRO'

The website for the music artist ASTRO'.

**See it live:** https://kxngcxzz.github.io/Astro-Music-Artist-Landing-Page/

## The pages

- **Home** — the name, and the way in
- **Music** (`/music/`) — the newest single plus the back catalogue, one
  cover at a time, each with buttons through to Apple Music, SoundCloud
  and YouTube
- **Unreleased** (`/vault/`) — snippets you can play before they come out
- **About & bookings** (`/about/`) — photos, the biography, and email
  buttons for shows, features and press

## How it works

Four pages that share one stylesheet and one script. The videos, covers
and photos sit in the `media` folder.

It used to be a single file with everything stuffed inside it, which
sounded tidy but meant every visitor downloaded all nine megabytes of
video just to see the front page — about ten seconds of staring at a
screen that did not respond on a normal phone signal, twenty-six on a
weak one. Now each page only loads its own pictures, and the unreleased
clips only load when somebody actually taps one to play it. The front
page opens in about a fifth of a second.

Splitting it up also means Google can see all four pages instead of just
one, so the music page can show up in a search on its own.

## Putting it somewhere else

Upload the whole folder, keeping it as it is. Nothing is tied to a
particular web address, so it works from any host and from a subfolder
without editing anything.

One thing worth knowing: if you open the files straight off a USB stick
or your desktop by double-clicking them, the site works but the photo
inside the big ASTRO lettering will not appear — you get a plain gradient
there instead. That is a browser rule about reading files off a disk, not
a fault in the site, and it goes away the moment the folder is on a web
host. The old single-file version did not have that problem, which is the
one thing lost in the trade for a site that loads fifty times faster.

## If the address changes

When ASTRO' gets his own domain, the old address is written into a few
places and needs swapping for the new one:

- the `canonical`, `og:url`, `og:image` and `twitter:image` lines near the
  top of each of the four `index.html` files
- the web addresses inside the `application/ld+json` block on each page
- `robots.txt` and `sitemap.xml`
- the link at the top of this file

A find-and-replace of the old address across the whole folder does all of
it in one go. Get that right and the link previews and the Google listing
carry on working.

`thumb.jpg` is the picture that shows up when somebody shares the link.
