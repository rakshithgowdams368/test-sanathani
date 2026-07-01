import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StoryboardViewProps {
  shots: any[];
}

export function StoryboardView({ shots }: StoryboardViewProps) {
  if (!shots || shots.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No shots yet. Run the Cinematographer agent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {shots.map((shot) => {
        const palette = shot.palette || {};
        const p60Color = palette.p60?.hex || "#333";
        return (
          <Card key={shot.id} className="overflow-hidden">
            <div className="flex">
              <div className="w-1.5 shrink-0" style={{ backgroundColor: p60Color }} />
              <div className="flex-1">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {shot.shot_code}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{shot.duration_sec}s</span>
                    </CardTitle>
                    <div className="flex gap-1">
                      {palette.p60 && (
                        <div
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: palette.p60.hex }}
                          title={`60% - ${palette.p60.name}`}
                        />
                      )}
                      {palette.p30 && (
                        <div
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: palette.p30.hex }}
                          title={`30% - ${palette.p30.name}`}
                        />
                      )}
                      {palette.p10 && (
                        <div
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: palette.p10.hex }}
                          title={`10% - ${palette.p10.name}`}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  <p className="text-sm">{shot.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {shot.lens && <Badge variant="outline" className="text-[10px]">{shot.lens}</Badge>}
                    {shot.framing && <Badge variant="outline" className="text-[10px]">{shot.framing}</Badge>}
                    {shot.movement && <Badge variant="outline" className="text-[10px]">{shot.movement}</Badge>}
                    {shot.lighting && <Badge variant="outline" className="text-[10px]">{shot.lighting}</Badge>}
                  </div>
                  {shot.expression && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Expression: </span>{shot.expression}
                    </p>
                  )}
                  {shot.action && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Action: </span>{shot.action}
                    </p>
                  )}
                </CardContent>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
