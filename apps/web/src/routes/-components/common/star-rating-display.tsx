import { cn } from '@repo/ui/lib/utils';
import { Star } from 'lucide-react';
import React from 'react';

interface StarRatingDisplayProps {
  rating: number;
  totalReviews?: number;
  size?: number;
  color?: string;
  inactiveColor?: string;
  className?: string;
  showText?: boolean;
}

export const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
  rating = 0,
  totalReviews,
  size = 16,
  color = "text-yellow-400",
  inactiveColor = "text-gray-500",
  className,
  showText = true,
}) => {
  const maxRating = 5;
  const filledStars = Math.round(rating);
  const displayRating = rating.toFixed(1);

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="flex items-center space-x-0.5" aria-label={`Rating: ${displayRating} out of ${maxRating} stars`}>
        {[...Array(maxRating)].map((_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= filledStars;
          const starColorClass = isFilled ? color : inactiveColor;
          return (
            <Star
              key={index}
              size={size}
              className={cn(starColorClass)}
              fill={isFilled ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          );
        })}
      </div>
      {totalReviews !== undefined && totalReviews > 0 && (
         <span className="text-xs text-muted-foreground">
            {displayRating}
            {showText && ` (${totalReviews} review${totalReviews !== 1 ? 's' : ''})`}
         </span>
      )}
       {totalReviews === 0 && (
         <span className="text-xs text-muted-foreground">No reviews yet</span>
       )}
    </div>
  );
};