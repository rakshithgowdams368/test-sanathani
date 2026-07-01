import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image, Copy } from "lucide-react";
import { toast } from "sonner";

interface ImagePromptsViewProps {
  prompts: any[];
}

export function ImagePromptsView({ prompts }: ImagePromptsViewProps) {
  if (!prompts || prompts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No image prompts yet. Run the Image Prompt Engineer agent.
          </p>
        </CardContent>
      </Card>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      {prompts.map((prompt) => (
        <Card key={prompt.id}>
          <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm">
              <Badge variant="secondary" className="font-mono text-xs">
                {prompt.shot_id?.toString().slice(0, 8)}
              </Badge>
            </CardTitle>
            <Badge variant="outline">{prompt.model || "nano-banana-2"}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">First Frame</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(prompt.first_frame_prompt)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed">
                {prompt.first_frame_prompt}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Background</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(prompt.background_prompt)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed">
                {prompt.background_prompt}
              </p>
            </div>
            {prompt.negative_prompt && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive/70">Negative</p>
                <p className="text-xs text-muted-foreground">{prompt.negative_prompt}</p>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Image className="h-3.5 w-3.5" />
              Generate Image
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
