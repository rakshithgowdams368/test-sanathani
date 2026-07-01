import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Image, Copy, Zap, Loader as Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ImagePromptsViewProps {
  prompts: any[];
  projectId: string;
}

const IMAGE_MODELS = [
  { id: "seedream-v4-5", label: "Seedream 4.5 (Photoreal)" },
  { id: "z-image", label: "Z-Image (Photoreal)" },
  { id: "flux-2", label: "Flux 2 (Detail)" },
  { id: "imagen4", label: "Imagen 4 Ultra" },
  { id: "nano-banana-2", label: "Nano Banana 2 (Consistency)" },
  { id: "gpt-image-2", label: "GPT Image 2" },
  { id: "flux-1.1-pro", label: "Flux 1.1 Pro" },
  { id: "ideogram-v2", label: "Ideogram V2" },
  { id: "recraft-v3", label: "Recraft V3" },
];

export function ImagePromptsView({ prompts, projectId }: ImagePromptsViewProps) {
  const queryClient = useQueryClient();

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
        <ImagePromptCard
          key={prompt.id}
          prompt={prompt}
          projectId={projectId}
          onCopy={copyToClipboard}
          queryClient={queryClient}
        />
      ))}
    </div>
  );
}

function ImagePromptCard({
  prompt,
  projectId,
  onCopy,
  queryClient,
}: {
  prompt: any;
  projectId: string;
  onCopy: (text: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [selectedModel, setSelectedModel] = useState(prompt.model || "seedream-v4-5");
  const [generating, setGenerating] = useState(false);

  const displayImage = prompt.final_url || prompt.base_url;
  const isEnhanced = !!prompt.final_url;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kie-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            shot_id: prompt.shot_id,
            project_id: projectId,
            model: selectedModel,
            prompt: prompt.first_frame_prompt,
            aspect_ratio: prompt.aspect_ratio || "16:9",
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      toast.success("Image generation started! (Base + Upscale)");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["image_prompts", projectId] }), 8000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {prompt.shot_id?.toString().slice(0, 8)}
          </Badge>
          {isEnhanced && (
            <Badge className="gap-1 bg-green-600 text-white text-[10px]">
              <Zap className="h-3 w-3" />
              Enhanced
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[10px]">{prompt.aspect_ratio || "16:9"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Generated image display */}
        {displayImage && (
          <div className="relative overflow-hidden rounded-md border bg-muted">
            {isEnhanced && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-green-600/90 px-2 py-0.5">
                <Zap className="h-3 w-3 text-white" />
                <span className="text-[10px] font-medium text-white">Upscaled</span>
              </div>
            )}
            <AspectRatio ratio={16/9}>
              <img
                src={displayImage}
                alt="Generated frame"
                className="h-full w-full object-cover"
              />
            </AspectRatio>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">First Frame</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onCopy(prompt.first_frame_prompt)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
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
              onClick={() => onCopy(prompt.background_prompt)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
            {prompt.background_prompt}
          </p>
        </div>
        {prompt.negative_prompt && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-destructive/70">Negative</p>
            <p className="text-xs text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">{prompt.negative_prompt}</p>
          </div>
        )}

        {prompt.reference_urls && prompt.reference_urls.length > 0 && (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] gap-1">
              <Image className="h-3 w-3" />
              {prompt.reference_urls.length} ref image{prompt.reference_urls.length > 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
          {generating ? "Generating..." : displayImage ? "Re-generate (Base + Upscale)" : "Generate Image (Base + Upscale)"}
        </Button>
      </CardContent>
    </Card>
  );
}
