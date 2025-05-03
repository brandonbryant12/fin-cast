import { cn } from '@repo/ui/lib/utils';
import { Star } from 'lucide-react';
import React, { useState } from 'react';

interface StarRatingInputProps {
  count?: number;
  value: number;
  onChange: (value: number) => void;
  size?: number;
  color?: string;
  hoverColor?: string;
  inactiveColor?: string;
  className?: string;
  disabled?: boolean;
}

export const StarRatingInput: React.FC<StarRatingInputProps> = ({
  count = 5,
  value = 0,
  onChange,
  size = 24,
  color = "text-yellow-400",
  hoverColor = "text-yellow-300",
  inactiveColor = "text-gray-500",
  className,
  disabled = false,
}) => {
  const [hoverValue, setHoverValue] = useState<number | undefined>(undefined);

  const stars = Array.from({ length: count }, (_, i) => i + 1);

  const handleClick = (newValue: number) => {
    if (!disabled) {
      onChange(newValue);
    }
  };

  const handleMouseEnter = (newValue: number) => {
    if (!disabled) {
      setHoverValue(newValue);
    }
  };

  const handleMouseLeave = () => {
     if (!disabled) {
       setHoverValue(undefined);
     }
  };

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {stars.map((starValue) => {
        const isFilled = (hoverValue ?? value) >= starValue;
        const starColorClass = isFilled ? (hoverValue ? hoverColor : color) : inactiveColor;

        return (
          <Star
            key={starValue}
            size={size}
            className={cn(
              "cursor-pointer transition-colors duration-150",
               starColorClass,
               disabled ? "cursor-not-allowed opacity-50" : "hover:scale-110"
            )}
            fill={isFilled ? 'currentColor' : 'none'}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => handleMouseEnter(starValue)}
            onMouseLeave={handleMouseLeave}
            aria-label={`Rate ${starValue} out of ${count} stars`}
            role="radio"
            aria-checked={value === starValue}
          />
        );
      })}
    </div>
  );
};