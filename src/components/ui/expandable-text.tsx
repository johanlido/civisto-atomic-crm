import { useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string | null | undefined;
  maxLength?: number;
  className?: string;
}

/**
 * A text component that truncates long content with a "Read more" toggle.
 * Used in aside panels where space is limited (250-256px wide).
 */
export const ExpandableText = ({
  text,
  maxLength = 200,
  className,
}: ExpandableTextProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) {
    return null;
  }

  if (text.length <= maxLength) {
    return (
      <p className={cn("text-sm whitespace-pre-wrap", className)}>{text}</p>
    );
  }

  return (
    <div className={cn("text-sm", className)}>
      <p className="whitespace-pre-wrap">
        {isExpanded ? text : `${text.substring(0, maxLength)}…`}
      </p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-blue-500 hover:underline text-xs mt-1 cursor-pointer"
      >
        {isExpanded ? "Visa mindre" : "Visa mer"}
      </button>
    </div>
  );
};
