# Screenshots Directory

This directory contains screenshots/mockups for the landing page capabilities section.

## Required Images

Add the following PNG images to this directory:

1. **member-directory.png** - Screenshot of the member directory interface
2. **automated-reminders.png** - Screenshot of the reminders/notifications system
3. **revenue-analytics.png** - Screenshot of revenue charts/analytics dashboard
4. **access-control.png** - Screenshot of biometric access control/check-in interface

## Image Specifications

### Recommended Dimensions
- **Width**: 1600px
- **Height**: 1000px
- **Aspect Ratio**: 16:10 (widescreen)
- **Format**: PNG (for transparency support)
- **File Size**: < 500KB each (optimize for web)

### Alternative Dimensions
If you need different sizes, the images will automatically scale. The aspect ratio should ideally be **16:10** for best results.

### Image Requirements
- **Resolution**: Use 2x resolution (1600x1000) for retina displays
- **Background**: Can be transparent or white
- **Content**: Should show the actual interface of the feature
- **Quality**: High quality, but optimized for web (use tools like TinyPNG or ImageOptim)

## How to Capture Screenshots

### Desktop Application Screenshots
1. Open the relevant page in your app (Members, Dashboard, etc.)
2. Use a screenshot tool to capture the interface
3. Crop to show only the relevant section
4. Resize to 1600x1000px
5. Save as PNG

### Browser Screenshots
1. Open the page in Chrome/Edge
2. Press F12 to open DevTools
3. Click the device toolbar icon (Ctrl+Shift+M)
4. Set dimensions to 1600x1000
5. Right-click on page → "Capture screenshot"
6. Save to this directory

### Recommended Tools
- **Windows**: Snipping Tool, Greenshot, ShareX
- **Mac**: Screenshot utility (Cmd+Shift+4), CleanShot X
- **Online**: Figma (for mockups), Canva
- **Image Optimization**: TinyPNG, Squoosh, ImageOptim

## Fallback Behavior

If an image is missing, the component will automatically show a placeholder with the feature title. This allows you to:
- Add images progressively
- Test the layout before screenshots are ready
- Use temporary placeholders during development

## Example File Structure

```
public/screenshots/
├── README.md (this file)
├── member-directory.png
├── automated-reminders.png
├── revenue-analytics.png
└── access-control.png
```

## Tips

1. **Consistency**: Use the same browser/device for all screenshots
2. **Clean Data**: Use sample data that looks professional
3. **Highlight Features**: Show the key functionality in each screenshot
4. **Remove Sensitive Info**: Don't include real user data
5. **Dark Mode**: Consider if you want light or dark theme screenshots
