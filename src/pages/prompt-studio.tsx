import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Save } from "lucide-react";

const AGENT_LABELS: Record<string, string> = {
  story_architect: "Story Architect",
  character_designer: "Character Designer",
  cinematographer: "Cinematographer",
  image_prompt_engineer: "Image Prompt Engineer",
  video_prompt_engineer: "Video Prompt Engineer",
  sound_designer: "Sound Designer",
  growth_strategist: "Growth Strategist",
};

export function PromptStudioPage() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["prompt_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_templates")
        .select("*")
        .eq("is_active", true)
        .order("agent_key");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, system_prompt }: { id: string; system_prompt: string }) => {
      const { error } = await supabase
        .from("prompt_templates")
        .update({ system_prompt, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prompt saved");
      setEditingKey(null);
      queryClient.invalidateQueries({ queryKey: ["prompt_templates"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const startEditing = (template: any) => {
    setEditingKey(template.agent_key);
    setEditValue(template.system_prompt);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wide sm:text-2xl">Prompt Studio</h1>
        <p className="text-sm text-muted-foreground">
          Tune the 7 agent system prompts that power your generation engine.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-1/3 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {templates?.map((template) => (
            <Card key={template.id}>
              <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    {AGENT_LABELS[template.agent_key] || template.agent_key}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    v{template.version} - {template.agent_key}
                  </CardDescription>
                </div>
                <div className="flex gap-1.5">
                  {editingKey === template.agent_key ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingKey(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          updateMutation.mutate({
                            id: template.id,
                            system_prompt: editValue,
                          })
                        }
                        disabled={updateMutation.isPending}
                        className="gap-1"
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEditing(template)}>
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingKey === template.agent_key ? (
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                  />
                ) : (
                  <p className="line-clamp-4 text-xs text-muted-foreground">
                    {template.system_prompt}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {(!templates || templates.length === 0) && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  No prompt templates found. They will be created when you first run the generation engine.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
