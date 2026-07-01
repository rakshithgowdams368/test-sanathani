import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Film, Clapperboard } from "lucide-react";
import type { Project } from "@/store/project-store";

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide sm:text-2xl">Projects</h1>
          <p className="text-sm text-muted-foreground">Your mythological production packages</p>
        </div>
        <Button onClick={() => navigate("/new-story")} className="w-full gap-2 sm:w-auto">
          <PlusCircle className="h-4 w-4" />
          New Story
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">{project.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{project.deity_theme}</p>
                </div>
                <Badge variant={project.format === "reel" ? "default" : "secondary"}>
                  {project.format === "reel" ? (
                    <Film className="mr-1 h-3 w-3" />
                  ) : (
                    <Clapperboard className="mr-1 h-3 w-3" />
                  )}
                  {project.format}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{project.target_duration_sec}s</span>
                  <Badge variant="outline" className="text-[10px]">
                    {project.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Film className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold">No stories yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first mythological cinematic package.
            </p>
            <Button className="mt-4" onClick={() => navigate("/new-story")}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Story
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
