// Lambda entry point - exports the handler from document-processor.js
const { handler } = require('./document-processor');

exports.handler = handler;