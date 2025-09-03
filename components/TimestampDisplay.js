import { useTimezone } from '../hooks/useTimezone';

export default function TimestampDisplay({ 
  timestamp, 
  relative = false, 
  className = "text-gray-500 text-sm",
  showTooltip = true 
}) {
  const { formatTimestamp, formatRelativeTime, isClient } = useTimezone();

  if (!timestamp || !isClient) {
    return <span className={className}>Loading...</span>;
  }

  const displayTime = relative ? formatRelativeTime(timestamp) : formatTimestamp(timestamp);
  const tooltipTime = relative ? formatTimestamp(timestamp) : formatRelativeTime(timestamp);

  if (showTooltip) {
    return (
      <span 
        className={`${className} cursor-help`}
        title={tooltipTime}
      >
        {displayTime}
      </span>
    );
  }

  return <span className={className}>{displayTime}</span>;
}