import type { PodcastContent } from "../validations/validations";

export interface PodcastScriptOutput {
  title: string;
  summary: string;
  tags: string[];
  dialogue: PodcastContent;
}