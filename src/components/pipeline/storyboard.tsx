import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Loader as Loader2, Film, ChevronLeft, ChevronRight, Image as ImageIcon, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface StoryboardViewProps {
  shots: any[];
  projectId: string;
}

export function StoryboardView({ shots, projectId }: StoryboardViewProps) {
  const queryClient = useQueryClient();
  const [currentSheet, setCurrentSheet] = useState(0);
  const [generating, setGenerating] = useState(false);

  const { data: sheets } = useQuery({
    queryKey: ["storyboard_sheets", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storyboard_sheets")
        .select("*")
        .eq("project_id", projectId)
        .order("sheet_no", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const sceneCount = new Set(shots.map((s) => s.scene_no)).size;
  const sheetCount = sheets?.length || 0;

  const handleGenerateSheet = async (sheetNo: number) => {
    const sheet = sheets?.find((s) => s.sheet_no === sheetNo);
    if (!sheet?.sheet_prompt) {
      toast.error("No sheet prompt available. Re-run orchestration.");
      return;
    }

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
            project_id: projectId,
            model: sheet.model || "seedream-v4-5",
            prompt: sheet.sheet_prompt,
            negative_prompt: sheet.negative_prompt,
            aspect_ratio: "5:4",
            kind: "storyboard",
            sheet_no: sheetNo,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      toast.success(`Storyboard sheet ${sheetNo} generation started!`);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["storyboard_sheets", projectId] }), 5000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

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
    <div className="space-y-4">
      {/* Scene/Shot/Sheet summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="gap-1.5">
          <Film className="h-3 w-3" />
          {sceneCount} scene{sceneCount !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="secondary">
          {shots.length} shot{shots.length !== 1 ? "s" : ""}
        </Badge>
        {sheetCount > 0 && (
          <Badge variant="outline">
            {sheetCount} sheet{sheetCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Storyboard Sheets section */}
      {sheets && sheets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                Storyboard Sheets (5:4 Contact Sheets)
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentSheet === 0}
                  onClick={() => setCurrentSheet((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                  Sheet {currentSheet + 1} / {sheetCount}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentSheet >= sheetCount - 1}
                  onClick={() => setCurrentSheet((p) => Math.min(sheetCount - 1, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sheets[currentSheet] && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Covers: {sheets[currentSheet].covers}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => handleGenerateSheet(sheets[currentSheet].sheet_no)}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {sheets[currentSheet].base_url ? "Regenerate" : "Generate Sheet"}
                  </Button>
                </div>

                {sheets[currentSheet].base_url ? (
                  <div className="overflow-hidden rounded-md border bg-muted">
                    <AspectRatio ratio={5/4}>
                      <img
                        src={sheets[currentSheet].final_url || sheets[currentSheet].base_url}
                        alt={`Storyboard sheet ${sheets[currentSheet].sheet_no}`}
                        className="h-full w-full object-cover"
                      />
                    </AspectRatio>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-md border border-dashed bg-muted/30 py-12">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Click "Generate Sheet" to create the 3x2 contact sheet
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel labels */}
                {sheets[currentSheet].panels && (
                  <div className="grid grid-cols-3 gap-1">
                    {(sheets[currentSheet].panels as any[]).map((panel: any, i: number) => (
                      <div key={i} className="rounded bg-muted/50 px-2 py-1 text-center">
                        <span className="text-[10px] font-mono font-medium">{panel.shot_code}</span>
                        <p className="text-[9px] text-muted-foreground truncate">{panel.caption_en}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shot list */}
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
    </div>
  );
}
