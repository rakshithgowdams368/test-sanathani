import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Loader as Loader2, Circle as XCircle, RefreshCw, Sparkles, Wand as Wand2, Copy, Check, History, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface CharactersViewProps {
  characters: any[];
  projectId: string;
}

const IMAGE_MODELS = [
  { id: "nano-banana-2", label: "Nano Banana 2" },
  { id: "flux-1.1-pro", label: "Flux 1.1 Pro" },
  { id: "flux-dev", label: "Flux Dev" },
  { id: "flux-schnell", label: "Flux Schnell" },
  { id: "ideogram-v2", label: "Ideogram V2" },
  { id: "recraft-v3", label: "Recraft V3" },
];

const LLM_MODELS = [
  { id: "gemini", label: "Gemini 2.5 Flash", icon: "G" },
  { id: "claude", label: "Claude Sonnet", icon: "C" },
  { id: "openai", label: "GPT-4o", icon: "O" },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 (Square)" },
  { id: "3:4", label: "3:4 (Portrait)" },
  { id: "4:3", label: "4:3 (Landscape)" },
  { id: "9:16", label: "9:16 (Tall)" },
  { id: "16:9", label: "16:9 (Wide)" },
  { id: "2:3", label: "2:3 (Poster)" },
];

type JobStatus = "idle" | "submitting" | "queuing" | "processing" | "success" | "failed";

interface GenerationState {
  status: JobStatus;
  progress: number;
  taskId?: string;
  resultUrl?: string;
  error?: string;
}

function useGenerationTracker(characterId: string, projectId: string) {
  const [state, setState] = useState<GenerationState>({ status: "idle", progress: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const { data: job } = await supabase
      .from("generation_jobs")
      .select("status, result_url, error")
      .eq("project_id", projectId)
      .contains("input", { character_id: characterId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!job) return;

    if (job.status === "success" && job.result_url) {
      setState({ status: "success", progress: 100, resultUrl: job.result_url });
      stopPolling();
    } else if (job.status === "failed") {
      setState({ status: "failed", progress: 0, error: job.error || "Generation failed" });
      stopPolling();
    } else {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const estimatedProgress = Math.min(90, Math.round(10 + elapsed * 1.5));
      setState((prev) => ({
        ...prev,
        status: job.status === "queuing" ? "queuing" : "processing",
        progress: estimatedProgress,
      }));
    }
  }, [characterId, projectId, stopPolling]);

  const startTracking = useCallback((taskId: string) => {
    startTimeRef.current = Date.now();
    setState({ status: "queuing", progress: 5, taskId });
    intervalRef.current = setInterval(poll, 3000);
  }, [poll]);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  return { state, setState, startTracking, stopPolling };
}

export function CharactersView({ characters, projectId }: CharactersViewProps) {
  const queryClient = useQueryClient();
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});

  if (!characters || characters.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No characters yet. Run the Character Designer agent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {characters.map((char) => (
        <CharacterCard
          key={char.id}
          char={char}
          projectId={projectId}
          selectedModel={selectedModels[char.id] || "nano-banana-2"}
          onModelChange={(value) =>
            setSelectedModels((prev) => ({ ...prev, [char.id]: value }))
          }
          queryClient={queryClient}
        />
      ))}
    </div>
  );
}

function CharacterCard({
  char,
  projectId,
  selectedModel,
  onModelChange,
  queryClient,
}: {
  char: any;
  projectId: string;
  selectedModel: string;
  onModelChange: (value: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { state, setState, startTracking } = useGenerationTracker(char.id, projectId);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);

  // Master prompt state
  const [showMasterPrompt, setShowMasterPrompt] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [characterAnalysis, setCharacterAnalysis] = useState("");
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [selectedLlm, setSelectedLlm] = useState("gemini");
  const [autoGenerateImage, setAutoGenerateImage] = useState(true);
  const [copied, setCopied] = useState(false);

  const dna = char.dna || {};
  const imageUrl = char.ref_image_url || state.resultUrl;

  const handleGenerateMasterPrompt = async () => {
    setGeneratingPrompt(true);
    setMasterPrompt("");
    setNegativePrompt("");
    setCharacterAnalysis("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-character-prompt`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            character_id: char.id,
            project_id: projectId,
            aspect_ratio: selectedRatio,
            llm_model: selectedLlm,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const result = await response.json();
      const data = result.data;

      setMasterPrompt(data.master_prompt || "");
      setNegativePrompt(data.recommended_negative || "");
      setCharacterAnalysis(data.character_analysis || "");
      toast.success("Master prompt generated!");

      if (autoGenerateImage && data.master_prompt) {
        triggerImageGeneration(data.master_prompt, session.access_token);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const triggerImageGeneration = async (prompt: string, accessToken: string) => {
    setShowMasterPrompt(false);
    setState({ status: "submitting", progress: 2 });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kie-character-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            character_id: char.id,
            project_id: projectId,
            model: selectedModel,
            prompt,
            aspect_ratio: selectedRatio,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const result = await response.json();
      startTracking(result.taskId);
      toast.success("Image generation started!");
    } catch (err: any) {
      toast.error(err.message);
      setState({ status: "failed", progress: 0, error: err.message });
    }
  };

  const handleGenerateFromPrompt = async () => {
    if (!masterPrompt.trim()) {
      toast.error("No prompt to generate from");
      return;
    }

    setShowMasterPrompt(false);
    setState({ status: "submitting", progress: 2 });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        setState({ status: "idle", progress: 0 });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kie-character-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            character_id: char.id,
            project_id: projectId,
            model: selectedModel,
            prompt: masterPrompt,
            aspect_ratio: selectedRatio,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const result = await response.json();
      startTracking(result.taskId);
    } catch (err: any) {
      toast.error(err.message);
      setState({ status: "failed", progress: 0, error: err.message });
    }
  };

  const handleQuickGenerate = async () => {
    setShowRegenerate(false);
    setState({ status: "submitting", progress: 2 });

    const prompt = char.turnaround_prompt || buildQuickPrompt();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        setState({ status: "idle", progress: 0 });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kie-character-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            character_id: char.id,
            project_id: projectId,
            model: selectedModel,
            prompt,
            aspect_ratio: selectedRatio,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const result = await response.json();
      startTracking(result.taskId);
    } catch (err: any) {
      toast.error(err.message);
      setState({ status: "failed", progress: 0, error: err.message });
    }
  };

  const buildQuickPrompt = () => {
    const parts = [
      `Character reference sheet of ${char.name}`,
      char.role && `(${char.role})`,
      dna.skin && `skin: ${dna.skin}`,
      dna.hair_crown && `hair/crown: ${dna.hair_crown}`,
      dna.garments && `garments: ${dna.garments}`,
      dna.weapons_attributes && `holding: ${dna.weapons_attributes}`,
      char.consistency_token,
      "highly detailed, mythological Indian art style, cinematic lighting, front and 3/4 view",
    ];
    return parts.filter(Boolean).join(", ");
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(masterPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (state.status === "success") {
      setImageLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["characters", projectId] });
    }
  }, [state.status, queryClient, projectId]);

  const statusLabel = () => {
    switch (state.status) {
      case "submitting": return "Submitting request...";
      case "queuing": return "Queued - waiting for generation slot...";
      case "processing": return "Generating image...";
      case "success": return "Complete!";
      case "failed": return state.error || "Generation failed";
      default: return "";
    }
  };

  const isActive = state.status !== "idle" && state.status !== "success" && state.status !== "failed";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{char.name}</CardTitle>
          {char.sanskrit_name && (
            <p className="text-xs text-muted-foreground">{char.sanskrit_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CharacterHistoryDialog characterId={char.id} characterName={char.name} projectId={projectId} />
          <Badge variant="outline" className="max-w-[50%] rounded-sm whitespace-normal text-right">{char.role}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {char.consistency_token && (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Identity Token</p>
            <p className="mt-0.5 text-xs">{char.consistency_token}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          {dna.skin && (
            <div><span className="text-muted-foreground">Skin: </span>{dna.skin}</div>
          )}
          {dna.hair_crown && (
            <div><span className="text-muted-foreground">Hair/Crown: </span>{dna.hair_crown}</div>
          )}
          {dna.garments && (
            <div><span className="text-muted-foreground">Garments: </span>{dna.garments}</div>
          )}
          {dna.weapons_attributes && (
            <div><span className="text-muted-foreground">Weapons: </span>{dna.weapons_attributes}</div>
          )}
        </div>

        {dna.color_signature && (
          <div className="flex items-center gap-1">
            {dna.color_signature.map((hex: string, i: number) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        )}

        {/* Image display area */}
        {imageUrl && !isActive ? (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-md border bg-muted">
              <AspectRatio ratio={1}>
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <img
                  src={imageUrl}
                  alt={`${char.name} reference`}
                  className={`h-full w-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageLoaded(true)}
                />
              </AspectRatio>
            </div>

            {showRegenerate ? (
              <div className="space-y-2">
                <Select value={selectedModel} onValueChange={onModelChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleQuickGenerate}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowRegenerate(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-xs text-muted-foreground"
                onClick={() => setShowRegenerate(true)}
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate Reference
              </Button>
            )}
          </div>
        ) : isActive ? (
          <div className="space-y-3 rounded-md border border-dashed p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-medium">{statusLabel()}</span>
            </div>
            <Progress value={state.progress} className="h-2" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {state.status === "queuing" ? "Waiting in queue..." : "Processing with kie.ai"}
              </span>
              <span className="text-xs font-medium text-primary">{state.progress}%</span>
            </div>
          </div>
        ) : state.status === "failed" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
              <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span className="text-xs text-destructive">{state.error}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setState({ status: "idle", progress: 0 })}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {/* Master Prompt Section - shown when no image and not generating */}
        {!imageUrl && !isActive && state.status !== "failed" && (
          <>
            <Separator />
            {!showMasterPrompt ? (
              <div className="space-y-2">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowMasterPrompt(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Character Sheet Master Prompt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleQuickGenerate}
                >
                  <Image className="h-3.5 w-3.5" />
                  Quick Generate (Basic Prompt)
                </Button>
              </div>
            ) : (
              <MasterPromptPanel
                generatingPrompt={generatingPrompt}
                masterPrompt={masterPrompt}
                negativePrompt={negativePrompt}
                characterAnalysis={characterAnalysis}
                selectedRatio={selectedRatio}
                selectedModel={selectedModel}
                selectedLlm={selectedLlm}
                autoGenerateImage={autoGenerateImage}
                copied={copied}
                onRatioChange={setSelectedRatio}
                onModelChange={onModelChange}
                onLlmChange={setSelectedLlm}
                onAutoGenerateChange={setAutoGenerateImage}
                onMasterPromptChange={setMasterPrompt}
                onGeneratePrompt={handleGenerateMasterPrompt}
                onGenerateImage={handleGenerateFromPrompt}
                onCopy={handleCopyPrompt}
                onClose={() => setShowMasterPrompt(false)}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MasterPromptPanel({
  generatingPrompt,
  masterPrompt,
  negativePrompt,
  characterAnalysis,
  selectedRatio,
  selectedModel,
  selectedLlm,
  autoGenerateImage,
  copied,
  onRatioChange,
  onModelChange,
  onLlmChange,
  onAutoGenerateChange,
  onMasterPromptChange,
  onGeneratePrompt,
  onGenerateImage,
  onCopy,
  onClose,
}: {
  generatingPrompt: boolean;
  masterPrompt: string;
  negativePrompt: string;
  characterAnalysis: string;
  selectedRatio: string;
  selectedModel: string;
  selectedLlm: string;
  autoGenerateImage: boolean;
  copied: boolean;
  onRatioChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onLlmChange: (v: string) => void;
  onAutoGenerateChange: (v: boolean) => void;
  onMasterPromptChange: (v: string) => void;
  onGeneratePrompt: () => void;
  onGenerateImage: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          Character Sheet Master Prompt
        </h4>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* LLM Model Selection */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">AI Model for Prompt Generation</label>
        <div className="grid grid-cols-3 gap-1.5">
          {LLM_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => onLlmChange(m.id)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium transition-all ${
                selectedLlm === m.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                selectedLlm === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {m.icon}
              </span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect ratio + Image model row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Aspect Ratio</label>
          <Select value={selectedRatio} onValueChange={onRatioChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Image Model</label>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Auto-generate toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoGenerateImage}
          onChange={(e) => onAutoGenerateChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
        />
        <span className="text-[10px] text-muted-foreground">
          Auto-generate character sheet image after prompt is ready
        </span>
      </label>

      <Button
        variant="secondary"
        size="sm"
        className="w-full gap-2"
        onClick={onGeneratePrompt}
        disabled={generatingPrompt}
      >
        {generatingPrompt ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {generatingPrompt ? "Researching & Generating Prompt..." : "Generate Master Prompt"}
      </Button>

      {/* Generated prompt output */}
      {masterPrompt && (
        <div className="space-y-2">
          {characterAnalysis && (
            <div className="rounded bg-primary/5 p-2">
              <p className="text-[10px] font-medium text-primary">Character Analysis</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{characterAnalysis}</p>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-muted-foreground">Master Prompt (editable)</label>
              <Button variant="ghost" size="sm" className="h-5 gap-1 px-1.5 text-[10px]" onClick={onCopy}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Textarea
              value={masterPrompt}
              onChange={(e) => onMasterPromptChange(e.target.value)}
              className="min-h-[120px] text-xs leading-relaxed"
            />
          </div>

          {negativePrompt && (
            <div className="rounded bg-destructive/5 p-2">
              <p className="text-[10px] font-medium text-destructive">Negative Prompt</p>
              <p className="mt-0.5 text-xs">{negativePrompt}</p>
            </div>
          )}

          {!autoGenerateImage && (
            <Button
              variant="default"
              size="sm"
              className="w-full gap-2"
              onClick={onGenerateImage}
            >
              <Image className="h-3.5 w-3.5" />
              Generate Character Sheet Image
            </Button>
          )}

          {autoGenerateImage && (
            <div className="flex items-center gap-2 rounded bg-primary/5 p-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-primary font-medium">
                Image generation will start automatically
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface HistoryEntry {
  id: string;
  kind: "prompt" | "image";
  prompt: string | null;
  negative_prompt: string | null;
  aspect_ratio: string | null;
  model: string | null;
  result_url: string | null;
  character_analysis: string | null;
  status: string;
  created_at: string;
}

function CharacterHistoryDialog({
  characterId,
  characterName,
  projectId,
}: {
  characterId: string;
  characterName: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ["character_history", characterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("character_generation_history")
        .select("*")
        .eq("character_id", characterId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as HistoryEntry[];
    },
    enabled: open,
  });

  const prompts = history?.filter((h) => h.kind === "prompt") || [];
  const images = history?.filter((h) => h.kind === "image") || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <History className="h-3.5 w-3.5" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{characterName} - Generation History</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              All ({history?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex-1 gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Prompts ({prompts.length})
            </TabsTrigger>
            <TabsTrigger value="images" className="flex-1 gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Images ({images.length})
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="all">
                <HistoryList entries={history || []} />
              </TabsContent>
              <TabsContent value="prompts">
                <HistoryList entries={prompts} />
              </TabsContent>
              <TabsContent value="images">
                <HistoryList entries={images} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No history yet</p>
        <p className="text-xs text-muted-foreground">
          Generate prompts or images to see them here.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-3">
      <div className="space-y-3 py-2">
        {entries.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </ScrollArea>
  );
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const formattedDate = new Date(entry.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={entry.kind === "image" ? "default" : "secondary"} className="text-[10px]">
            {entry.kind === "image" ? "Image" : "Prompt"}
          </Badge>
          {entry.model && (
            <span className="text-[10px] text-muted-foreground">{entry.model}</span>
          )}
          {entry.aspect_ratio && (
            <span className="text-[10px] text-muted-foreground">{entry.aspect_ratio}</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
      </div>

      {entry.result_url && (
        <div className="overflow-hidden rounded border bg-muted">
          <AspectRatio ratio={1}>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <img
              src={entry.result_url}
              alt="Generated character sheet"
              className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </AspectRatio>
        </div>
      )}

      {entry.character_analysis && (
        <div className="rounded bg-primary/5 p-2">
          <p className="text-[10px] font-medium text-primary">Analysis</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.character_analysis}</p>
        </div>
      )}

      {entry.prompt && (
        <div className="space-y-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? "Hide prompt" : "Show prompt"}
          </button>
          {expanded && (
            <div className="rounded bg-muted/50 p-2">
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{entry.prompt}</p>
              {entry.negative_prompt && (
                <div className="mt-2 border-t pt-2">
                  <p className="text-[10px] font-medium text-destructive">Negative</p>
                  <p className="text-xs text-muted-foreground">{entry.negative_prompt}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
