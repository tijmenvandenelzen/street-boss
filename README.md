# Street Boss

A business game for iPhone, iPad and Mac. You start with a lemonade cart on a quiet street. You grow it into a kiosk, a shop, a store and a tower, buy the empty lots and open new shops. A rival chain wants the same street, so you must be faster.

**Play:** https://tijmenvandenelzen.github.io/street-boss/

## Install it as an app

- **iPhone or iPad:** open the link in Safari, tap the Share button, then **Add to Home Screen**.
- **Mac:** open the link in Safari and choose **File → Add to Dock**, or in Chrome use the install icon in the address bar.

The game saves itself in the browser and works offline after the first visit.

## How the game grows

The game has two parts. First you win three streets. Then you graduate to the city map. Each one adds new ideas, one at a time, so you learn them step by step.

| Street | Goal | New ideas |
| --- | --- | --- |
| Maple Street | Own 3 of 5 lots before day 20 | Build up, prices, staff, buying lots, quality and stars |
| Market Square | Own 4 of 7 lots before day 30 | Combos between neighbor shops, morning news, fans and campaigns |
| Downtown | Own 5 of 9 lots before day 40 | Buy out the rival, city projects, signature products |


The ideas work together. Better quality gives more stars. Stars turn customers into fans. Fans make every shop more popular and pay for campaigns. Delivery brings extra orders, and shops with more stars get more of them. Investors give cash now for a part of each profit later. A franchise copies a big Store to other cities and pays a part of its sales. Shops that are combo partners send customers to each other, and a signature product makes those combos twice as strong. Between streets you pick a boss perk that stays with you.

## The city map

After Downtown you graduate to the city map. It moves one week at a time.

- Your won streets earn money every week. Managers make a street earn more.
- GigaCorp attacks your streets and lowers their loyalty. A street with less loyalty earns less, and at 0% GigaCorp takes it. Security protects a street. You can buy a lost street back, or play it again to win it back.
- Harbor Bay (delivery scooters, managers) and Skyline Plaza (investors, franchises) are new streets to conquer. While you play a street, 4 weeks pass on the map.
- Factory Park makes your own product, for example Golden Lemonade. Upgrade the machine, buy trucks, open new cities, set a price per city and buy ads to beat GigaCola.
- Own all 5 streets and win 3 cities for your brand (half the market, and enough crates for everybody) to become City Boss. By week 26 you get 3 stars.

## Small things to look for

- A gold arrow over a shop means you can build it up now. A glowing FOR SALE sign means you can buy that lot.
- Tap the 💵 tips that pop up over your shops for extra cash.
- New buttons get a pink NEW badge until you try them.
- Trophies (in the menu and on the start screen) stay with you, also after a new game.
- The Boss plan tab shows your tasks, your profit per day and, later, campaigns and city projects.
- On a Mac: space pauses, 1, 2 and 3 set the speed, and the arrow keys pick a lot.

## Code

Plain HTML, CSS and JavaScript modules. No build step.

- `index.html`, `style.css`: the page and the layout.
- `js/data.js`: shops, streets, combos, tasks, perks, the city map and all balance numbers.
- `js/empire.js`: the city map and the factory (rules and screens).
- `js/game.js`: simulation, drawing, panels and screens.
- `sound/`: sound effects and music (CC0), with a small Web Audio player.
- `sw.js`: offline cache. GitHub Actions stamps a new cache version on each deploy.

Run it locally with any static server, for example `python3 -m http.server`, then open http://localhost:8000.
