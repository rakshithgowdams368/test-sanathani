import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Mic, Volume2 } from "lucide-react";
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            Voiceover Script
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(
              typeof brief.voiceover_script === "string"
                ? brief.voiceover_script
                : JSON.stringify(brief.voiceover_script, null, 2)
            )}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
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
            <VoiceScriptDisplay script={brief.voiceover_script} />
          )}
        </CardContent>
      </Card>

      {brief.sfx_cues && Array.isArray(brief.sfx_cues) && brief.sfx_cues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              SFX Cues
            </CardTitle>
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

function VoiceScriptDisplay({ script }: { script: any }) {
  const lines = parseScript(script);

  if (lines.length === 0) {
    return (
      <div className="rounded-md bg-muted/50 p-3">
        <p className="whitespace-pre-wrap text-xs leading-relaxed">
          {typeof script === "string" ? script : JSON.stringify(script, null, 2)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <div
          key={i}
          className="group relative rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
        >
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="shrink-0 font-mono text-[10px] mt-0.5">
              {line.shot_code}
            </Badge>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm leading-relaxed">{line.line_local}</p>
              {line.delivery_en && (
                <p className="text-[11px] italic text-muted-foreground leading-relaxed">
                  {line.delivery_en}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function parseScript(script: any): Array<{ shot_code: string; line_local: string; delivery_en?: string }> {
  if (Array.isArray(script)) return script;

  if (typeof script === "string") {
    try {
      const parsed = JSON.parse(script);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON
    }
  }

  return [];
}
