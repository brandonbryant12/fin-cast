import React from 'react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// Note: Component function name remains PascalCase
export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex items-start space-x-4 p-4 rounded-lg bg-[#1E293B] bg-opacity-50">
      <div className="flex-shrink-0 mt-1">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold mb-1 text-white">{title}</h3>
        <p className="text-gray-300 text-sm">{description}</p>
      </div>
    </div>
  );
}