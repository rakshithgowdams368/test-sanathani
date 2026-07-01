import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanEye, Upload, Film, Palette, Mic, Eye, Layers, ArrowRight, Copy, Loader as Loader2, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { extractFramesAndPalette, type ExtractionResult, type ExtractionProgress } from "@/lib/video-extract";

type Stage = "idle" | "extracting" | "transcribing" | "analyzing" | "reconstructing" | "ready" | "error";

const STAGES: { key: Stage; label: string; icon: any }[] = [
  { key: "extracting", label: "Extracting Frames", icon: Film },
  { key: "transcribing", label: "Transcribing Audio", icon: Mic },
  { key: "analyzing", label: "Analyzing DNA", icon: Eye },
  { key: "reconstructing", label: "Reconstructing", icon: Layers },
  { key: "ready", label: "Ready", icon: CheckCircle2 },
];

export function CopyCatPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [videoDna, setVideoDna] = useState<any>(null);
  const [growthPack, setGrowthPack] = useState<any>(null);
  const [, setAnalysisId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file (mp4, mov, webm).");
      return;
    }

    setFileName(file.name);
    setError(null);
    setStage("extracting");

    try {
      // Get auth session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Upload video to Supabase Storage first
      const fileExt = file.name.split(".").pop() || "mp4";
      const filePath = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("copycat-videos")
        .upload(filePath, file, { contentType: file.type });

      if (uploadErr) throw new Error(`Video upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage
        .from("copycat-videos")
        .getPublicUrl(filePath);

      const videoStorageUrl = urlData?.publicUrl || filePath;
      toast.success("Video uploaded to storage");

      // Stage A: Client-side frame extraction
      const result = await extractFramesAndPalette(file, { fps: 1, maxFrames: 36, longSide: 512, swatches: 5 }, setExtractionProgress);
      setExtraction(result);

      // Create analysis record with video URL
      const { data: analysis, error: insertErr } = await supabase
        .from("copycat_analyses")
        .insert({
          source_video_url: videoStorageUrl,
          meta: result.meta,
          frame_count: result.frames.length,
          status: "extracting",
        })
        .select("id")
        .single();

      if (insertErr || !analysis) throw new Error(`Failed to create analysis record: ${insertErr?.message || "Unknown error"}`);
      setAnalysisId(analysis.id);

      // Stage B: Transcribe audio
      setStage("transcribing");
      const transcribeRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ analysis_id: analysis.id, video_url: videoStorageUrl }),
        }
      );

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json().catch(() => ({ error: "Transcription failed" }));
        throw new Error(err.error || "Transcription failed");
      }

      const { transcript } = await transcribeRes.json();

      // Stage C: Vision analysis
      setStage("analyzing");
      const analyzeRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-video`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            analysis_id: analysis.id,
            frames: result.frames,
            meta: result.meta,
            transcript,
          }),
        }
      );

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({ error: "Analysis failed" }));
        throw new Error(err.error || "Video analysis failed");
      }

      const { video_dna } = await analyzeRes.json();
      setVideoDna(video_dna);

      // Stage D: Reconstruction — create a project and run orchestrate in from_video_dna mode
      setStage("reconstructing");

      const dnaMeta = video_dna.meta || {};
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({
          title: `CopyCat: ${file.name.replace(/\.[^.]+$/, "")}`,
          source_story: video_dna.reconstruction_notes || "Reconstructed from video analysis",
          format: (dnaMeta.duration_sec || 0) <= 90 ? "reel" : "longform",
          language: transcript?.language_guess || "kannada",
          target_duration_sec: Math.round(dnaMeta.duration_sec || 30),
          aspect_ratio: dnaMeta.aspect_ratio || "9:16",
          deity_theme: (video_dna.characters || []).map((c: any) => c.name).join(", ") || "observed",
          status: "generating",
        })
        .select("id")
        .single();

      if (projErr || !project) throw new Error(`Failed to create project: ${projErr?.message || "Unknown error"}`);
      setProjectId(project.id);

      const orchestrateRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orchestrate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            project_id: project.id,
            from_video_dna: true,
            video_dna,
            analysis_id: analysis.id,
          }),
        }
      );

      if (!orchestrateRes.ok) {
        const err = await orchestrateRes.json().catch(() => ({ error: "Reconstruction failed" }));
        throw new Error(err.error || "Reconstruction failed");
      }

      // Fetch growth pack
      const { data: gp } = await supabase
        .from("growth_packages")
        .select("*")
        .eq("project_id", project.id)
        .maybeSingle();
      setGrowthPack(gp);

      setStage("ready");
      toast.success("CopyCat analysis complete!");
    } catch (err: any) {
      setStage("error");
      setError(err.message);
      toast.error(err.message);
    }
  }, []);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const stageIndex = STAGES.findIndex((s) => s.key === stage);
  const progressPct = stage === "idle" ? 0 : stage === "ready" ? 100 : stage === "error" ? 0 : Math.min(95, ((stageIndex + 1) / STAGES.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ScanEye className="h-6 w-6 text-primary" />
          CopyCat
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a reference video. CopyCat reverse-engineers it frame-by-frame, pixel-by-pixel into a complete production package.
        </p>
      </div>

      {/* Originality note */}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          CopyCat recreates the style and technique. Bring your own story — original variations grow faster and respect other creators.
        </p>
      </div>

      {/* Upload zone (idle) */}
      {stage === "idle" && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm font-medium mb-1">Drop a reference video here</p>
            <p className="text-xs text-muted-foreground mb-4">MP4, MOV, or WebM (up to 500MB)</p>
            <label>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button asChild variant="default" className="cursor-pointer">
                <span><Upload className="h-4 w-4 mr-2" />Select Video</span>
              </Button>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Processing / Results */}
      {stage !== "idle" && (
        <div className="space-y-4">
          {/* Progress stepper */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{fileName}</span>
                {stage === "error" && (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <AlertCircle className="h-3 w-3" /> Error
                  </Badge>
                )}
                {stage === "ready" && (
                  <Badge className="gap-1 bg-green-600 text-white text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> Complete
                  </Badge>
                )}
              </div>
              <Progress value={progressPct} className="h-2 mb-3" />
              <div className="flex gap-1">
                {STAGES.map((s, i) => {
                  const Icon = s.icon;
                  const isActive = s.key === stage;
                  const isPast = stageIndex > i;
                  const isFailed = stage === "error" && stageIndex === i;
                  return (
                    <div
                      key={s.key}
                      className={`flex-1 flex items-center gap-1 rounded px-2 py-1.5 text-[10px] font-medium ${
                        isActive ? "bg-primary/10 text-primary" :
                        isPast ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" :
                        isFailed ? "bg-red-50 text-red-700 dark:bg-red-950/30" :
                        "text-muted-foreground"
                      }`}
                    >
                      {isActive && stage !== "ready" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isPast || s.key === "ready" && stage === "ready" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                  );
                })}
              </div>
              {stage === "extracting" && extractionProgress && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Sampling frame {extractionProgress.current} / {extractionProgress.total}...
                </p>
              )}
              {error && (
                <p className="text-xs text-destructive mt-2">{error}</p>
              )}
            </CardContent>
          </Card>

          {/* Filmstrip preview */}
          {extraction && extraction.frames.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  Sampled Frames ({extraction.frames.length})
                  <Badge variant="outline" className="text-[10px]">
                    {extraction.meta.aspect} | {extraction.meta.duration.toFixed(1)}s
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {extraction.frames.map((frame, i) => (
                    <div key={i} className="shrink-0 space-y-1">
                      <img
                        src={frame.dataUrl}
                        alt={`Frame ${i + 1}`}
                        className="h-20 w-auto rounded border object-cover"
                      />
                      <div className="flex gap-0.5 justify-center">
                        {frame.palette.map((hex, j) => (
                          <div
                            key={j}
                            className="h-2.5 w-2.5 rounded-full border border-white/30"
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                      <p className="text-center text-[9px] text-muted-foreground">{frame.t}s</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results tabs */}
          {(videoDna || stage === "ready") && (
            <Tabs defaultValue="dna">
              <TabsList>
                <TabsTrigger value="dna">Video DNA</TabsTrigger>
                <TabsTrigger value="characters">Characters</TabsTrigger>
                <TabsTrigger value="shots">Shots</TabsTrigger>
                <TabsTrigger value="captions">Captions & Hashtags</TabsTrigger>
              </TabsList>

              <TabsContent value="dna" className="space-y-3">
                {videoDna && <VideoDnaView dna={videoDna} onCopy={copyText} />}
              </TabsContent>

              <TabsContent value="characters" className="space-y-3">
                {videoDna?.characters?.map((c: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{c.name}</Badge>
                        {c.identity_guess && (
                          <span className="text-xs text-muted-foreground">({c.identity_guess})</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {c.skin && <div><span className="font-medium">Skin:</span> {c.skin}</div>}
                        {c.face && <div><span className="font-medium">Face:</span> {c.face}</div>}
                        {c.hair_crown && <div><span className="font-medium">Hair/Crown:</span> {c.hair_crown}</div>}
                        {c.ornaments && <div><span className="font-medium">Ornaments:</span> {c.ornaments}</div>}
                        {c.garments && <div><span className="font-medium">Garments:</span> {c.garments}</div>}
                        {c.attributes && <div><span className="font-medium">Attributes:</span> {c.attributes}</div>}
                      </div>
                      {c.consistency_token && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">{c.consistency_token}</Badge>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => copyText(c.consistency_token)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="shots" className="space-y-3">
                {videoDna?.shots?.map((shot: any, i: number) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex min-w-0">
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: shot.palette?.p60?.hex || "#666" }} />
                      <CardContent className="py-3 flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="font-mono text-xs">{shot.shot_code}</Badge>
                          <span className="text-[10px] text-muted-foreground">{shot.start_sec}s - {shot.end_sec}s ({shot.duration_sec}s)</span>
                        </div>
                        <p className="text-xs break-words">{shot.subject}</p>
                        <div className="flex flex-wrap gap-1">
                          {shot.framing && <Badge variant="outline" className="text-[10px]">{shot.framing}</Badge>}
                          {shot.lens_estimate && <Badge variant="outline" className="text-[10px]">{shot.lens_estimate}</Badge>}
                          {shot.camera_movement && <Badge variant="outline" className="text-[10px]">{shot.camera_movement}</Badge>}
                        </div>
                        {shot.lighting && <p className="text-[11px] text-muted-foreground break-words">{shot.lighting}</p>}
                        <div className="flex gap-1 items-center">
                          <Palette className="h-3 w-3 text-muted-foreground" />
                          {shot.palette?.p60 && <div className="h-4 w-4 rounded border" style={{ backgroundColor: shot.palette.p60.hex }} title={`60% ${shot.palette.p60.name}`} />}
                          {shot.palette?.p30 && <div className="h-4 w-4 rounded border" style={{ backgroundColor: shot.palette.p30.hex }} title={`30% ${shot.palette.p30.name}`} />}
                          {shot.palette?.p10 && <div className="h-4 w-4 rounded border" style={{ backgroundColor: shot.palette.p10.hex }} title={`10% ${shot.palette.p10.name}`} />}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="captions" className="space-y-4">
                <GrowthPackView growthPack={growthPack} onCopy={copyText} />
              </TabsContent>
            </Tabs>
          )}

          {/* Open as project button */}
          {stage === "ready" && projectId && (
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => navigate(`/project/${projectId}`)}
            >
              <ArrowRight className="h-4 w-4" />
              Open as Project — Generate Images & Video
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function VideoDnaView({ dna, onCopy }: { dna: any; onCopy: (t: string) => void }) {
  const meta = dna.meta || {};
  const audio = dna.audio || {};

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3 space-y-2">
          <p className="text-xs font-medium">Overall</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div><span className="text-muted-foreground">Style:</span> {meta.style}</div>
            <div><span className="text-muted-foreground">Grade:</span> {meta.grade}</div>
            <div><span className="text-muted-foreground">Pacing:</span> {meta.pacing}</div>
            <div><span className="text-muted-foreground">Energy:</span> {meta.energy_arc}</div>
            <div><span className="text-muted-foreground">Duration:</span> {meta.duration_sec}s</div>
            <div><span className="text-muted-foreground">Aspect:</span> {meta.aspect_ratio}</div>
            <div><span className="text-muted-foreground">FPS:</span> {meta.fps}</div>
          </div>
        </CardContent>
      </Card>

      {audio.music && !audio.has_speech && (
        <Card>
          <CardContent className="py-3 space-y-1">
            <p className="text-xs font-medium">Audio (Music Only)</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Mood:</span> {audio.music.mood}</div>
              <div><span className="text-muted-foreground">Tempo:</span> {audio.music.tempo}</div>
              <div><span className="text-muted-foreground">Instruments:</span> {audio.music.instrumentation}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {audio.has_speech && audio.dialogue?.length > 0 && (
        <Card>
          <CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium">Dialogue</p>
            <div className="space-y-1">
              {audio.dialogue.map((d: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] shrink-0">{d.t}s</Badge>
                  <span className="font-medium shrink-0">{d.speaker}:</span>
                  <span className="text-muted-foreground break-words">{d.line}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dna.reconstruction_notes && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium mb-1">Reconstruction Notes</p>
            <p className="text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
              {dna.reconstruction_notes}
            </p>
            <Button variant="ghost" size="sm" className="mt-1 h-6 text-[10px]" onClick={() => onCopy(dna.reconstruction_notes)}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GrowthPackView({ growthPack, onCopy }: { growthPack: any; onCopy: (t: string) => void }) {
  if (!growthPack) {
    return <p className="text-sm text-muted-foreground">Growth pack will appear after reconstruction.</p>;
  }

  const igCaption = growthPack.caption || "";
  const igHashtags = Array.isArray(growthPack.hashtags) ? growthPack.hashtags.join(" ") : "";
  const ytTitles = growthPack.titles?.youtube || growthPack.titles?.shorts || [];
  const hooks = Array.isArray(growthPack.titles?.reel) ? growthPack.titles.reel : [];

  return (
    <div className="space-y-4">
      {/* Instagram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Instagram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Caption</p>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onCopy(igCaption)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap">
              {igCaption}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Hashtags</p>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onCopy(igHashtags)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="rounded-md bg-muted/50 p-2 text-xs leading-relaxed text-blue-600 dark:text-blue-400 break-words">
              {igHashtags}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* YouTube */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">YouTube</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ytTitles.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Title Options</p>
              {ytTitles.map((t: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <p className="flex-1 rounded-md bg-muted/50 px-2 py-1 text-xs">{t}</p>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => onCopy(t)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {hooks.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Hook Variants</p>
              {hooks.map((h: string, i: number) => (
                <p key={i} className="text-xs text-muted-foreground">{i + 1}. {h}</p>
              ))}
            </div>
          )}
          {growthPack.best_post_time && (
            <p className="text-xs"><span className="text-muted-foreground">Best post time (IST):</span> {growthPack.best_post_time}</p>
          )}
          {growthPack.thumbnail_concept && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Thumbnail Concept</p>
              <p className="text-xs text-muted-foreground">{growthPack.thumbnail_concept}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export { CopyCatPage }