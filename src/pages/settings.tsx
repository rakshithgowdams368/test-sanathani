import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, CheckCircle, XCircle } from "lucide-react";

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", description: "LLM brain (Claude, GPT, Gemini)" },
  { id: "kie", label: "kie.ai", description: "Image & Video generation" },
  { id: "elevenlabs", label: "ElevenLabs", description: "Voice synthesis" },
  { id: "suno", label: "Suno", description: "AI Music generation" },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});

  const { data: credentials } = useQuery({
    queryKey: ["api_credentials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_credentials")
        .select("id, provider, label, created_at");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ provider, key }: { provider: string; key: string }) => {
      const { error } = await supabase
        .from("api_credentials")
        .upsert(
          { provider, encrypted_key: key, label: `${provider} key` },
          { onConflict: "user_id,provider" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.provider} key saved`);
      setKeyInputs((prev) => ({ ...prev, [vars.provider]: "" }));
      queryClient.invalidateQueries({ queryKey: ["api_credentials"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const hasKey = (provider: string) =>
    credentials?.some((c) => c.provider === provider);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wide sm:text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your API keys and production defaults.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </CardTitle>
          <CardDescription>
            Keys are stored encrypted and only used server-side in Edge Functions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PROVIDERS.map((provider) => (
            <div key={provider.id} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{provider.label}</p>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </div>
                {hasKey(provider.id) ? (
                  <Badge variant="default" className="w-fit gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-fit gap-1 text-muted-foreground">
                    <XCircle className="h-3 w-3" />
                    Not set
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="password"
                  placeholder={`Enter ${provider.label} API key...`}
                  value={keyInputs[provider.id] || ""}
                  onChange={(e) =>
                    setKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                  }
                />
                <Button
                  size="sm"
                  onClick={() =>
                    saveMutation.mutate({
                      provider: provider.id,
                      key: keyInputs[provider.id] || "",
                    })
                  }
                  disabled={!keyInputs[provider.id] || saveMutation.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
