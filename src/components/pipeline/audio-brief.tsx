import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface AudioBriefViewProps {
  brief: any | null;
}

export function AudioBriefView({ brief }: AudioBriefViewProps) {
  if (!brief) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No audio brief yet. Run the Sound Designer agent.
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Suno Music Brief</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(brief.suno_style || "")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">Style</p>
              <p className="text-xs">{brief.suno_style}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">BPM</p>
              <p className="text-xs">{brief.suno_bpm || "—"}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-[10px] text-muted-foreground">Role</p>
              <p className="text-xs">{brief.music_role || "underscore"}</p>
            </div>
          </div>
          {brief.suno_lyrics && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Lyrics</p>
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
                {brief.suno_lyrics}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voiceover Script</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Badge variant="outline">{brief.voiceover_lang || "kannada"}</Badge>
            {brief.voice_settings && (
              <Badge variant="secondary">
                Stability: {brief.voice_settings.stability}
              </Badge>
            )}
          </div>
          {brief.voiceover_script && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="whitespace-pre-wrap text-xs leading-relaxed">
                {brief.voiceover_script}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {brief.sfx_cues && Array.isArray(brief.sfx_cues) && brief.sfx_cues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SFX Cues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {brief.sfx_cues.map((cue: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-md border p-2">
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                    {cue.shot_code}
                  </Badge>
                  <div className="flex-1 text-xs">
                    {cue.ambience && <p><span className="text-muted-foreground">Ambience: </span>{cue.ambience}</p>}
                    {cue.foley && <p><span className="text-muted-foreground">Foley: </span>{cue.foley}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
