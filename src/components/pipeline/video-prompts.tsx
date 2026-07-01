import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Copy, Mic, Lock, Move, Sparkles, Volume2, Loader as Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const VIDEO_MODELS = [
  { id: "kling-3.0", label: "Kling 3.0 (dialogue + audio)", audio: true },
  { id: "veo3", label: "Veo 3 (synced audio)", audio: true },
  { id: "bytedance/seedance-2.0", label: "Seedance 2.0 (motion + audio)", audio: true },
  { id: "kling-ai-avatar-pro", label: "Kling Avatar Pro (lip-sync)", audio: true },
  { id: "omnihuman-1.5", label: "OmniHuman 1.5 (talking portrait)", audio: true },
  { id: "volcengine-lip-sync", label: "Volcengine Lip-sync (post)", audio: false },
  { id: "bytedance/seedance-2.0-fast", label: "Seedance 2.0 Fast (silent)", audio: false },
];

interface VideoPromptsViewProps {
  prompts: any[];
  projectId: string;
}

export function VideoPromptsView({ prompts, projectId }: VideoPromptsViewProps) {
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-4">
      {prompts.map((prompt) => (
        <VideoPromptCard
          key={prompt.id}
          prompt={prompt}
          projectId={projectId}
          queryClient={queryClient}
        />
      ))}
    </div>
  );
}

function VideoPromptCard({
  prompt,
  projectId,
  queryClient,
}: {
  prompt: any;
  projectId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [selectedModel, setSelectedModel] = useState(prompt.model || "kling-3.0");
  const [generating, setGenerating] = useState(false);

  const dialogue: any[] = Array.isArray(prompt.dialogue) ? prompt.dialogue : [];
  const hasDialogue = prompt.audio?.has_dialogue ?? dialogue.length > 0;
  const cameraMotion = prompt.camera_motion || {};
  const vfxList: string[] = Array.isArray(prompt.vfx) ? prompt.vfx : [];
  const sfxList: string[] = Array.isArray(prompt.sfx) ? prompt.sfx : [];
  const charactersPresent: any[] = Array.isArray(prompt.characters_present) ? prompt.characters_present : [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kie-video`,
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
            prompt: prompt.prompt,
            duration_sec: prompt.duration_sec,
            has_dialogue: hasDialogue,
            aspect_ratio: "16:9",
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      toast.success("Video generation started!");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["video_prompts", projectId] }), 10000);
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
          <Badge variant="outline" className="text-[10px]">
            {prompt.duration_sec || 10}s
          </Badge>
          {hasDialogue && (
            <Badge className="gap-1 bg-blue-600 text-white text-[10px]">
              <Mic className="h-3 w-3" />
              Dialogue
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Characters present */}
        {charactersPresent.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Lock className="h-3 w-3 text-muted-foreground" />
            {charactersPresent.map((c: any, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px] gap-1">
                {c.name}
              </Badge>
            ))}
            <span className="text-[10px] text-green-600 font-medium">Identity locked from init frame</span>
          </div>
        )}

        {/* Dialogue table */}
        {dialogue.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <div className="bg-muted/50 px-3 py-1.5 border-b">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Dialogue + Lip-Sync
              </p>
            </div>
            <div className="divide-y">
              {dialogue.map((line: any, i: number) => (
                <div key={i} className="px-3 py-2 flex items-start gap-3">
                  <Badge variant="secondary" className="shrink-0 text-[10px] mt-0.5">
                    {line.character}
                  </Badge>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs leading-relaxed">{line.line_local}</p>
                    {line.delivery_en && (
                      <p className="text-[11px] italic text-muted-foreground">
                        ({line.delivery_en})
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {line.lip_sync && (
                      <Badge className="bg-green-600/10 text-green-700 border-green-200 text-[9px] gap-0.5">
                        <Mic className="h-2.5 w-2.5" />
                        sync
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera motion */}
        {(cameraMotion.body || cameraMotion.lens) && (
          <div className="flex items-start gap-2">
            <Move className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {cameraMotion.body && (
                <Badge variant="outline" className="text-[10px]">{cameraMotion.body}</Badge>
              )}
              {cameraMotion.lens && (
                <Badge variant="outline" className="text-[10px]">{cameraMotion.lens}</Badge>
              )}
              {cameraMotion.speed && (
                <Badge variant="outline" className="text-[10px]">{cameraMotion.speed}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Movement + Expression arc */}
        {prompt.character_movement && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground">Movement</p>
            <p className="text-xs leading-relaxed">{prompt.character_movement}</p>
          </div>
        )}
        {prompt.expression_arc && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground">Expression Arc</p>
            <p className="text-xs leading-relaxed">{prompt.expression_arc}</p>
          </div>
        )}

        {/* VFX + SFX chips */}
        {(vfxList.length > 0 || sfxList.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {vfxList.map((v, i) => (
              <Badge key={`vfx-${i}`} variant="outline" className="text-[10px] gap-1 border-amber-200 text-amber-700">
                <Sparkles className="h-2.5 w-2.5" />
                {v}
              </Badge>
            ))}
            {sfxList.map((s, i) => (
              <Badge key={`sfx-${i}`} variant="outline" className="text-[10px] gap-1 border-blue-200 text-blue-700">
                <Volume2 className="h-2.5 w-2.5" />
                {s}
              </Badge>
            ))}
          </div>
        )}

        {/* Assembled prompt */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Assembled Prompt</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(prompt.prompt)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="rounded-md bg-muted/50 p-2 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
            {prompt.prompt}
          </p>
        </div>

        {/* Generate button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
          {generating ? "Generating..." : "Generate Video"}
        </Button>
      </CardContent>
    </Card>
  );
}
