import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Copy } from "lucide-react";
import { toast } from "sonner";

interface VideoPromptsViewProps {
  prompts: any[];
}

export function VideoPromptsView({ prompts }: VideoPromptsViewProps) {
  if (!prompts || prompts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No video prompts yet. Run the Video Prompt Engineer agent.
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
            <div className="flex gap-1.5">
              <Badge variant="outline">{prompt.duration_sec || 10}s</Badge>
              <Badge variant="outline">{prompt.model || "kling-3.0"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Motion Prompt</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(prompt.prompt)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed">
                {prompt.prompt}
              </p>
            </div>
            {prompt.camera_move && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Camera:</span>
                <span>{prompt.camera_move}</span>
              </div>
            )}
            {prompt.effects && prompt.effects.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {prompt.effects.map((effect: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {effect}
                  </Badge>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Video className="h-3.5 w-3.5" />
              Generate Video
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
