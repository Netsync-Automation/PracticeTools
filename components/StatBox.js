'use client';

export default function StatBox({ 
  title, 
  value, 
  icon, 
  color = 'blue',
  className = '' 
}) {
  const colorClasses = {
    blue: {
      bg: 'from-blue-50 to-blue-100',
      border: 'border-blue-200',
      iconBg: 'bg-blue-500',
      textColor: 'text-blue-700',
      valueColor: 'text-blue-900'
    },
    purple: {
      bg: 'from-purple-50 to-purple-100',
      border: 'border-purple-200',
      iconBg: 'bg-purple-500',
      textColor: 'text-purple-700',
      valueColor: 'text-purple-900'
    },
    orange: {
      bg: 'from-orange-50 to-orange-100',
      border: 'border-orange-200',
      iconBg: 'bg-orange-500',
      textColor: 'text-orange-700',
      valueColor: 'text-orange-900'
    },
    green: {
      bg: 'from-green-50 to-green-100',
      border: 'border-green-200',
      iconBg: 'bg-green-500',
      textColor: 'text-green-700',
      valueColor: 'text-green-900'
    },
    indigo: {
      bg: 'from-indigo-50 to-indigo-100',
      border: 'border-indigo-200',
      iconBg: 'bg-indigo-500',
      textColor: 'text-indigo-700',
      valueColor: 'text-indigo-900'
    },
    teal: {
      bg: 'from-teal-50 to-teal-100',
      border: 'border-teal-200',
      iconBg: 'bg-teal-500',
      textColor: 'text-teal-700',
      valueColor: 'text-teal-900'
    },
    emerald: {
      bg: 'from-emerald-50 to-emerald-100',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      valueColor: 'text-emerald-900'
    },
    red: {
      bg: 'from-red-50 to-red-100',
      border: 'border-red-200',
      iconBg: 'bg-red-500',
      textColor: 'text-red-700',
      valueColor: 'text-red-900'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`bg-gradient-to-br ${colors.bg} rounded-xl shadow-sm border ${colors.border} p-4 hover:shadow-md transition-shadow ${className}`}>
      <div className="text-center">
        <div className={`w-12 h-12 ${colors.iconBg} rounded-full flex items-center justify-center mx-auto mb-3`}>
          <span className="text-white font-bold text-lg">{icon}</span>
        </div>
        <p className={`text-xs font-medium ${colors.textColor} mb-1 truncate`}>{title}</p>
        <p className={`text-2xl font-bold ${colors.valueColor}`}>{value}</p>
      </div>
    </div>
  );
}