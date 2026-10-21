# Street Boss

A business game for iPhone, iPad and Mac. You start with a lemonade cart on a quiet street. You grow it into a kiosk, a shop, a store and a tower, buy the empty lots and open new shops. A rival chain wants the same street, so you must be faster.

**Play:** https://tijmenvandenelzen.github.io/street-boss/

## Install it as an app

- **iPhone or iPad:** open the link in Safari, tap the Share button, then **Add to Home Screen**.
- **Mac:** open the link in Safari and choose **File → Add to Dock**, or in Chrome use the install icon in the address bar.

The game saves itself in the browser and works offline after the first visit.

## How the game grows

There are three streets. Each one adds new ideas, one at a time, so you learn them step by step.

| Street | Goal | New ideas |
| --- | --- | --- |
| Maple Street | Own 3 of 5 lots before day 20 | Build up, prices, staff, buying lots, quality and stars |
| Market Square | Own 4 of 7 lots before day 30 | Combos between neighbor shops, morning news, fans and campaigns |
| Downtown | Own 5 of 9 lots before day 40 | Buy out the rival, city projects, signature products |

The ideas work together. Better quality gives more stars. Stars turn customers into fans. Fans make every shop more popular and pay for campaigns. Shops that are combo partners send customers to each other, and a signature product makes those combos twice as strong. Between streets you pick a boss perk that stays with you.

## Small things to look for

- A gold arrow over a shop means you can build it up now. A glowing FOR SALE sign means you can buy that lot.
- Tap the 💵 tips that pop up over your shops for extra cash.
- New buttons get a pink NEW badge until you try them.
- On a Mac: space pauses, 1, 2 and 3 set the speed, and the arrow keys pick a lot.

## Code

Plain HTML, CSS and JavaScript modules. No build step.

- `index.html`, `style.css`: the page and the layout.
- `js/data.js`: shops, streets, combos, tasks, perks and all balance numbers.
- `js/game.js`: simulation, drawing, panels and screens.
- `sound/`: sound effects and music (CC0), with a small Web Audio player.
- `sw.js`: offline cache. GitHub Actions stamps a new cache version on each deploy.

Run it locally with any static server, for example `python3 -m http.server`, then open http://localhost:8000.
