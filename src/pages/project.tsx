import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, Users, Camera, Image, Video, Music, TrendingUp, Zap, Loader as Loader2, Pencil, Trash2 } from "lucide-react";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orchestrating, setOrchestrating] = useState(false);
  const [activeAgent, setActiveAgent] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

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

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
      toast.success("Project deleted");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message);
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowEdit(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button
            onClick={runOrchestrate}
            disabled={orchestrating}
            className="gap-2"
          >
            {orchestrating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {orchestrating ? "Generating..." : "Generate Package"}
          </Button>
        </div>
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

      {showEdit && (
        <EditProjectDialog
          project={project}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["project", id] });
            setShowEdit(false);
          }}
        />
      )}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project.title}" and all its generated content. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditProjectDialog({
  project,
  onClose,
  onSaved,
}: {
  project: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [sourceStory, setSourceStory] = useState(project.source_story || "");
  const [format, setFormat] = useState(project.format);
  const [language, setLanguage] = useState(project.language);
  const [duration, setDuration] = useState(String(project.target_duration_sec));
  const [aspectRatio, setAspectRatio] = useState(project.aspect_ratio);
  const [deityTheme, setDeityTheme] = useState(project.deity_theme || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          title: title.trim(),
          source_story: sourceStory.trim() || null,
          format,
          language,
          target_duration_sec: parseInt(duration) || 30,
          aspect_ratio: aspectRatio,
          deity_theme: deityTheme.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id);
      if (error) throw error;
      toast.success("Project updated");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update your project settings</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Source Story</label>
            <Textarea value={sourceStory} onChange={(e) => setSourceStory(e.target.value)} className="min-h-[80px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Format</label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="longform">Longform</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Language</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kannada">Kannada</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Duration (sec)</label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Aspect Ratio</label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="4:5">4:5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Deity / Theme</label>
            <Input value={deityTheme} onChange={(e) => setDeityTheme(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
