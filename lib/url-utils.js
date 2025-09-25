// DSR-compliant URL detection and linking utility

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

export function linkifyText(text) {
  if (!text) return text;
  
  return text.replace(URL_REGEX, (url) => {
    // Clean up URL (remove trailing punctuation that's not part of URL)
    const cleanUrl = url.replace(/[.,;:!?]+$/, '');
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${cleanUrl}</a>`;
  });
}

export function hasUrls(text) {
  if (!text) return false;
  return URL_REGEX.test(text);
}