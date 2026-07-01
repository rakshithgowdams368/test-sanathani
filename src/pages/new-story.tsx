import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Film, Clapperboard, Zap } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type StepId = "story" | "format" | "details";

const STEPS: { id: StepId; label: string }[] = [
  { id: "story", label: "Story" },
  { id: "format", label: "Format" },
  { id: "details", label: "Details" },
];

export function NewStoryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>("story");
  const [formData, setFormData] = useState({
    source_story: "",
    title: "",
    format: "reel" as "reel" | "longform",
    language: "kannada",
    target_duration_sec: 30,
    aspect_ratio: "9:16",
    deity_theme: "",
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: formData.title || "Untitled Story",
          source_story: formData.source_story,
          format: formData.format,
          language: formData.language,
          target_duration_sec: formData.target_duration_sec,
          aspect_ratio: formData.aspect_ratio,
          deity_theme: formData.deity_theme,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Project created!");
      navigate(`/project/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const nextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setStep(STEPS[currentStepIndex - 1].id);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wide sm:text-2xl">New Story</h1>
        <p className="text-sm text-muted-foreground">
          Paste or type your mythological story and configure the production.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between gap-1 sm:justify-start sm:gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setStep(s.id)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i <= currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </button>
            <span
              className={`hidden text-xs sm:inline ${
                s.id === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-4 sm:w-8 ${i < currentStepIndex ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === "story" && (
            <Card>
              <CardHeader>
                <CardTitle>Your Story</CardTitle>
                <CardDescription>
                  Paste from scripture, retell in your words, or write an original mythological narrative.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Shiva's Cosmic Dance"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="story">Story / Source Text</Label>
                  <Textarea
                    id="story"
                    rows={8}
                    placeholder="Paste or type the story here..."
                    value={formData.source_story}
                    onChange={(e) => setFormData({ ...formData, source_story: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deity">Deity / Theme</Label>
                  <Input
                    id="deity"
                    placeholder="e.g., Shiva, Krishna, Varaha, Durga..."
                    value={formData.deity_theme}
                    onChange={(e) => setFormData({ ...formData, deity_theme: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === "format" && (
            <Card>
              <CardHeader>
                <CardTitle>Format</CardTitle>
                <CardDescription>Choose between Reel or Long-form production.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    onClick={() => setFormData({ ...formData, format: "reel", aspect_ratio: "9:16", target_duration_sec: 30 })}
                    className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all ${
                      formData.format === "reel"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Film className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <p className="font-semibold">Reel</p>
                      <p className="text-xs text-muted-foreground">15-60s, 9:16, hook-driven</p>
                    </div>
                    <Badge variant="outline">4-8 shots</Badge>
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, format: "longform", aspect_ratio: "16:9", target_duration_sec: 180 })}
                    className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-all ${
                      formData.format === "longform"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Clapperboard className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <p className="font-semibold">Long-form</p>
                      <p className="text-xs text-muted-foreground">2-10 min, 16:9, chapters</p>
                    </div>
                    <Badge variant="outline">24-40+ shots</Badge>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "details" && (
            <Card>
              <CardHeader>
                <CardTitle>Production Details</CardTitle>
                <CardDescription>Configure language, duration, and aspect ratio.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <div className="flex flex-wrap gap-2">
                    {["kannada", "kanglish", "english"].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setFormData({ ...formData, language: lang })}
                        className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                          formData.language === lang
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Target Duration:{" "}
                    <span className="text-primary">{formData.target_duration_sec}s</span>
                  </Label>
                  <Slider
                    value={[formData.target_duration_sec]}
                    onValueChange={([val]) => setFormData({ ...formData, target_duration_sec: val })}
                    min={formData.format === "reel" ? 15 : 120}
                    max={formData.format === "reel" ? 60 : 600}
                    step={formData.format === "reel" ? 5 : 30}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formData.format === "reel" ? "15s" : "2 min"}</span>
                    <span>{formData.format === "reel" ? "60s" : "10 min"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  <div className="flex gap-2">
                    {(formData.format === "reel" ? ["9:16"] : ["16:9", "9:16"]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setFormData({ ...formData, aspect_ratio: ratio })}
                        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                          formData.aspect_ratio === ratio
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep} disabled={currentStepIndex === 0}>
          Back
        </Button>
        {currentStepIndex < STEPS.length - 1 ? (
          <Button onClick={nextStep}>Next</Button>
        ) : (
          <Button
            onClick={() => createProject.mutate()}
            disabled={createProject.isPending || !formData.source_story}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            {createProject.isPending ? "Creating..." : "Create & Generate"}
          </Button>
        )}
      </div>
    </div>
  );
}
