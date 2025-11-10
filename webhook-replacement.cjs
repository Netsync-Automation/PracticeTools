const fs = require('fs');

const filePath = 'd:\\Coding\\PracticeTools\\app\\admin\\settings\\page.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldSection = `                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">\r
                          {/* WebEx Registration */}\r
                          <div className="space-y-2">\r
                            <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">\r
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\r
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />\r
                              </svg>\r
                              WebEx Registration\r
                            </h5>\r
                            <div className="space-y-1 text-sm">\r
                              <div className="flex items-center gap-2">\r
                                {result.webhookDetails?.recordings ? (\r
                                  <span className="text-green-600">✓</span>\r
                                ) : (\r
                                  <span className="text-red-600">✗</span>\r
                                )}\r
                                <span>Recordings Webhook</span>\r
                                {result.webhookDetails?.recordings && (\r
                                  <span className="text-xs text-gray-500">({result.webhookDetails.recordings.status})</span>\r
                                )}\r
                              </div>\r
                              <div className="flex items-center gap-2">\r
                                {result.webhookDetails?.transcripts ? (\r
                                  <span className="text-green-600">✓</span>\r
                                ) : (\r
                                  <span className="text-red-600">✗</span>\r
                                )}\r
                                <span>Transcripts Webhook</span>\r
                                {result.webhookDetails?.transcripts && (\r
                                  <span className="text-xs text-gray-500">({result.webhookDetails.transcripts.status})</span>\r
                                )}\r
                              </div>\r
                            </div>\r
                          </div>\r
                          \r
                          {/* System Health */}\r
                          <div className="space-y-2">\r
                            <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">\r
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\r
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />\r
                              </svg>\r
                              System Health\r
                            </h5>\r
                            <div className="space-y-1 text-sm">\r
                              <div className="flex items-center gap-2">\r
                                {result.connectivity?.[0]?.reachable ? (\r
                                  <span className="text-green-600">✓</span>\r
                                ) : (\r
                                  <span className="text-red-600">✗</span>\r
                                )}\r
                                <span>Endpoint Connectivity</span>\r
                              </div>\r
                              <div className="flex items-center gap-2">\r
                                <span className="text-blue-600">ℹ️</span>\r
                                <span>Total WebEx Webhooks: {result.totalWebhooksInWebEx || 0}</span>\r
                              </div>\r
                            </div>\r
                          </div>\r
                        </div>`;

const newSection = `                        {result.webhookDetails?.recordings && (\r
                          <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">\r
                            <div className="flex items-center gap-2 mb-2">\r
                              <span className="text-green-600 text-lg">✓</span>\r
                              <h5 className="text-sm font-semibold text-gray-900">Recordings Webhook</h5>\r
                              <span className="ml-auto px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">{result.webhookDetails.recordings.status}</span>\r
                            </div>\r
                            <div className="space-y-1 text-xs text-gray-600 ml-7">\r
                              <div><span className="font-medium">ID:</span> <code className="bg-gray-100 px-1 rounded">{result.webhookDetails.recordings.id}</code></div>\r
                              <div><span className="font-medium">Target URL:</span> <code className="bg-gray-100 px-1 rounded text-xs break-all">{result.webhookDetails.recordings.targetUrl}</code></div>\r
                              <div><span className="font-medium">Site URL:</span> {result.webhookDetails.recordings.siteUrl || 'N/A'}</div>\r
                              <div><span className="font-medium">Owned By:</span> {result.webhookDetails.recordings.ownedBy}</div>\r
                              <div><span className="font-medium">Created:</span> {new Date(result.webhookDetails.recordings.created).toLocaleString()}</div>\r
                            </div>\r
                          </div>\r
                        )}\r
                        {!result.webhookDetails?.recordings && (\r
                          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">\r
                            <div className="flex items-center gap-2">\r
                              <span className="text-red-600 text-lg">✗</span>\r
                              <h5 className="text-sm font-semibold text-red-900">Recordings Webhook Missing</h5>\r
                            </div>\r
                            <p className="text-xs text-red-700 ml-7 mt-1">No recordings webhook found for this site</p>\r
                          </div>\r
                        )}\r
                        {result.webhookDetails?.transcripts && (\r
                          <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">\r
                            <div className="flex items-center gap-2 mb-2">\r
                              <span className="text-green-600 text-lg">✓</span>\r
                              <h5 className="text-sm font-semibold text-gray-900">Transcripts Webhook</h5>\r
                              <span className="ml-auto px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">{result.webhookDetails.transcripts.status}</span>\r
                            </div>\r
                            <div className="space-y-1 text-xs text-gray-600 ml-7">\r
                              <div><span className="font-medium">ID:</span> <code className="bg-gray-100 px-1 rounded">{result.webhookDetails.transcripts.id}</code></div>\r
                              <div><span className="font-medium">Target URL:</span> <code className="bg-gray-100 px-1 rounded text-xs break-all">{result.webhookDetails.transcripts.targetUrl}</code></div>\r
                              <div><span className="font-medium">Site URL:</span> {result.webhookDetails.transcripts.siteUrl || 'N/A'}</div>\r
                              <div><span className="font-medium">Owned By:</span> {result.webhookDetails.transcripts.ownedBy}</div>\r
                              <div><span className="font-medium">Created:</span> {new Date(result.webhookDetails.transcripts.created).toLocaleString()}</div>\r
                            </div>\r
                          </div>\r
                        )}\r
                        {!result.webhookDetails?.transcripts && (\r
                          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">\r
                            <div className="flex items-center gap-2">\r
                              <span className="text-red-600 text-lg">✗</span>\r
                              <h5 className="text-sm font-semibold text-red-900">Transcripts Webhook Missing</h5>\r
                            </div>\r
                            <p className="text-xs text-red-700 ml-7 mt-1">No transcripts webhook found for this site</p>\r
                          </div>\r
                        )}\r
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">\r
                          <h5 className="text-sm font-semibold text-blue-900 mb-2">System Information</h5>\r
                          <div className="space-y-1 text-xs text-blue-800">\r
                            <div className="flex items-center gap-2">\r
                              {result.connectivity?.[0]?.reachable ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>}\r
                              <span>Endpoint Connectivity: {result.connectivity?.[0]?.reachable ? 'Reachable' : 'Unreachable'}</span>\r
                            </div>\r
                            <div><span className="font-medium">Total WebEx Webhooks:</span> {result.totalWebhooksInWebEx || 0}</div>\r
                            <div><span className="font-medium">Webhooks for this Site:</span> {result.allWebhooksForSite?.length || 0}</div>\r
                          </div>\r
                        </div>\r
                        {result.allWebhooksForSite && result.allWebhooksForSite.length > 0 && (\r
                          <div className="mt-3">\r
                            <details className="group">\r
                              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1">\r
                                <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">\r
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />\r
                                </svg>\r
                                All Webhooks for this Site ({result.allWebhooksForSite.length})\r
                              </summary>\r
                              <div className="mt-2 space-y-2 ml-5">\r
                                {result.allWebhooksForSite.map((webhook, idx) => (\r
                                  <div key={idx} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs">\r
                                    <div className="font-medium text-gray-900">{webhook.name}</div>\r
                                    <div className="text-gray-600 space-y-0.5 mt-1">\r
                                      <div><span className="font-medium">ID:</span> {webhook.id}</div>\r
                                      <div><span className="font-medium">Resource:</span> {webhook.resource}</div>\r
                                      <div><span className="font-medium">Event:</span> {webhook.event}</div>\r
                                      <div><span className="font-medium">Status:</span> {webhook.status}</div>\r
                                      <div><span className="font-medium">Target:</span> <code className="bg-white px-1 rounded break-all">{webhook.targetUrl}</code></div>\r
                                      {webhook.filter && <div><span className="font-medium">Filter:</span> {webhook.filter}</div>}\r
                                      {webhook.siteUrl && <div><span className="font-medium">Site URL:</span> {webhook.siteUrl}</div>}\r
                                      <div><span className="font-medium">Owned By:</span> {webhook.ownedBy}</div>\r
                                    </div>\r
                                  </div>\r
                                ))}\r
                              </div>\r
                            </details>\r
                          </div>\r
                        )}`;

if (content.includes(oldSection)) {
  content = content.replace(oldSection, newSection);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Successfully replaced webhook validation section');
} else {
  console.log('✗ Could not find the section to replace');
  process.exit(1);
}
