# Image Paste Feature

## Overview
The Practice Information card modal now supports pasting images directly into the description field. Users can paste images using Ctrl+V or right-click → Paste, and images will be automatically resized and inserted at the cursor position.

## Features
- **Direct Image Pasting**: Paste images from clipboard using Ctrl+V or right-click context menu
- **Automatic Resizing**: Images are automatically resized to fit within the description box while maintaining aspect ratio
- **Multiple Images**: Users can paste multiple images in a single description
- **Cursor Position**: Images are inserted at the current cursor position in the text
- **Visual Feedback**: Shows thumbnail previews of pasted images below the description editor

## Technical Implementation

### Components
- `ImagePasteTextarea`: Enhanced textarea component with image pasting support
- `useImagePaste`: Custom hook handling paste events and cursor position tracking

### API Endpoints
- `/api/files/upload-image`: Handles image uploads with Sharp processing for optimization
- `/api/files/[...path]`: Serves uploaded images (supports both inline display and downloads)

### Image Processing
- Images are processed using Sharp for optimization
- Automatic resizing to max 1200x1200 pixels
- Converted to JPEG format for consistency
- Quality set to 85% for optimal file size

### Storage
- Images stored in S3 bucket under `images/` prefix
- Unique UUID filenames to prevent conflicts
- Metadata includes original filename and upload timestamp

## Usage
1. Open any card in the Practice Information board
2. Click "Edit" on the description field
3. Position cursor where you want to insert an image
4. Paste image using:
   - Ctrl+V (keyboard shortcut)
   - Right-click → Paste (context menu)
5. Image will be automatically uploaded and inserted
6. Save the description to persist changes

## DSR Compliance
- ✅ Environment Awareness: Uses environment-specific S3 bucket configuration
- ✅ Security Best Practices: Input validation and file type restrictions
- ✅ Code Consistency: Follows existing patterns for file uploads and API structure
- ✅ Code Reusability: Extends existing file upload infrastructure
- ✅ Modern UX: Intuitive drag-and-drop style image pasting with visual feedback

## File Structure
```
components/
├── ImagePasteTextarea.js     # Enhanced textarea with image paste support

hooks/
├── useImagePaste.js          # Custom hook for paste event handling

app/api/files/
├── upload-image/
│   └── route.js              # Image upload API endpoint
└── [...path]/
    └── route.js              # File serving (updated for inline images)

app/
└── globals.css               # Updated with image display styles
```

## Browser Support
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support
- Mobile browsers: Limited (depends on clipboard API support)