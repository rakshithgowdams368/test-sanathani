import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Users, Camera, Image, Video, Music, TrendingUp, Zap, Loader as Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { StoryBlueprintView } from "@/components/pipeline/story-blueprint";
import { CharactersView } from "@/components/pipeline/characters";
import { StoryboardView } from "@/components/pipeline/storyboard";
import { ImagePromptsView } from "@/components/pipeline/image-prompts";
import { VideoPromptsView } from "@/components/pipeline/video-prompts";
import { AudioBriefView } from "@/components/pipeline/audio-brief";
import { GrowthPackageView } from "@/components/pipeline/growth-package";

const AGENTS = [
  { key: "story_architect", label: "Story Blueprint", icon: BookOpen },
  { key: "character_designer", label: "Characters", icon: Users },
  { key: "cinematographer", label: "Storyboard", icon: Camera },
  { key: "image_prompt_engineer", label: "Image Prompts", icon: Image },
  { key: "video_prompt_engineer", label: "Video Prompts", icon: Video },
  { key: "sound_designer", label: "Audio Brief", icon: Music },
  { key: "growth_strategist", label: "Growth Package", icon: TrendingUp },
];

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [orchestrating, setOrchestrating] = useState(false);
  const [activeAgent, setActiveAgent] = useState(0);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: blueprint } = useQuery({
    queryKey: ["blueprint", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("story_blueprints")
        .select("*")
        .eq("project_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("project_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shots } = useQuery({
    queryKey: ["shots", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shots")
        .select("*")
        .eq("project_id", id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: imagePrompts } = useQuery({
    queryKey: ["image_prompts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_prompts")
        .select("*, shots!inner(project_id)")
        .eq("shots.project_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: videoPrompts } = useQuery({
    queryKey: ["video_prompts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_prompts")
        .select("*, shots!inner(project_id)")
        .eq("shots.project_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: audioBrief } = useQuery({
    queryKey: ["audio_brief", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_briefs")
        .select("*")
        .eq("project_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: growthPackage } = useQuery({
    queryKey: ["growth_package", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("growth_packages")
        .select("*")
        .eq("project_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const runOrchestrate = async () => {
    if (!project) return;
    setOrchestrating(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orchestrate`;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ project_id: project.id }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      toast.success("Generation pipeline complete!");
      queryClient.invalidateQueries({ queryKey: ["blueprint", id] });
      queryClient.invalidateQueries({ queryKey: ["characters", id] });
      queryClient.invalidateQueries({ queryKey: ["shots", id] });
      queryClient.invalidateQueries({ queryKey: ["image_prompts", id] });
      queryClient.invalidateQueries({ queryKey: ["video_prompts", id] });
      queryClient.invalidateQueries({ queryKey: ["audio_brief", id] });
      queryClient.invalidateQueries({ queryKey: ["growth_package", id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOrchestrating(false);
    }
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-muted-foreground">Project not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold tracking-wide sm:text-2xl">{project.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{project.format}</Badge>
            <Badge variant="outline">{project.aspect_ratio}</Badge>
            <Badge variant="outline">{project.target_duration_sec}s</Badge>
            <Badge variant="secondary">{project.status}</Badge>
          </div>
        </div>
        <Button
          onClick={runOrchestrate}
          disabled={orchestrating}
          className="w-full gap-2 sm:w-auto"
        >
          {orchestrating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {orchestrating ? "Generating..." : "Generate Package"}
        </Button>
      </div>

      <Tabs
        value={AGENTS[activeAgent].key}
        onValueChange={(v) => setActiveAgent(AGENTS.findIndex((a) => a.key === v))}
      >
        <div className="-mx-4 overflow-x-auto px-4 md:-mx-0 md:px-0">
          <TabsList className="inline-flex w-max sm:w-full sm:justify-start">
            {AGENTS.map((agent) => (
              <TabsTrigger key={agent.key} value={agent.key} className="gap-1.5">
                <agent.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{agent.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="story_architect">
          <StoryBlueprintView blueprint={blueprint} />
        </TabsContent>
        <TabsContent value="character_designer">
          <CharactersView characters={characters ?? []} projectId={id!} />
        </TabsContent>
        <TabsContent value="cinematographer">
          <StoryboardView shots={shots ?? []} projectId={id!} />
        </TabsContent>
        <TabsContent value="image_prompt_engineer">
          <ImagePromptsView prompts={imagePrompts ?? []} projectId={id!} />
        </TabsContent>
        <TabsContent value="video_prompt_engineer">
          <VideoPromptsView prompts={videoPrompts ?? []} projectId={id!} />
        </TabsContent>
        <TabsContent value="sound_designer">
          <AudioBriefView brief={audioBrief} />
        </TabsContent>
        <TabsContent value="growth_strategist">
          <GrowthPackageView data={growthPackage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
