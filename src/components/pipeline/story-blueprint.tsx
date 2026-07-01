import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StoryBlueprintViewProps {
  blueprint: any | null;
}

export function StoryBlueprintView({ blueprint }: StoryBlueprintViewProps) {
  if (!blueprint) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No blueprint yet. Click "Generate Package" to run the Story Architect agent.
          </p>
        </CardContent>
      </Card>
    );
  }

  const raw = blueprint.raw || {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{blueprint.logline}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Synopsis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{blueprint.synopsis}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tone & Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tone:</span>
              <Badge variant="outline">{blueprint.tone}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total Shots:</span>
              <Badge>{blueprint.total_shots}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {(blueprint.deities || raw.deities || []).map((d: any, i: number) => (
                <Badge key={i} variant="secondary">
                  {d.name || d}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {(blueprint.emotional_arc || raw.emotional_arc) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emotional Arc</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(blueprint.emotional_arc || raw.emotional_arc).map((beat: any, i: number) => (
                <div key={i} className="rounded-md border px-3 py-1.5">
                  <p className="text-xs font-medium">{beat.beat || beat.value_word_en}</p>
                  {beat.value_word_local && (
                    <p className="text-[10px] text-muted-foreground">{beat.value_word_local}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(blueprint.scene_beats || raw.scene_beats) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scene Beats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(blueprint.scene_beats || raw.scene_beats).map((scene: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-md border p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {scene.scene_no || i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{scene.beat}</p>
                    <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                      {scene.location && <span>{scene.location}</span>}
                      {scene.time_of_day && <span>- {scene.time_of_day}</span>}
                      {scene.est_duration_sec && <span>- {scene.est_duration_sec}s</span>}
                    </div>
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
