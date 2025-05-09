import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

interface Tag {
  tag: string;
}

interface PodcastTagsProps {
  tags?: Tag[] | null;
  className?: string;
}

const chipColorClasses = [
  "bg-teal-600 hover:bg-teal-700 text-white",
  "bg-sky-600 hover:bg-sky-700 text-white",
  "bg-amber-600 hover:bg-amber-700 text-white",
  "bg-rose-600 hover:bg-rose-700 text-white",
  "bg-violet-600 hover:bg-violet-700 text-white",
  "bg-lime-600 hover:bg-lime-700 text-white",
];

export const PodcastTags: React.FC<PodcastTagsProps> = ({ tags, className }) => {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tags.map((tagObj, index) => (
        <Badge
          key={tagObj.tag}
          variant="outline"
          className={cn(
            "border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            chipColorClasses[index % chipColorClasses.length]
          )}
        >
          {tagObj.tag}
        </Badge>
      ))}
    </div>
  );
};