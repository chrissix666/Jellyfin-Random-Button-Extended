[Jellyfin Projects](https://linktr.ee/JellyfinProjects) | [Kodi Projects](https://linktr.ee/KodiProjects)

---

# Jellyfin Random Button Extended + Auto Mode

Based on [n00bcodr](https://github.com/n00bcodr/Jellyfin-Random-Button), this fork extends the Random Button with context-aware behavior inside libraries and an experimental Auto Mode for continuous random browsing.

---

## UPDATE v3: Auto Mode Timer Toggle (Triple Click)

The Random Shuffle timer enabled via the `v3.js`controls the interval for automatic shuffling in auto mode. The default is 12 seconds, and the value is temporary, resetting on page reload. A triple click on the button cycles through predefined timer values (3, 6, 12, 24, 48, seconds), immediately updating the auto-shuffle interval if auto mode is active. The selected value is briefly displayed next to the button icon. This allows quick adjustment of shuffle speed: longer intervals for movies to enjoy intros or themes, shorter intervals for fast episode shuffling of familiar series or also making quick shuffling games with your family from your home videos libary.

Tip: I use this feature all the time, and it has become indispensable. It takes a bit of muscle memory to perform triple clicks consistently, especially one after another. Currently, I haven’t found a better solution. You can reduce the number of timer steps to suit your own behavior—for example, only 3 steps. That’s why I didn’t include 60 seconds or higher, even though the maximum could go that far. For now, I use 5 settings (excluding 60 and above).

---

## UPDATE v2: Auto Mode (Double Click)

Auto Mode is an optional feature enabled via one of the `v2.js` or `v3.js`. It provides continuous random browsing with the following behavior:

- Activated by double-clicking the Random Button
- Automatically opens a new random item every 12 seconds
- Interval can be adjusted directly in the script
- Button icon changes to indicate Auto Mode
- Manual shuffling is still possible and resets the timer
- Stops when video playback starts, on double-click, or on page reload
- Fully compatible with library locks and context-aware behavior

Auto Mode is experimental but useful for passive discovery or continuous browsing.

---

## Installation

- Use the modified `v1.js`  
  or, if Auto Mode is desired, `v2.js` or `v3.js` (+Timer Toggle)

- Prepared for a standard library setup:  
  1 movie library, 1 series library, 1 collection library, 2 home video libraries.

- Edit the JavaScript file:  
  Replace all `pasteyouridhere` placeholders with your library IDs.  
  Save the file in your JS injector and reload the page.

- For additional libraries or custom setups, minor code adjustments are required.

---

## Behavior

### Home Screen

From the Home view, the Random Button selects a random Movie or Series, or Collection if an ID is set.

---

### Library Locking (Context-Aware Behavior)

When inside a library, the Random Button operates only within the current library and media type.

- Locking is implicit and context-aware
- Leaving the library removes the lock automatically
- Works for Movies, Series, Collections, and Home Videos when IDs are set

**Examples:**

1. Main View → Enter a library → Random Button → random item from that library  
2. Main View → Random Button → behavior depends on current view context  

---

### Home Videos

- Recursive, folder-respecting randomization
- Works with flat or nested folder structures
- Always stays within the current folder tree

---

### Series, Seasons, and Episodes

- **Series view:** random Series  
- **Season view:** random Episode from the current Season  
- **Episode view:** random Episode from any Season of the same Series  

Allows natural navigation from Series to Season to Episode with continuous episode-level shuffling.

---

### Fallback Behavior

- Used when no library context can be determined (info pages, genres, tags, filters, studios, etc.)
- Random Movie or Series
- Some Collection containers are supported when IDs are set, behavior may be imperfect

---

### Global Fallback

If `pasteyouridhere` placeholders are still present:

- Random Movies or Series only
- No library-specific logic applied

This ensures the Random Button always opens something.

---

## Auto Mode Summary

- Double-click the Random Button to activate
- Random item every 12 seconds (configurable)
- Manual interaction resets the timer without disabling Auto Mode
- Stops on playback, double-click, or page reload
- Works across all supported libraries
- Button icon reflects Auto Mode state

---

## Tested On

- Jellyfin 10.10.7 and 12.0+  
- Windows 11  
- Chrome  

---

## License

MIT — free to use, modify, and share.

---

## Notes and Limitations

- Attempts to generalize behavior without library IDs were unsuccessful
- Avoiding cross-locking between Movie, Series, and Home views had partial success
- Tag, genre, and actor shuffling is global only and not limited per library

Published with the hope that others may further improve Auto Mode and shuffle logic.

---

## Jellyfin Enhanced Disclaimer

This script has not been tested with Jellyfin Enhanced. Jellyfin Enhanced includes its own Random Button, which may conflict with this script, causing unexpected behavior or crashes. It is strongly recommended to disable the Enhanced Random Button before use.
