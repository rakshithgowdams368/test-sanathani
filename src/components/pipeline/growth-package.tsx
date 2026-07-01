import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface GrowthPackageViewProps {
  data: any | null;
}

export function GrowthPackageView({ data }: GrowthPackageViewProps) {
  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No growth package yet. Run the Growth Strategist agent.
          </p>
        </CardContent>
      </Card>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.hook ? [data.hook] : []).concat(data.titles?.reel || []).slice(0, 3).map((h: string, i: number) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2">
              <p className="min-w-0 break-words text-sm">{h}</p>
              <Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0" onClick={() => copyToClipboard(h)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {data.caption && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Caption</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(data.caption)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{data.caption}</p>
          </CardContent>
        </Card>
      )}

      {data.hashtags && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Hashtags</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard((data.hashtags || []).map((h: string) => `#${h}`).join(" "))}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {data.hashtags.map((tag: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {data.thumbnail_concept && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thumbnail Concept</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{data.thumbnail_concept}</p>
            </CardContent>
          </Card>
        )}

        {data.best_post_time && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best Time to Post</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{data.best_post_time}</p>
              {data.cta && <p className="mt-2 text-xs text-muted-foreground">CTA: {data.cta}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {data.thirty_day_calendar && Array.isArray(data.thirty_day_calendar) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">30-Day Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-7">
              {data.thirty_day_calendar.slice(0, 30).map((day: any, i: number) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-md border p-1.5 text-center"
                >
                  <span className="text-[10px] font-semibold">{day.day || i + 1}</span>
                  <span className="text-[9px] text-muted-foreground">{day.deity || day.theme}</span>
                  <Badge variant="outline" className="mt-0.5 text-[8px]">
                    {day.format}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
