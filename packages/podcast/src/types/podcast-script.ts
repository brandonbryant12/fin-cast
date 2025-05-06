export interface PodcastScriptOutput {
  title: string;
  summary: string;
  tags: string[];
  dialogue: {
    speaker: string;
    line: string;
  }[];
}