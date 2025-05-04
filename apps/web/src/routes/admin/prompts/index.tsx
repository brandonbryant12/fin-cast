import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/admin/prompts/')({
  component: AdminPromptsPage,
});

const promptName = 'podcast-script-generator';
const promptVersion = '1.0';
const promptDescription = 'Generates a conversational podcast script, embodying specific host personalities.';

const outputSchemaString = `{
  "title": "string",
  "tags": ["string"],
  "summary": "string (maxLength: 300, minLength: 1)",
  "dialogue": [
    {
      "speaker": "string (hostName | cohostName)",
      "line": "string (minLength: 1)"
    }
  ]
}`;

const templateString = `
You are an expert podcast script writer. Your task is to create an engaging podcast script based *only* on the essential information extracted from the following HTML document. The script should feature two hosts, "{hostName}" and "{cohostName}", embodying specific personalities.

**Host Personalities:**
* **(Host):** Name is {hostName}. Personality: {hostPersonalityDescription}.
* **(Co-host):** Name is {cohostName}. Personality: {cohostPersonalityDescription}

**CRITICAL OUTPUT REQUIREMENT:**
Your entire response MUST be a single, valid JSON object. Do NOT include any text, explanation, markdown formatting, or anything else before or after the JSON object. The JSON object must strictly adhere to the following structure:

generate 3 tags that represent the main ideas of the topic and include a short summary no more than 240 characters.

{
  "title": "string",
  "tags": ["string"],
  "summary": "string",
  "dialogue": [
    {
      "speaker":  {hostName} | {cohostName},
      "line": "string"
    }
  ],
}

**Script Generation Guidelines:**
1.  **Analyze HTML:** Extract the core topic, main points, and key details from the provided HTML. Focus only on the main article/content. Ignore headers, footers, navigation, ads, sidebars.
2.  **Embody Personalities:** Write the dialogue for {hostName} reflecting {hostName}'s personality ({hostPersonalityDescription}) and the dialogue for {cohostName} reflecting {cohostName}'s personality ({cohostPersonalityDescription}). Create a natural, engaging back-and-forth conversation based on the content.
3.  **Structure JSON:** Create the JSON object according to the required schema.
5.  **Write Dialogue:** Populate the "dialogue" array, ensuring the conversation flows logically and reflects the assigned personalities discussing the HTML content.
7.  **Validate JSON:** Ensure the final output is a single, valid complete JSON object matching the schema exactly.

{htmlContent}


**REMEMBER: Output ONLY the JSON object.**
`;

function AdminPromptsPage() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - Prompt Management</CardTitle>
        <CardDescription>View details about the system's AI prompts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card className="bg-card/50">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{promptName}</CardTitle>
                <CardDescription>{promptDescription}</CardDescription>
              </div>
              <Badge variant="outline">Version: {promptVersion}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-md font-semibold mb-2 text-foreground">Output Schema</h3>
              <pre className="p-4 rounded-md bg-background border border-border text-sm text-muted-foreground overflow-x-auto">
                <code>{outputSchemaString}</code>
              </pre>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-semibold text-foreground">Prompt Template</h3>
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit Prompt</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center text-2xl text-card-foreground">
                        Coming Soon! 🚧🛠️
                      </DialogTitle>
                    </DialogHeader>
                    <p className="text-center text-muted-foreground mt-2">
                      Prompt editing functionality is under development.
                    </p>
                  </DialogContent>
                </Dialog>
              </div>
              <pre className="p-4 rounded-md bg-background border border-border text-sm text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
                <code>{templateString}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
        {/* Add more cards here for other prompts if needed */}
      </CardContent>
    </Card>
  );
}