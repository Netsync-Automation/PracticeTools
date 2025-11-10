# Install Mammoth Package

Run this command to install the mammoth package for Word document support:

```bash
npm install
```

This will install mammoth@^1.8.0 which enables automatic text extraction from .doc and .docx files.

## What was changed:
- Added mammoth to package.json dependencies
- Updated upload route to handle Word documents
- Word docs are processed with mammoth, other formats use Textract
- Frontend now accepts .doc and .docx files

## Testing:
1. Upload a Word document through the Documentation page
2. Text will be automatically extracted and available for ChatNPT queries
