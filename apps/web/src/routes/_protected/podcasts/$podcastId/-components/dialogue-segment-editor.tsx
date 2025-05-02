import { Button } from "@repo/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { Trash2 } from "lucide-react";
import React, { useRef, useEffect } from 'react';

interface DialogueSegmentData {
  speaker: string;
  line: string;
}

interface DialogueSegmentEditorProps {
  segment: DialogueSegmentData;
  index: number;
  onSpeakerChange: (index: number, newSpeaker: string) => void;
  onLineChange: (index: number, newLine: string) => void;
  onDelete: (index: number) => void;
  hostName: string;
  cohostName: string;
}

export function DialogueSegmentEditor({
  segment,
  index,
  onSpeakerChange,
  onLineChange,
  onDelete,
  hostName,
  cohostName,
}: DialogueSegmentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    requestAnimationFrame(() => {
       adjustTextareaHeight(textareaRef.current);
    });
  }, [segment.line]);

  const handleTextareaInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    adjustTextareaHeight(event.currentTarget);
  };

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onLineChange(index, event.target.value);
  };


  return (
    <div className="flex items-start space-x-2 p-2 border border-transparent hover:border-border rounded-md">
      <div className="flex-shrink-0 w-28">
        <Select
          key={`${segment.speaker}-${hostName}-${cohostName}`} // Add key to force re-render when relevant props change
          value={segment.speaker || ""}
          onValueChange={(newSpeaker) => onSpeakerChange(index, newSpeaker)}
        >
          <SelectTrigger className="bg-input text-xs h-8">
            <SelectValue placeholder="Speaker..." />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value={hostName} className="text-xs">{hostName}</SelectItem>
            <SelectItem value={cohostName} className="text-xs">{cohostName}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Textarea
        ref={textareaRef}
        value={segment.line}
        onChange={handleTextareaChange}
        onInput={handleTextareaInput}
        placeholder="Dialogue line..."
        className="flex-grow bg-input text-sm min-h-[40px] overflow-hidden resize-none leading-snug"
        rows={1}
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(index)}
        className="text-red-500 hover:text-red-400 hover:bg-red-900/30 flex-shrink-0 h-8 w-8 p-0"
        aria-label={`Delete segment ${index + 1}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}