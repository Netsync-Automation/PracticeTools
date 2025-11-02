export default function WebhookTraceViewer({ trace }) {
  if (!trace) return null;
  
  let traceData;
  try {
    traceData = typeof trace === 'string' ? JSON.parse(trace) : trace;
  } catch {
    return <div className="text-sm text-red-600">Invalid trace data</div>;
  }
  
  const getStepIcon = (step) => {
    if (step.includes('error') || step.includes('failed')) return '❌';
    if (step.includes('success') || step.includes('completed')) return '✅';
    if (step.includes('start') || step.includes('received')) return '📥';
    if (step.includes('api_call')) return '🌐';
    if (step.includes('token')) return '🔑';
    if (step.includes('db') || step.includes('save')) return '💾';
    if (step.includes('sse')) return '📡';
    return '▶️';
  };
  
  const maskToken = (str) => {
    if (!str || typeof str !== 'string') return str;
    if (str.includes('Bearer')) {
      const parts = str.split(' ');
      if (parts[1] && parts[1].length > 20) {
        return `Bearer ${parts[1].substring(0, 20)}...${parts[1].substring(parts[1].length - 10)}`;
      }
    }
    return str;
  };
  
  return (
    <div className="space-y-2">
      {traceData.map((item, index) => (
        <div key={index} className="border-l-2 border-blue-300 pl-4 py-2 bg-gray-50 rounded-r">
          <div className="flex items-start gap-2">
            <span className="text-lg">{getStepIcon(item.step)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-900">{item.step.replace(/_/g, ' ').toUpperCase()}</span>
                <span className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
              </div>
              {Object.entries(item).filter(([key]) => key !== 'step' && key !== 'timestamp').map(([key, value]) => (
                <div key={key} className="text-xs text-gray-600 mt-1">
                  <span className="font-medium">{key}:</span>{' '}
                  {typeof value === 'object' ? (
                    <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    <span className="font-mono">{maskToken(String(value))}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
